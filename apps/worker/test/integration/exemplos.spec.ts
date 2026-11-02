import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { limparColetas, popularBancoDeTeste } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { importarArquivos } from '../../src/comandos';
import { criarImportadores } from '../../src/registro';

const EXEMPLOS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../examples/betha');
const arquivos = [path.join(EXEMPLOS, 'empenhos-2025.json'), path.join(EXEMPLOS, 'receitas-2025.json')];
const repositorio = new RepositorioDeLotesPostgres();

beforeEach(limparColetas);
afterAll(() => pool.end());

describe('exemplos fictícios do repositório', () => {
  it('em banco vazio são publicados, e as coletas ficam marcadas como exemplo', async () => {
    const resultados = await importarArquivos(arquivos, criarImportadores(), repositorio);

    expect(resultados.map((r) => r.erro)).toEqual([undefined, undefined]);
    const { rows } = await pool.query(
      `SELECT c.status, c.origem FROM publicacoes p JOIN coletas c ON c.id = p.coleta_id`,
    );
    expect(rows).toEqual([
      { status: 'exemplo', origem: 'exemplo' },
      { status: 'exemplo', origem: 'exemplo' },
    ]);
  });

  it('com dado real publicado, são gravados mas não publicados', async () => {
    await popularBancoDeTeste();

    const resultados = await importarArquivos(arquivos, criarImportadores(), repositorio);

    expect(resultados.map((r) => r.publicada)).toEqual([false, false]);
  });
});
