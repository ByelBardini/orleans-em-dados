import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { gravarSnapshot, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
// @ts-expect-error: o caminho antigo ainda é JavaScript.
import { gravarColeta } from '../../../gravar.js';
// @ts-expect-error: as fixtures ainda são JavaScript.
import { empenhos, despesas, receitas } from '../../../test/support/snapshots.js';
import { criarImportadorBetha } from '../../src/importador';

const repositorio = new RepositorioDeLotesPostgres();
const importador = criarImportadorBetha({
  cliente: { buscar: async () => ({ totalHits: 0, hits: [] }), totalizadores: async () => [] },
});
const consulta = (chave: string) => importador.consultas.find((c) => c.chave === chave)!;

async function linhas(tabela: string, coletaId: number) {
  const { rows } = await pool.query(`SELECT * FROM ${tabela} WHERE coleta_id = $1 ORDER BY id_externo`, [coletaId]);
  return rows.map(({ coleta_id: _coleta, ...resto }) => resto);
}

beforeEach(() => pool.query('TRUNCATE coletas RESTART IDENTITY CASCADE'));
afterAll(() => pool.end());

describe('normalização em TS × SQL antigo de gravarColeta', () => {
  it.each([
    ['receitas', 'receitas', receitas],
    ['empenhos', 'empenhos', empenhos],
    ['despesas', 'despesas', despesas],
  ])('%s gera exatamente as mesmas linhas', async (chave, tabela, montar) => {
    const { coletaId: antiga } = await gravarColeta(montar(), 'arquivo');
    const { coletaId: nova } = await gravarSnapshot(consulta(chave), montar(), 'arquivo', repositorio);

    const resultado = await linhas(tabela, nova);

    expect(resultado).toEqual(await linhas(tabela, antiga));
    expect(resultado.length).toBeGreaterThan(0);
  });
});
