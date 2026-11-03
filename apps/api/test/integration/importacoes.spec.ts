import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { importacoesSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { popularBancoDeTeste } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { criarApp } from '../../src/app';

let app: FastifyInstance;
const repositorio = new RepositorioDeLotesPostgres();

const pedir = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/importacoes' });
  return { status: resposta.statusCode, corpo: resposta.json() };
};

const doImportador = async (id: string) => (await pedir()).corpo.importadores.find((i: { id: string }) => i.id === id);

beforeAll(async () => {
  app = criarApp();
  await app.ready();
});

beforeEach(async () => {
  await popularBancoDeTeste();
  await pool.query('TRUNCATE execucoes RESTART IDENTITY');
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

async function registrar(importador: string, ano: number, status: 'sucesso' | 'falhou', erro: string[] = []) {
  const id = await repositorio.abrirExecucao(importador, ano, new Date('2026-03-10T06:00:00.000Z'));
  await repositorio.fecharExecucao(
    id,
    {
      execucaoId: id,
      importador,
      ano,
      status,
      consultas: [
        {
          consultaId: 1,
          chave: 'receitas',
          status: status === 'falhou' ? 'falhou' : 'publicada',
          linhasLidas: 10,
          linhasGravadas: 10,
          erros: erro,
        },
      ],
    },
    new Date('2026-03-10T06:05:00.000Z'),
  );
}

describe('GET /api/importacoes', () => {
  it('lista cada importador do registro, e a resposta obedece ao schema', async () => {
    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.importadores.map((i: { id: string }) => i.id)).toEqual(['betha', 'ibge', 'siconfi', 'tcesc']);
    expect(importacoesSchema.safeParse(corpo).error?.issues).toBeUndefined();
  });

  it('importador que nunca rodou aparece sem execução, com o que está publicado', async () => {
    expect(await doImportador('betha')).toEqual({
      id: 'betha',
      ultimaExecucao: null,
      exercicios: [{ ano: 2025, atualizadoEm: '2025-03-01T12:00:00.000Z' }],
    });
  });

  it('traz status, exercício e horários da última execução', async () => {
    await registrar('betha', 2024, 'falhou');
    await registrar('betha', 2025, 'sucesso');

    expect((await doImportador('betha')).ultimaExecucao).toEqual({
      ano: 2025,
      status: 'sucesso',
      iniciadoEm: '2026-03-10T06:00:00.000Z',
      finalizadoEm: '2026-03-10T06:05:00.000Z',
      linhasLidas: 10,
      linhasGravadas: 10,
    });
  });

  it('execução de um importador não aparece no outro', async () => {
    await registrar('tcesc', 2025, 'sucesso');

    expect((await doImportador('betha')).ultimaExecucao).toBeNull();
  });

  it('exercício mostra a data da consulta mais antiga da fonte: é o quanto o conjunto está atualizado', async () => {
    await pool.query(`UPDATE coletas SET finalizado_em = '2026-01-01T00:00:00Z' WHERE consulta_id = 57153`);

    expect((await doImportador('betha')).exercicios).toEqual([{ ano: 2025, atualizadoEm: '2025-03-01T12:00:00.000Z' }]);
  });

  it('coleta de exemplo não conta como dado atualizado', async () => {
    await pool.query(`UPDATE coletas SET status = 'exemplo' WHERE consulta_id IN (57153, 57140, 57170)`);

    expect((await doImportador('betha')).exercicios).toEqual([]);
  });

  it('a mensagem de erro da execução não sai na resposta pública', async () => {
    await registrar('betha', 2025, 'falhou', ['falhou em https://x/cb#access_token=abc123']);

    const texto = JSON.stringify((await pedir()).corpo);

    expect(texto).not.toContain('abc123');
    expect(texto).not.toContain('https://x');
    expect((await doImportador('betha')).ultimaExecucao.status).toBe('falhou');
  });
});
