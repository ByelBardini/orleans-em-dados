// A receita do ano que o TCE-SC não publica sai da Betha, como fonte única; a do formato bruto
// (até 2019) traz a dedução do FUNDEB à parte e as entidades que a Betha não publica.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { gravarLote, popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import {
  ANO_ANTIGO,
  receita,
  receitasFormatoAntigo,
  snapshot,
  tcescReceitasFormatoAntigo,
} from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';
import { pedir } from '../paridade/casos';

const RESPOSTAS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../paridade/respostas');
const gravada = (arquivo: string) => JSON.parse(readFileSync(path.join(RESPOSTAS, arquivo), 'utf8')).corpo;

// 2017: só a Betha, no formato antigo, com a Prefeitura e o FMS.
const SO_BETHA = 2017;

let app: FastifyInstance;
let base: string;
const get = async (caso: string) => (await pedir(base, caso)).corpo;

beforeAll(async () => {
  await popularCenario();
  await gravarLote('betha', 'receitas', receitasFormatoAntigo());
  await gravarLote('tcesc', 'receitas', tcescReceitasFormatoAntigo());
  await gravarLote(
    'betha',
    'receitas',
    snapshot(
      57153,
      [
        ...receitasFormatoAntigo().registros,
        receita('319:403', '417135011010000', 'Transferência SUS (exemplo)', 1, 300, 300),
      ],
      { ano: SO_BETHA },
    ),
  );
  app = criarApp();
  base = await app.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('ano que o TCE-SC não publica, só com a Betha', () => {
  it('a receita sai da Betha como fonte única, sem conferência, e diz que a fonte não publica', async () => {
    const { conferencia, totais } = await get(`/api/receitas?ano=${SO_BETHA}`);

    expect(conferencia).toMatchObject({
      disponivel: false,
      fonteUnica: true,
      conferido: null,
      foraDaFonte: ['tcesc_receitas'],
      receitaBruta: true,
    });
    // 1000 + 500 da Prefeitura e 300 do FMS; a linha de dedução vem zerada.
    expect(totais.arrecadadoNoMes).toBe(1800);
  });

  it('a origem sai da natureza sem a classe: 17 e 11, nunca 41 ou 91', async () => {
    const { porOrigem } = await get(`/api/receitas?ano=${SO_BETHA}`);

    expect(porOrigem.map((o: { chave: string }) => o.chave).sort()).toEqual(['11', '17']);
  });

  it('com o filtro de entidade, só a receita daquela entidade', async () => {
    const { totais, naturezas } = await get(`/api/receitas?ano=${SO_BETHA}&entidade=319`);

    expect(totais.arrecadadoNoMes).toBe(300);
    expect(naturezas.map((n: { natureza: string }) => n.natureza)).toEqual(['17135011010000']);
  });

  it('a natureza da tabela vem no formato novo, e a rubrica como a Betha publica', async () => {
    const { naturezas } = await get(`/api/receitas?ano=${SO_BETHA}&entidade=728`);

    expect(naturezas.map((n: { rubrica: string; natureza: string }) => [n.rubrica, n.natureza])).toEqual([
      ['417280111010000', '17280111010000'],
      ['411125001000000', '11125001000000'],
    ]);
  });

  it('o CSV traz a natureza ao lado da rubrica e não chama o arrecadado de conferido', async () => {
    const { corpo } = await pedir(base, `/api/receitas.csv?ano=${SO_BETHA}&entidade=319`);

    expect(corpo).toContain('Rubrica;Natureza;Descrição;Entidade;Orçado atualizado;Arrecadado (só Betha)\r\n');
    expect(corpo).toContain('417135011010000;17135011010000;');
  });
});

describe('ano no formato bruto, com o TCE-SC', () => {
  it('a receita conferida diz que é bruta, traz a dedução do TCE-SC e a entidade que a Betha não publica', async () => {
    const { conferencia, totais } = await get(`/api/receitas?ano=${ANO_ANTIGO}`);

    expect(conferencia).toMatchObject({
      disponivel: true,
      fonteUnica: false,
      receitaBruta: true,
      deducaoSoTce: -200,
      entidadesSemBetha: [{ codigo: '319', entidade: 'FMS', totalTce: 300 }],
    });
    expect(totais.arrecadadoNoMes).toBe(1500);
  });
});

describe('ano conferido no formato novo', () => {
  it('responde igual à paridade, com os campos novos zerados', async () => {
    const corpo = await get('/api/receitas?ano=2025');

    expect(corpo).toEqual(gravada('api_receitas_ano_2025.json'));
    expect(corpo.conferencia).toMatchObject({
      fonteUnica: false,
      receitaBruta: false,
      deducaoSoTce: null,
      entidadesSemBetha: [],
    });
  });
});

describe('ano em que o TCE-SC publica, mas a coleta dele ainda não existe', () => {
  it('fica sem número e não é fonte única: a falta é da coleta, não da fonte', async () => {
    await pool.query(`DELETE FROM publicacoes WHERE consulta_id = 900001 AND ano = $1`, [ANO_ANTIGO]);

    const { conferencia, totais } = await get(`/api/receitas?ano=${ANO_ANTIGO}`);

    expect(conferencia).toMatchObject({ disponivel: false, fonteUnica: false, faltando: ['tcesc_receitas'] });
    expect(totais.arrecadadoNoMes).toBeNull();
  });
});
