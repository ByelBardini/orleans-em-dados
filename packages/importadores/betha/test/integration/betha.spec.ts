import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { executar, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { criarImportadorBetha } from '../../src/importador';

const hits = [
  {
    id: '211:728:1_1',
    sourceAsMap: {
      rubricaNatureza: '11125001000000',
      descricaoNatureza: 'IPTU (exemplo)',
      valorOrcadoAtualizado: 100.5,
      valorArrecadadoNoMes: 40.25,
    },
  },
  {
    id: '211:319:2_1',
    sourceAsMap: {
      rubricaNatureza: '17135011000000',
      descricaoNatureza: 'SUS (exemplo)',
      valorOrcadoAtualizado: 0,
      valorArrecadadoNoMes: -0.25,
    },
  },
];

const cliente = (totalArrecadado: number) => ({
  buscar: async () => ({ totalHits: hits.length, hits }),
  totalizadores: async () => [
    { campo: 'valorOrcadoAtualizado', valor: 100.5 },
    { campo: 'valorArrecadadoNoMes', valor: totalArrecadado },
  ],
});

const rodar = (totalArrecadado: number) =>
  executar(
    {
      ...criarImportadorBetha({ cliente: cliente(totalArrecadado) }),
    },
    2025,
    { repositorio: new RepositorioDeLotesPostgres(), relogio: () => new Date('2026-03-10T06:00:00.000Z') },
    ['receitas'],
  );

beforeEach(() => pool.query('TRUNCATE coletas, execucoes RESTART IDENTITY CASCADE'));
afterAll(() => pool.end());

describe('importador Betha sobre o Postgres', () => {
  it('coleta que bate com o totalizador fica publicada, com as linhas e a conferência', async () => {
    const resultado = await rodar(40);

    expect(resultado.status).toBe('sucesso');
    const { rows: linhas } = await pool.query(
      'SELECT entidade_codigo, mes, valor_arrecadado_mes FROM receitas_publicadas ORDER BY id_externo',
    );
    expect(linhas).toEqual([
      { entidade_codigo: '319', mes: 1, valor_arrecadado_mes: -0.25 },
      { entidade_codigo: '728', mes: 1, valor_arrecadado_mes: 40.25 },
    ]);
    const { rows: totais } = await pool.query('SELECT campo, valor_fonte, diferenca FROM totais_fonte ORDER BY campo');
    expect(totais).toEqual([
      { campo: 'valorArrecadadoNoMes', valor_fonte: 40, diferenca: 0 },
      { campo: 'valorOrcadoAtualizado', valor_fonte: 100.5, diferenca: 0 },
    ]);
  });

  it('coleta que não bate fica gravada como rejeitada e nada é publicado', async () => {
    const resultado = await rodar(40.01);

    expect(resultado.status).toBe('rejeitada');
    const { rows } = await pool.query('SELECT status FROM coletas');
    expect(rows).toEqual([{ status: 'rejeitado' }]);
    const { rows: publicadas } = await pool.query('SELECT count(*)::int AS n FROM publicacoes');
    expect(publicadas[0].n).toBe(0);
  });
});
