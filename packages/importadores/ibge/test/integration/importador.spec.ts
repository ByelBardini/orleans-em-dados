import { pool } from '@orleans-em-dados/db';
import { executar, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { criarImportadorIbge } from '../../src/importador';
import { ClienteIbgeFake, respostasCompletas, respostasDaComparacao, respostasDoCenso } from '../support/agregados';

const rodar = (respostas: Record<string, unknown>, comparacao: Record<string, unknown> = respostasDaComparacao()) =>
  executar(criarImportadorIbge({ cliente: new ClienteIbgeFake(respostas, comparacao) }), 2026, {
    repositorio: new RepositorioDeLotesPostgres(),
    relogio: () => new Date('2026-11-02T06:00:00.000Z'),
  });

beforeEach(() => pool.query('TRUNCATE coletas, execucoes RESTART IDENTITY CASCADE'));
afterAll(() => pool.end());

describe('importador do IBGE sobre o Postgres', () => {
  it('lote aprovado aparece na view, com o ano da coleta e o período de cada linha', async () => {
    const resultado = await rodar(respostasCompletas());

    expect(resultado.status).toBe('sucesso');
    const { rows } = await pool.query(
      `SELECT ano, periodo, valor FROM ibge_valores_publicados WHERE tabela = '6579' AND localidade = '4211702' ORDER BY periodo`,
    );
    expect(rows).toEqual([
      { ano: 2026, periodo: '2021', valor: 950 },
      { ano: 2026, periodo: '2024', valor: 1020 },
    ]);
  });

  it('composição do PIB em `...` fica nula na tabela, com o símbolo', async () => {
    await rodar(respostasCompletas());

    const { rows } = await pool.query(
      `SELECT valor, simbolo FROM ibge_valores_publicados WHERE localidade = '4211702' AND tabela = '5938' AND variavel = '513' AND periodo = '2023'`,
    );

    expect(rows).toEqual([{ valor: null, simbolo: '...' }]);
  });

  it('item da conferência vai para totais_fonte', async () => {
    await rodar(respostasCompletas());

    const { rows } = await pool.query(
      `SELECT valor_fonte, valor_calculado, diferenca FROM totais_fonte WHERE campo = 'situacao_domicilio'`,
    );

    expect(rows).toEqual([{ valor_fonte: 1000, valor_calculado: 1000, diferenca: 0 }]);
  });

  it('parte que não fecha com o total rejeita o lote e mantém a publicação anterior', async () => {
    await rodar(respostasCompletas());

    const resultado = await rodar({ ...respostasCompletas(), ...respostasDoCenso({ rural: '299' }) });

    expect(resultado.consultas.find((c) => c.chave === 'ibge_censo')?.status).toBe('rejeitada');
    const { rows } = await pool.query(
      `SELECT valor FROM ibge_valores_publicados WHERE localidade = '4211702' AND tabela = '9923' AND categoria = 'Rural'`,
    );
    expect(rows).toEqual([{ valor: 300 }]);
  });

  it('mesmo conteúdo em nova rodada fica sem_mudanca, sem nova coleta', async () => {
    await rodar(respostasCompletas());

    const resultado = await rodar(respostasCompletas());

    expect(resultado.consultas.map((c) => c.status)).toEqual([
      'sem_mudanca',
      'sem_mudanca',
      'sem_mudanca',
      'sem_mudanca',
    ]);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM coletas`);
    expect(rows).toEqual([{ n: 4 }]);
  });
});

describe('comparação com o Brasil e Santa Catarina', () => {
  it('a view traz a mesma linha nos três lugares, cada uma com a sua localidade', async () => {
    const resultado = await rodar(respostasCompletas());

    expect(resultado.status).toBe('sucesso');
    const { rows } = await pool.query(
      `SELECT localidade, valor FROM ibge_valores_publicados
       WHERE tabela = '4709' AND periodo = '2022' ORDER BY localidade`,
    );
    expect(rows).toEqual([
      { localidade: '1', valor: 1000 },
      { localidade: '42', valor: 1000 },
      { localidade: '4211702', valor: 1000 },
    ]);
  });

  it('comparação recusada não atrapalha a publicação de Orleans', async () => {
    const resultado = await rodar(respostasCompletas(), respostasDaComparacao({ santaCatarina: {} }));

    const status = Object.fromEntries(resultado.consultas.map((c) => [c.chave, c.status]));
    expect(status.ibge_comparacao).toBe('rejeitada');
    expect(status.ibge_censo).toBe('publicada');
  });
});
