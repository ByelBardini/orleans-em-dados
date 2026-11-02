import { describe, expect, it } from 'vitest';
import { executar, ocultarSegredos } from '../src/executor.service';
import { bruto, consultaFake, importadorFake, RepositorioDeLotesFake, relogioFake } from './support/fakes';

const INICIO = '2026-03-10T06:00:00.000Z';
const FIM = '2026-03-10T06:05:00.000Z';

function preparar() {
  return { repositorio: new RepositorioDeLotesFake(), relogio: relogioFake(INICIO, FIM) };
}

describe('executar — caminho feliz', () => {
  it('lote válido é gravado, publicado e a execução fecha com sucesso e as contagens', async () => {
    const dependencias = preparar();

    const resultado = await executar(importadorFake(), 2025, dependencias);

    expect(resultado.status).toBe('sucesso');
    expect(resultado.consultas).toEqual([
      {
        consultaId: 1,
        chave: 'teste',
        status: 'publicada',
        coletaId: 1,
        linhasLidas: 2,
        linhasGravadas: 2,
        erros: [],
      },
    ]);
    expect(dependencias.repositorio.gravados[0]).toMatchObject({
      ano: 2025,
      origem: 'api',
      status: 'totalizador_conciliado',
      totalHits: 2,
      capturados: 2,
      idsUnicos: 2,
      linhas: [{ idExterno: 'a' }, { idExterno: 'b' }],
    });
  });

  it('grava antes de publicar, entre abrir e fechar a execução', async () => {
    const dependencias = preparar();

    await executar(importadorFake(), 2025, dependencias);

    expect(dependencias.repositorio.ordem).toEqual(['abrirExecucao', 'gravar', 'publicar', 'fecharExecucao']);
  });

  it('a execução registra início e fim pelo relógio recebido', async () => {
    const dependencias = preparar();

    await executar(importadorFake(), 2025, dependencias);

    const [execucao] = dependencias.repositorio.execucoes;
    expect(execucao?.inicio).toEqual(new Date(INICIO));
    expect(execucao?.fim).toEqual(new Date(FIM));
  });
});

describe('executar — validação', () => {
  it('validação que reprova grava o lote rejeitado, não publica e cita os motivos', async () => {
    const dependencias = preparar();
    const consulta = consultaFake({
      validar: () => ({ conferencia: [], erros: ['valor: diferença de 0.01 em relação ao totalizador'] }),
    });

    const resultado = await executar(importadorFake(consulta), 2025, dependencias);

    expect(resultado.status).toBe('rejeitada');
    expect(resultado.consultas[0]).toMatchObject({
      status: 'rejeitada',
      erros: ['valor: diferença de 0.01 em relação ao totalizador'],
    });
    expect(dependencias.repositorio.gravados[0]?.status).toBe('rejeitado');
    expect(dependencias.repositorio.ordem).not.toContain('publicar');
  });

  it('a conferência da validação vai junto com o lote', async () => {
    const dependencias = preparar();
    const item = { campo: 'valor', fonte: '20.00', calculado: '20.00', diferenca: '0.00' };
    const consulta = consultaFake({ validar: () => ({ conferencia: [item], erros: [] }) });

    await executar(importadorFake(consulta), 2025, dependencias);

    expect(dependencias.repositorio.gravados[0]?.conferencia).toEqual([item]);
  });

  it('coleta com menos registros que o total da fonte é rejeitada citando os números', async () => {
    const dependencias = preparar();
    const consulta = consultaFake({
      coletar: async () => ({ filtro: {}, totalHits: 5, registros: [bruto('a'), bruto('b')] }),
    });

    const resultado = await executar(importadorFake(consulta), 2025, dependencias);

    expect(resultado.consultas[0]?.erros).toEqual(['capturados 2 de 5']);
    expect(dependencias.repositorio.ordem).not.toContain('publicar');
  });

  it('ids repetidos rejeitam o lote citando quantos', async () => {
    const dependencias = preparar();
    const consulta = consultaFake({ registros: [bruto('a'), bruto('a'), bruto('b')] });

    const resultado = await executar(importadorFake(consulta), 2025, dependencias);

    expect(resultado.consultas[0]?.erros).toEqual(['1 IDs repetidos']);
    expect(dependencias.repositorio.gravados[0]).toMatchObject({ capturados: 3, idsUnicos: 2, status: 'rejeitado' });
  });

  it('erros que a própria coleta apontou rejeitam o lote', async () => {
    const dependencias = preparar();
    const consulta = consultaFake({
      coletar: async () => ({
        filtro: {},
        totalHits: 1,
        registros: [bruto('a')],
        erros: ['totalHits mudou durante a coleta (1 → 2)'],
      }),
    });

    const resultado = await executar(importadorFake(consulta), 2025, dependencias);

    expect(resultado.consultas[0]?.erros).toEqual(['totalHits mudou durante a coleta (1 → 2)']);
  });

  it('registro que a normalização recusa rejeita o lote citando o id, sem linhas e sem validar', async () => {
    const dependencias = preparar();
    let validou = false;
    const consulta = consultaFake({
      normalizar: (r) => {
        if (r.id === 'b') throw new Error('Valor monetário inválido: "1e3"');
        return { idExterno: r.id };
      },
      validar: () => {
        validou = true;
        return { conferencia: [], erros: [] };
      },
    });

    const resultado = await executar(importadorFake(consulta), 2025, dependencias);

    expect(resultado.status).toBe('rejeitada');
    expect(resultado.consultas[0]?.erros).toEqual(['registro b: Valor monetário inválido: "1e3"']);
    expect(resultado.consultas[0]?.linhasGravadas).toBe(0);
    expect(dependencias.repositorio.gravados[0]?.linhas).toEqual([]);
    expect(validou).toBe(false);
  });
});

describe('executar — falhas', () => {
  it('coletar que lança não grava nada e fecha a execução como falhou, com a mensagem', async () => {
    const dependencias = preparar();
    const consulta = consultaFake({
      coletar: async () => {
        throw new Error('Betha: HTTP 503');
      },
    });

    const resultado = await executar(importadorFake(consulta), 2025, dependencias);

    expect(resultado.status).toBe('falhou');
    expect(resultado.consultas[0]).toMatchObject({ status: 'falhou', erros: ['Betha: HTTP 503'], linhasLidas: 0 });
    expect(dependencias.repositorio.ordem).toEqual(['abrirExecucao', 'fecharExecucao']);
  });

  it('segredo na mensagem de erro não chega à execução', async () => {
    const dependencias = preparar();
    const consulta = consultaFake({
      coletar: async () => {
        throw new Error('falhou em https://x/cb#access_token=abc123&expires_in=3600 com Bearer abc123');
      },
    });

    const resultado = await executar(importadorFake(consulta), 2025, dependencias);

    const [erro] = resultado.consultas[0]?.erros ?? [];
    expect(erro).not.toContain('abc123');
    expect(erro).toContain('[oculto]');
  });

  it('falha numa consulta não impede a seguinte de publicar', async () => {
    const dependencias = preparar();
    const quebrada = consultaFake({
      id: 1,
      chave: 'quebrada',
      coletar: async () => {
        throw new Error('fora do ar');
      },
    });
    const boa = consultaFake({ id: 2, chave: 'boa' });

    const resultado = await executar(importadorFake(quebrada, boa), 2025, dependencias);

    expect(resultado.status).toBe('falhou');
    expect(resultado.consultas.map((c) => c.status)).toEqual(['falhou', 'publicada']);
    expect(dependencias.repositorio.publicados.map((p) => p.consultaId)).toEqual([2]);
  });

  it('erro ao gravar também fecha a execução como falhou', async () => {
    const dependencias = preparar();
    dependencias.repositorio.falharAoGravar = new Error('sem conexão');

    const resultado = await executar(importadorFake(), 2025, dependencias);

    expect(resultado.consultas[0]).toMatchObject({ status: 'falhou', erros: ['sem conexão'] });
    expect(dependencias.repositorio.ordem.at(-1)).toBe('fecharExecucao');
  });

  it('falha tem prioridade sobre rejeição no status da execução', async () => {
    const dependencias = preparar();
    const rejeitada = consultaFake({ id: 1, validar: () => ({ conferencia: [], erros: ['diverge'] }) });
    const quebrada = consultaFake({
      id: 2,
      coletar: async () => {
        throw new Error('fora do ar');
      },
    });

    const resultado = await executar(importadorFake(rejeitada, quebrada), 2025, dependencias);

    expect(resultado.status).toBe('falhou');
  });
});

describe('executar — idempotência', () => {
  it('o mesmo conteúdo executado de novo não grava outra coleta e só reconfirma a data', async () => {
    const dependencias = { repositorio: new RepositorioDeLotesFake(), relogio: relogioFake(INICIO) };
    await executar(importadorFake(), 2025, dependencias);
    dependencias.repositorio.ordem = [];

    const resultado = await executar(importadorFake(), 2025, dependencias);

    expect(resultado.status).toBe('sucesso');
    expect(resultado.consultas[0]).toMatchObject({ status: 'sem_mudanca', coletaId: 1, linhasGravadas: 0 });
    expect(dependencias.repositorio.gravados).toHaveLength(1);
    expect(dependencias.repositorio.publicados).toHaveLength(1);
    expect(dependencias.repositorio.reconfirmados).toEqual([{ coletaId: 1, coletadoEm: new Date(INICIO) }]);
  });

  it('conteúdo diferente gera coleta nova', async () => {
    const dependencias = preparar();
    await executar(importadorFake(consultaFake({ registros: [bruto('a', 10)] })), 2025, dependencias);

    await executar(importadorFake(consultaFake({ registros: [bruto('a', 11)] })), 2025, dependencias);

    expect(dependencias.repositorio.gravados).toHaveLength(2);
    expect(dependencias.repositorio.gravados[0]?.hash).not.toBe(dependencias.repositorio.gravados[1]?.hash);
  });

  it('o mesmo conteúdo em outro ano é outra publicação', async () => {
    const dependencias = preparar();
    await executar(importadorFake(), 2025, dependencias);

    await executar(importadorFake(), 2024, dependencias);

    expect(dependencias.repositorio.gravados).toHaveLength(2);
  });

  it('conteúdo igual ao publicado, mas reprovado na validação, não é reconfirmado', async () => {
    const dependencias = preparar();
    await executar(importadorFake(), 2025, dependencias);
    const reprovada = consultaFake({ validar: () => ({ conferencia: [], erros: ['totalizador diverge'] }) });

    const resultado = await executar(importadorFake(reprovada), 2025, dependencias);

    expect(resultado.status).toBe('rejeitada');
    expect(dependencias.repositorio.reconfirmados).toEqual([]);
  });
});

describe('ocultarSegredos', () => {
  it.each([
    ['Authorization: Bearer abc.def-123', 'Authorization: Bearer [oculto]'],
    ['access_token=abc123&expires_in=3600', 'access_token=[oculto]&expires_in=3600'],
    ['sem segredo nenhum', 'sem segredo nenhum'],
  ])('%s vira %s', (entrada, esperado) => {
    expect(ocultarSegredos(entrada)).toBe(esperado);
  });
});
