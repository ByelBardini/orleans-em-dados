// As rotas de finanças por área: a receita conferida não espera as coletas da despesa, e a área sem
// conferência diz o que falta e se a fonte nem publica aquele exercício (o Farol: receitas desde 2018,
// empenhos desde 2023).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { gravarLote, popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { despesas, empenhos, receitas, snapshot } from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';
import { pedir } from '../paridade/casos';

const RESPOSTAS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../paridade/respostas');
const gravada = (arquivo: string) => JSON.parse(readFileSync(path.join(RESPOSTAS, arquivo), 'utf8')).corpo;

let app: FastifyInstance;
let base: string;
const get = async (caso: string) => (await pedir(base, caso)).corpo;

beforeAll(async () => {
  await popularCenario();
  // 2025 sem os empenhos do TCE-SC; 2016 só com a Betha, antes de o Farol publicar qualquer coisa.
  await pool.query('DELETE FROM publicacoes WHERE consulta_id = 900002');
  await gravarLote('betha', 'receitas', snapshot(57153, receitas().registros, { ano: 2016 }));
  await gravarLote('betha', 'empenhos', snapshot(57140, empenhos().registros, { ano: 2016 }));
  await gravarLote('betha', 'despesas', snapshot(57170, despesas().registros, { ano: 2016 }));
  app = criarApp();
  base = await app.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('ano com as receitas das duas fontes e sem os empenhos do TCE-SC', () => {
  // Só o corte dos empenhos muda: ele vem do próprio TCE-SC, que aqui não tem a coleta.
  it('/api/receitas responde igual a quando as cinco coletas estão publicadas, sem o corte dos empenhos', async () => {
    const completa = gravada('api_receitas_ano_2025.json');
    const esperada = {
      ...completa,
      conferencia: { ...completa.conferencia, limites: { ...completa.conferencia.limites, dataEmpenho: null } },
    };

    expect(await get('/api/receitas?ano=2025')).toEqual(esperada);
  });

  it('/api/despesas/resumo fica sem número e diz que faltam os empenhos do TCE-SC, ainda não coletados', async () => {
    const { conferencia, totais } = await get('/api/despesas/resumo?ano=2025');

    expect(conferencia).toMatchObject({ disponivel: false, faltando: ['tcesc_empenhos'] });
    expect(conferencia.foraDaFonte).toBeUndefined();
    expect(totais.empenhado).toBeNull();
  });

  it('/api/discrepancias traz os casos da receita e diz que a despesa ficou de fora', async () => {
    const corpo = await get('/api/discrepancias?ano=2025');

    expect(corpo.disponivel).toBe(true);
    expect([...new Set(corpo.grupos.map((g: { area: string }) => g.area))]).toEqual(['receita']);
    expect(corpo.semConferencia).toEqual([{ area: 'despesa', faltando: ['tcesc_empenhos'], foraDaFonte: [] }]);
  });
});

describe('exercício que o TCE-SC não publica', () => {
  it('/api/receitas diz que a fonte não publica as receitas do ano e mostra a Betha como fonte única', async () => {
    const { conferencia, totais } = await get('/api/receitas?ano=2016');

    expect(conferencia).toMatchObject({
      disponivel: false,
      fonteUnica: true,
      faltando: ['tcesc_receitas'],
      foraDaFonte: ['tcesc_receitas'],
    });
    // A soma da fixture `receitas()`: 300000 + 250000,50 + 1000000 − 5000,25 + 200000 + 200000.
    expect(totais.arrecadadoNoMes).toBe(1945000.25);
  });

  it('/api/despesas/resumo diz que a fonte não publica as receitas nem os empenhos do ano, e mostra a 57170', async () => {
    const { conferencia, totais } = await get('/api/despesas/resumo?ano=2016');

    expect(conferencia).toMatchObject({
      disponivel: false,
      fonteUnica: true,
      faltando: ['tcesc_receitas', 'tcesc_empenhos'],
      foraDaFonte: ['tcesc_receitas', 'tcesc_empenhos'],
    });
    expect(totais.empenhado).toBe(195000);
  });

  it('/api/despesas/empenhos/resumo diz o mesmo e traz a 57140 inteira como fonte única', async () => {
    const { conferencia, totais } = await get('/api/despesas/empenhos/resumo?ano=2016');

    expect(conferencia).toMatchObject({
      disponivel: false,
      fonteUnica: true,
      foraDaFonte: ['tcesc_receitas', 'tcesc_empenhos'],
    });
    // Os seis registros da fixture `empenhos()`, sem casamento.
    expect(totais.quantidade).toBe(6);
  });

  it('/api/discrepancias fica indisponível e diz o que a fonte não publica', async () => {
    const corpo = await get('/api/discrepancias?ano=2016');

    expect(corpo).toMatchObject({ disponivel: false, foraDaFonte: ['tcesc_receitas', 'tcesc_empenhos'] });
  });
});
