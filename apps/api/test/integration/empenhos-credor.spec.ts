// O histórico de credor que pode ser pessoa física não sai da API: nem na lista, nem nos maiores,
// nem no CSV, e a busca não procura nele (LGPD, art. 7º, §§ 3º e 7º). O nome continua: a LC 131
// manda divulgar o beneficiário do pagamento.
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pareceOrganizacao } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { popularBancoDeTeste } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { criarApp } from '../../src/app';
import { pareceOrganizacaoSql } from '../../src/modules/empenhos/empenhos.dao';
import { pedir } from '../paridade/casos';

const PESSOA = 'JOAO DA SILVA (exemplo)';
const ID = '211:728:1001';
const HISTORICO = 'Merenda escolar (exemplo)';

type Item = { id: string; credor: string | null; historico: string | null };

let app: FastifyInstance;
let base: string;

beforeAll(async () => {
  await popularBancoDeTeste();
  // O empenho da merenda passa a ter um credor sem marca de empresa.
  await pool.query('UPDATE empenhos SET credor = $1 WHERE id_externo = $2', [PESSOA, ID]);
  app = criarApp();
  base = await app.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('credor que pode ser pessoa física', () => {
  it('a lista traz o nome e o histórico nulo', async () => {
    const { corpo } = await pedir(base, '/api/despesas/empenhos?ano=2025&q=joao');
    const itens = (corpo as { itens: Item[] }).itens;

    expect(itens.map(({ id, credor, historico }) => ({ id, credor, historico }))).toEqual([
      { id: ID, credor: PESSOA, historico: null },
    ]);
  });

  it('a busca por um termo do histórico não acha o empenho', async () => {
    const { corpo } = await pedir(base, '/api/despesas/empenhos?ano=2025&q=merenda');

    expect((corpo as { total: number }).total).toBe(0);
  });

  it('nos maiores do ano, o histórico também sai nulo', async () => {
    const { corpo } = await pedir(base, '/api/despesas/empenhos/resumo?ano=2025');
    const maior = (corpo as { maiores: Item[] }).maiores.find((m) => m.id === ID);

    expect(maior).toMatchObject({ credor: PESSOA, historico: null });
  });

  it('o CSV não leva o histórico', async () => {
    const { corpo } = await pedir(base, '/api/despesas/empenhos.csv?ano=2025');

    expect(corpo).toContain(PESSOA);
    expect(corpo).not.toContain(HISTORICO);
  });
});

describe('credor que parece organização', () => {
  it('mantém o histórico e continua achável por ele', async () => {
    const { corpo } = await pedir(base, '/api/despesas/empenhos?ano=2025&q=exames');
    const itens = (corpo as { itens: Item[] }).itens;

    expect(itens.map((i) => [i.credor, i.historico])).toEqual([['LABORATORIO EXEMPLO LTDA', 'Exames (exemplo)']]);
  });
});

describe('pareceOrganizacaoSql', () => {
  // A regra do Postgres e a da tela têm de concordar, ou a tela diria "omitido" do que veio.
  const NOMES = [
    'AGUA EXEMPLO LTDA',
    'CONSTRUTORA FICTICIA S.A.',
    'CELESC DISTRIBUICAO S/A',
    'PAPELARIA MODELO ME',
    'JOAO DA SILVA 12.345.678/0001-90',
    'JOAO DA SILVA 12345678000190',
    'Associação de Pais e Professores',
    'CIA CATARINENSE DE AGUAS',
    'JOAO DA SILVA',
    'Maria José de Sá',
    'HELDER CAMARA',
    'ANA MEIRELES',
    'CARLOS SALTDAL',
    '',
  ];

  it('o Postgres classifica cada nome como a função da tela', async () => {
    const { rows } = await pool.query<{ nome: string; organizacao: boolean }>(
      `SELECT n AS nome, ${pareceOrganizacaoSql('n')} AS organizacao FROM unnest($1::text[]) AS n`,
      [NOMES],
    );

    expect(rows.map((r) => [r.nome, r.organizacao])).toEqual(NOMES.map((n) => [n, pareceOrganizacao(n)]));
  });

  it('credor nulo não parece organização', async () => {
    const { rows } = await pool.query<{ organizacao: boolean }>(
      `SELECT ${pareceOrganizacaoSql('n')} AS organizacao FROM (SELECT NULL::text AS n) t`,
    );

    expect(rows[0]?.organizacao).toBe(false);
  });
});
