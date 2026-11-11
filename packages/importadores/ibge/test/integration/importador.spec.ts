import { pool } from '@orleans-em-dados/db';
import { executar, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { criarImportadorIbge } from '../../src/importador';
import { ClienteIbgeFake, respostasCompletas, respostasDaComparacao, respostasDoCenso } from '../support/agregados';
import { respostasDaEducacao, respostasDasPesquisas, VALORES_DA_REDE } from '../support/educacao';

const rodar = (
  respostas: Record<string, unknown>,
  comparacao: Record<string, unknown> = respostasDaComparacao(),
  pesquisas = respostasDasPesquisas(),
) => {
  const cliente = new ClienteIbgeFake(respostas, comparacao, pesquisas);
  return executar(criarImportadorIbge({ cliente, pesquisas: cliente }), 2026, {
    repositorio: new RepositorioDeLotesPostgres(),
    relogio: () => new Date('2026-11-02T06:00:00.000Z'),
  });
};
const statusDe = (resultado: Awaited<ReturnType<typeof rodar>>, chave: string) =>
  resultado.consultas.find((c) => c.chave === chave)?.status;

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

    expect(resultado.consultas.map((c) => c.status)).toEqual(Array(8).fill('sem_mudanca'));
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM coletas`);
    expect(rows).toEqual([{ n: 8 }]);
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

describe('Censo de educação', () => {
  it('a linha de cada recorte aparece na view uma vez, com `-` como zero', async () => {
    await rodar(respostasCompletas());

    const { rows } = await pool.query(
      `SELECT categoria, valor, simbolo FROM ibge_valores_publicados
       WHERE localidade = '4211702' AND tabela = '10324' AND categoria LIKE '%|Superior de graduação' ORDER BY categoria`,
    );
    expect(rows).toEqual([
      { categoria: 'Município de residência|Superior de graduação', valor: 398, simbolo: null },
      { categoria: 'Outro município|Superior de graduação', valor: 188, simbolo: null },
      { categoria: 'País estrangeiro|Superior de graduação', valor: 0, simbolo: '-' },
    ]);
  });

  it('o arredondamento da amostra publica o lote, com a diferença em totais_fonte', async () => {
    const resultado = await rodar(respostasCompletas());

    expect(statusDe(resultado, 'ibge_educacao_censo')).toBe('publicada');
    const { rows } = await pool.query(
      `SELECT valor_fonte, valor_calculado, diferenca FROM totais_fonte WHERE campo = 'local_graduacao'`,
    );
    expect(rows).toEqual([{ valor_fonte: 585, valor_calculado: 586, diferenca: 1 }]);
  });

  it('comparação de educação recusada não atrapalha o Censo de educação de Orleans', async () => {
    const resultado = await rodar(
      respostasCompletas(),
      respostasDaComparacao({
        santaCatarina: { ...respostasCompletas(), ...respostasDaEducacao({ alfabetizadas: '899' }) },
      }),
    );

    expect(statusDe(resultado, 'ibge_educacao_comparacao')).toBe('rejeitada');
    expect(statusDe(resultado, 'ibge_educacao_censo')).toBe('publicada');
    const { rows } = await pool.query(
      `SELECT DISTINCT localidade FROM ibge_valores_publicados WHERE tabela = '10092' ORDER BY localidade`,
    );
    expect(rows).toEqual([{ localidade: '4211702' }]);
  });
});

describe('rede escolar', () => {
  it('matrícula por série e rede fica na view, em Orleans e em Santa Catarina', async () => {
    await rodar(respostasCompletas());

    const { rows } = await pool.query(
      `SELECT localidade, valor, unidade FROM ibge_valores_publicados
       WHERE tabela = 'pesquisa-13' AND variavel = '77941' AND periodo = '2025' ORDER BY localidade`,
    );
    expect(rows).toEqual([
      { localidade: '42', valor: 60, unidade: 'matrículas' },
      { localidade: '4211702', valor: 60, unidade: 'matrículas' },
    ]);
  });

  it('ano sem IDEB fica nulo na tabela, nunca zero', async () => {
    await rodar(respostasCompletas());

    const { rows } = await pool.query(
      `SELECT periodo, valor, simbolo FROM ibge_valores_publicados
       WHERE tabela = 'pesquisa-40' AND localidade = '4211702' AND variavel = '78186' ORDER BY periodo`,
    );
    expect(rows).toEqual([
      { periodo: '2023', valor: null, simbolo: null },
      { periodo: '2025', valor: null, simbolo: null },
    ]);
  });

  it('série × rede que não fecha rejeita o lote e mantém a publicação anterior', async () => {
    await rodar(respostasCompletas());

    const rede = { ...VALORES_DA_REDE, 77945: { '2021': '60', '2025': '71' } };
    const resultado = await rodar(respostasCompletas(), undefined, respostasDasPesquisas({ rede }));

    expect(statusDe(resultado, 'ibge_rede_escolar')).toBe('rejeitada');
    const { rows } = await pool.query(
      `SELECT valor FROM ibge_valores_publicados
       WHERE tabela = 'pesquisa-13' AND localidade = '4211702' AND variavel = '77945' AND periodo = '2025'`,
    );
    expect(rows).toEqual([{ valor: 70 }]);
  });

  it('id fora da árvore rejeita o lote, citando o indicador', async () => {
    const pesquisas = respostasDasPesquisas();
    pesquisas.resultados['40:42'] = [{ id: 999, res: [{ localidade: '42', res: { '2025': '1' } }] }];

    const resultado = await rodar(respostasCompletas(), undefined, pesquisas);

    const rede = resultado.consultas.find((c) => c.chave === 'ibge_rede_escolar');
    expect(rede?.status).toBe('rejeitada');
    expect(rede?.erros.join()).toContain('indicador 999 fora da árvore');
  });
});
