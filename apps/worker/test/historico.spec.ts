import { describe, expect, it } from 'vitest';
import type { Importador } from '@orleans-em-dados/importador-nucleo';
import {
  consultaFake,
  importadorFake,
  RepositorioDeLotesFake,
} from '../../../packages/importadores/nucleo/test/support/fakes';
import { completarHistorico, planejarHistorico, type EstadoDoHistorico } from '../src/historico';

const AGORA = new Date('2026-11-16T05:00:00.000Z');

// Duas consultas: `a` (id 1) quer 2024 e 2025; `b` (id 2) só 2025, como o TCE-SC, que começa depois.
const comHistorico = (campos: Partial<Importador> = {}): Importador => ({
  ...importadorFake(consultaFake({ id: 1, chave: 'a' }), consultaFake({ id: 2, chave: 'b' })),
  anosDaCarga: () => [
    { chave: 'a', anos: [2024, 2025] },
    { chave: 'b', anos: [2025] },
  ],
  ...campos,
});

const estado = (publicados: string[] = [], gravados: string[] = []): EstadoDoHistorico => ({
  publicados: new Set(publicados),
  gravados: new Set([...publicados, ...gravados]),
});

const resumo = (pedidos: ReturnType<typeof planejarHistorico>) =>
  pedidos.map((p) => ({ importador: p.importador.id, ano: p.ano, chaves: p.chaves }));

describe('planejarHistorico', () => {
  it('banco vazio pede cada exercício da janela, do mais recente ao mais antigo', () => {
    const pedidos = planejarHistorico([comHistorico()], AGORA, 10, estado(), 'subida');

    expect(resumo(pedidos)).toEqual([
      { importador: 'fake', ano: 2025, chaves: ['a', 'b'] },
      { importador: 'fake', ano: 2024, chaves: ['a'] },
    ]);
  });

  it('consulta já publicada no exercício não é pedida de novo; a outra do mesmo ano é', () => {
    const pedidos = planejarHistorico([comHistorico()], AGORA, 10, estado(['1:2025']), 'subida');

    expect(resumo(pedidos)).toEqual([
      { importador: 'fake', ano: 2025, chaves: ['b'] },
      { importador: 'fake', ano: 2024, chaves: ['a'] },
    ]);
  });

  it('exercício com tudo publicado não vira pedido', () => {
    const pedidos = planejarHistorico([comHistorico()], AGORA, 10, estado(['1:2025', '2:2025', '1:2024']), 'subida');

    expect(pedidos).toEqual([]);
  });

  it('na subida, o par só rejeitado é tentado de novo, porque o código pode ter mudado', () => {
    const pedidos = planejarHistorico([comHistorico()], AGORA, 10, estado(['1:2025', '2:2025'], ['1:2024']), 'subida');

    expect(resumo(pedidos)).toEqual([{ importador: 'fake', ano: 2024, chaves: ['a'] }]);
  });

  it('na rodada diária, o par só rejeitado fica para a próxima subida', () => {
    const pedidos = planejarHistorico([comHistorico()], AGORA, 10, estado(['1:2025', '2:2025'], ['1:2024']), 'diario');

    expect(pedidos).toEqual([]);
  });

  it('na rodada diária, o par que nunca foi gravado é pedido', () => {
    const pedidos = planejarHistorico([comHistorico()], AGORA, 10, estado(['1:2025', '2:2025']), 'diario');

    expect(resumo(pedidos)).toEqual([{ importador: 'fake', ano: 2024, chaves: ['a'] }]);
  });

  it('importador sem histórico (o IBGE) não vira pedido', () => {
    const { anosDaCarga: _sem, ...semHistorico } = comHistorico();

    expect(planejarHistorico([semHistorico], AGORA, 10, estado(), 'subida')).toEqual([]);
  });

  it('a janela e o relógio chegam ao importador', () => {
    const recebidos: [number, number][] = [];
    const importador = comHistorico({
      anosDaCarga: (agora, janela) => {
        recebidos.push([agora.getUTCFullYear(), janela]);
        return [];
      },
    });

    planejarHistorico([importador], AGORA, 4, estado(), 'subida');

    expect(recebidos).toEqual([[2026, 4]]);
  });
});

class Espera {
  pausas: number[] = [];
  esperar = async (ms: number) => {
    this.pausas.push(ms);
  };
}

const dependencias = (estadoDoBanco = estado()) => {
  const repositorio = new RepositorioDeLotesFake();
  const espera = new Espera();
  return {
    repositorio,
    espera,
    deps: {
      repositorio,
      relogio: () => AGORA,
      esperar: espera.esperar,
      lerEstado: async () => estadoDoBanco,
    },
  };
};

describe('completarHistorico', () => {
  it('executa só as consultas que faltam em cada exercício', async () => {
    const { repositorio, deps } = dependencias(estado(['1:2025']));

    await completarHistorico([comHistorico()], deps, { modo: 'subida', janela: 10, pausaMs: 300 });

    expect(repositorio.gravados.map((l) => [l.consultaId, l.ano])).toEqual([
      [2, 2025],
      [1, 2024],
    ]);
  });

  it('espera entre um exercício e o seguinte, e não depois do último', async () => {
    const { espera, deps } = dependencias();

    await completarHistorico([comHistorico()], deps, { modo: 'subida', janela: 10, pausaMs: 300 });

    expect(espera.pausas).toEqual([300]);
  });

  it('falha num exercício não impede os outros e não relança', async () => {
    const quebrada = consultaFake({
      id: 1,
      chave: 'a',
      coletar: async () => {
        throw new Error('fonte fora do ar');
      },
    });
    const importador = comHistorico({ consultas: [quebrada, consultaFake({ id: 2, chave: 'b' })] });
    const { repositorio, deps } = dependencias();

    const resultados = await completarHistorico([importador], deps, { modo: 'subida', janela: 10, pausaMs: 0 });

    expect(resultados.map((r) => [r.ano, r.status])).toEqual([
      [2025, 'falhou'],
      [2024, 'falhou'],
    ]);
    expect(repositorio.gravados.map((l) => [l.consultaId, l.ano])).toEqual([[2, 2025]]);
  });
});
