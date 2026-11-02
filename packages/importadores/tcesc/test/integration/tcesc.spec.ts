import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { executar, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { criarImportadorTcesc } from '../../src/importador';
import type { SessaoQlik } from '../../src/sessao-qlik';

const dim = (qText: string | null) => (qText === null ? { qIsNull: true } : { qText, qNum: 'NaN' as const });
const num = (qNum: number) => ({ qNum, qText: String(qNum) });

const sessao = (total: number): SessaoQlik => {
  const selecionados: Record<string, string[]> = {};
  return {
    limparSelecoes: async () => {},
    selecionar: async (campo, texto) => {
      selecionados[campo] = [texto];
    },
    selecoes: async () => selecionados,
    hipercubo: async () => ({
      linhasTotal: 2,
      linhas: [
        [
          dim('Prefeitura Municipal de Orleans'),
          dim('1.1.1.2.50.0.1'),
          dim('jan'),
          dim(null),
          num(300000.5),
          dim('IPTU'),
        ],
        [dim('Prefeitura Municipal de Orleans'), dim('1.1.1.2.50.0.1'), dim('fev'), dim(null), num(-0.5), dim('IPTU')],
      ],
      totais: [num(total), dim(null)],
    }),
    infoApp: async () => ({ titulo: 'App', ultimaRecarga: '2025-03-01T06:00:00.000Z' }),
    fechar: () => {},
  };
};

const rodar = (total: number) =>
  executar(
    criarImportadorTcesc({ abrirSessao: async () => sessao(total) }),
    2025,
    { repositorio: new RepositorioDeLotesPostgres(), relogio: () => new Date('2026-03-10T06:00:00.000Z') },
    ['receitas'],
  );

beforeEach(() => pool.query('TRUNCATE coletas, execucoes RESTART IDENTITY CASCADE'));
afterAll(() => pool.end());

describe('importador TCE-SC sobre o Postgres', () => {
  it('cubo que bate com o motor fica publicado, com mês e valor na tabela', async () => {
    const resultado = await rodar(300000);

    expect(resultado.status).toBe('sucesso');
    const { rows } = await pool.query(
      `SELECT mes, valor_arrecadado FROM tcesc_receitas r JOIN publicacoes p ON p.coleta_id = r.coleta_id ORDER BY mes`,
    );
    expect(rows).toEqual([
      { mes: 1, valor_arrecadado: 300000.5 },
      { mes: 2, valor_arrecadado: -0.5 },
    ]);
  });

  it('a recarga do app fica no filtro, de onde a conferência a lê', async () => {
    await rodar(300000);

    const { rows } = await pool.query(`SELECT filtro->>'ultimaRecargaApp' AS recarga FROM coletas`);
    expect(rows).toEqual([{ recarga: '2025-03-01T06:00:00.000Z' }]);
  });

  it('cubo que não bate fica gravado como rejeitado e nada é publicado', async () => {
    const resultado = await rodar(300000.01);

    expect(resultado.status).toBe('rejeitada');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM publicacoes');
    expect(rows[0].n).toBe(0);
  });
});
