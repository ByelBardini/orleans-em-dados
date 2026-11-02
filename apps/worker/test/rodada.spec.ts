import { describe, expect, it } from 'vitest';
import {
  consultaFake,
  importadorFake,
  RepositorioDeLotesFake,
} from '../../../packages/importadores/nucleo/test/support/fakes';
import { RodadaComFalha, rodarImportador } from '../src/rodada';

const dependencias = () => ({
  repositorio: new RepositorioDeLotesFake(),
  relogio: () => new Date('2026-03-10T06:00:00.000Z'),
});

describe('rodarImportador', () => {
  it('executa cada exercício da rodada do importador', async () => {
    const importador = { ...importadorFake(), anosDaRodada: () => [2026, 2025] };

    const resultados = await rodarImportador(importador, dependencias());

    expect(resultados.map((r) => r.ano)).toEqual([2026, 2025]);
  });

  it('os exercícios vêm do relógio recebido', async () => {
    const anos: number[] = [];
    const importador = {
      ...importadorFake(),
      anosDaRodada: (agora: Date) => {
        anos.push(agora.getUTCFullYear());
        return [];
      },
    };

    await rodarImportador(importador, dependencias());

    expect(anos).toEqual([2026]);
  });

  it('falha num exercício relança depois de tentar os outros, para a fila repetir', async () => {
    const quebrada = consultaFake({
      coletar: async () => {
        throw new Error('Betha: HTTP 503');
      },
    });
    const importador = { ...importadorFake(quebrada), anosDaRodada: () => [2026, 2025] };
    const deps = dependencias();

    await expect(rodarImportador(importador, deps)).rejects.toThrow(RodadaComFalha);

    expect(deps.repositorio.execucoes.map((e) => e.ano)).toEqual([2026, 2025]);
  });

  it('a falha cita o importador, o exercício e o erro', async () => {
    const quebrada = consultaFake({
      chave: 'receitas',
      coletar: async () => {
        throw new Error('Betha: HTTP 503');
      },
    });

    await expect(rodarImportador(importadorFake(quebrada), dependencias())).rejects.toThrow(
      'fake 2025: receitas: Betha: HTTP 503',
    );
  });

  it('lote rejeitado não relança: repetir na hora traria o mesmo dado, e a próxima rodada tenta de novo', async () => {
    const reprovada = consultaFake({ validar: () => ({ conferencia: [], erros: ['diverge'] }) });

    const [resultado] = await rodarImportador(importadorFake(reprovada), dependencias());

    expect(resultado?.status).toBe('rejeitada');
  });
});
