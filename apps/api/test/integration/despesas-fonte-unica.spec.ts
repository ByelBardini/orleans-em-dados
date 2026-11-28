// A despesa e os empenhos do ano que o TCE-SC não publica (o Farol: empenhos desde 2023) saem da Betha,
// como fonte única: a 57170 para a execução e a 57140 para a lista, com a mesma regra de privacidade.
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { gravarLote, popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import {
  ANO_ANTIGO,
  despesas,
  empenhos,
  receitasFormatoAntigo,
  snapshot,
  tcescReceitasFormatoAntigo,
} from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';
import { pedir } from '../paridade/casos';

const PESSOA = 'JOAO DA SILVA (exemplo)';
const HISTORICO_DA_PESSOA = 'Merenda escolar (exemplo)';

let app: FastifyInstance;
let base: string;
const get = async (caso: string) => (await pedir(base, caso)).corpo;

beforeAll(async () => {
  await popularCenario();
  // 2019: a receita das duas fontes, e a despesa só da Betha.
  await gravarLote('betha', 'receitas', receitasFormatoAntigo());
  await gravarLote('tcesc', 'receitas', tcescReceitasFormatoAntigo());
  await gravarLote('betha', 'empenhos', snapshot(57140, empenhos().registros, { ano: ANO_ANTIGO }));
  await gravarLote('betha', 'despesas', snapshot(57170, despesas().registros, { ano: ANO_ANTIGO }));
  // O empenho da merenda de 2019 tem um credor sem marca de empresa.
  await pool.query(`UPDATE empenhos SET credor = $1 WHERE ano = $2 AND id_externo = '211:728:1001'`, [
    PESSOA,
    ANO_ANTIGO,
  ]);
  app = criarApp();
  base = await app.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('/api/despesas/resumo no ano sem os empenhos do TCE-SC', () => {
  it('a execução sai da 57170 como fonte única, por entidade, dizendo que a fonte não publica', async () => {
    const { conferencia, totais, porEntidade } = await get(`/api/despesas/resumo?ano=${ANO_ANTIGO}`);

    expect(conferencia).toMatchObject({
      disponivel: false,
      fonteUnica: true,
      entidadesConferidas: null,
      faltando: ['tcesc_empenhos'],
      foraDaFonte: ['tcesc_empenhos'],
    });
    // A fixture `despesas()`: 53000 + 127000 + 15000 empenhados.
    expect(totais).toMatchObject({ empenhado: 195000, liquidado: 120000, pago: 100000 });
    expect(porEntidade.map((e: { chave: string; fonte: string }) => [e.chave, e.fonte])).toEqual([
      ['728', 'betha'],
      ['319', 'betha'],
    ]);
  });

  it('a Câmara, que só o TCE-SC tem, fica fora da soma e da lista de entidades', async () => {
    const { camara, porEntidade } = await get(`/api/despesas/resumo?ano=${ANO_ANTIGO}`);

    expect(camara).toBeNull();
    expect(porEntidade.map((e: { chave: string }) => e.chave)).not.toContain('1864');
  });

  it('no ano com os empenhos do TCE-SC, a despesa conferida não é fonte única', async () => {
    const { conferencia } = await get('/api/despesas/resumo?ano=2025');

    expect(conferencia).toMatchObject({ disponivel: true, fonteUnica: false });
  });
});

describe('/api/despesas/empenhos no ano sem os empenhos do TCE-SC', () => {
  it('o resumo é o da 57140 inteira, como fonte única', async () => {
    const { conferencia, totais } = await get(`/api/despesas/empenhos/resumo?ano=${ANO_ANTIGO}`);

    expect(conferencia).toMatchObject({ disponivel: false, fonteUnica: true, foraDaFonte: ['tcesc_empenhos'] });
    // Os seis registros da 57140, sem casamento: a cópia antiga do 13 também entra.
    expect(totais).toMatchObject({ quantidade: 6, empenhado: 198000, excluidos: 0 });
  });

  it('a lista traz os empenhos do Portal da Transparência, e a busca funciona', async () => {
    const { itens } = await get(`/api/despesas/empenhos?ano=${ANO_ANTIGO}&q=laboratorio`);

    expect(itens.map((i: { numero: number; historico: string }) => [i.numero, i.historico])).toEqual([
      [5, 'Exames (exemplo)'],
    ]);
  });

  it('credor que pode ser pessoa física sai sem o histórico, na lista e no CSV', async () => {
    const [{ itens }, { corpo: csv }] = await Promise.all([
      get(`/api/despesas/empenhos?ano=${ANO_ANTIGO}&q=joao`),
      pedir(base, `/api/despesas/empenhos.csv?ano=${ANO_ANTIGO}`),
    ]);

    expect(itens.map((i: { credor: string; historico: string | null }) => [i.credor, i.historico])).toEqual([
      [PESSOA, null],
    ]);
    expect(csv).not.toContain(HISTORICO_DA_PESSOA);
  });

  it('no ano com os empenhos do TCE-SC, o resumo conferido não é fonte única', async () => {
    const { conferencia } = await get('/api/despesas/empenhos/resumo?ano=2025');

    expect(conferencia).toMatchObject({ disponivel: true, fonteUnica: false });
  });
});
