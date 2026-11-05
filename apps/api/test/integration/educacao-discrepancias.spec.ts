import type { FastifyInstance } from 'fastify';
import { educacaoDiscrepanciasSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { financa } from '../../../../packages/importadores/fixtures/src/educacao';
import {
  despesa,
  siconfiFuncoes,
  siconfiIndices,
  snapshot,
} from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';

let app: FastifyInstance;

const pedir = async (url = '/api/educacao/discrepancias') => {
  const resposta = await app.inject({ method: 'GET', url });
  return { status: resposta.statusCode, corpo: educacaoDiscrepanciasSchema.parse(resposta.json()) };
};

type Par = [valor: string | null, percentual: string | null];

// Os outros recortes e indicadores do Anexo 8 têm valores que nunca podem sair na comparação.
const anexo8 = (ano: number, educacao: Par, fundeb: Par, gastoLiquidado: string | null) => {
  const p = String(ano);
  return snapshot(
    900402,
    [
      financa('indice_educacao', p, educacao[0], { percentual: educacao[1] }),
      financa('indice_educacao', p, '777.00', { recorte: 'exigido' }),
      financa('fundeb_remuneracao', p, fundeb[0], { percentual: fundeb[1] }),
      financa('fundeb_remuneracao', p, '666.00', { recorte: 'exigido' }),
      financa('gasto_total', p, gastoLiquidado, { recorte: 'liquidado' }),
      financa('gasto_total', p, '555.00', { recorte: 'empenhado' }),
      financa('emenda_119', p, '444.00', { recorte: 'exigido_2021' }),
    ],
    { ano },
  );
};

// A função 12 só vale no liquidado: empenhado e pago ficam diferentes de propósito.
const dca = (ano: number, liquidado: string) =>
  siconfiFuncoes({ ano, contas: { '12 - Educação': ['111111.11', liquidado, '222222.22'] } });

const CENARIO = {
  educacao: {
    siope_anexo8: [
      anexo8(2020, ['1000.00', '28.08'], [null, '80.66'], '3000.00'),
      anexo8(2021, ['1000.00', '23.28'], ['500.00', '78.12'], '2000.00'),
      anexo8(2022, ['900.00', '27.62'], ['400.00', '86.03'], '5000.01'),
      // Sem o Anexo 14 deste ano: não há com o que comparar.
      anexo8(2023, ['1.00', '27.72'], ['2.00', '90.06'], '4000.00'),
    ],
  },
  siconfiIndices: [
    // 2017 só tem o SICONFI: sai junto com 2012 a 2019.
    siconfiIndices({ ano: 2017, educacao: ['5000.00', '30.15'], fundeb: ['6000.00', '88.01'] }),
    siconfiIndices({ ano: 2020, educacao: ['1200.50', '28.54'], fundeb: ['800.00', '87.13'] }),
    siconfiIndices({ ano: 2021, educacao: ['986.45', '23.28'], fundeb: ['500.00', '78.94'] }),
    siconfiIndices({ ano: 2022, educacao: ['900.00', '27.62'], fundeb: ['400.00', '86.03'] }),
  ],
  siconfiFuncoes: [
    dca(2018, '1500.00'),
    dca(2020, '3457.25'),
    dca(2021, '2000.00'),
    dca(2022, '5000.00'),
    dca(2023, '4000.00'),
  ],
};

const grupoDe = (corpo: Awaited<ReturnType<typeof pedir>>['corpo'], id: string) =>
  corpo.grupos.find((g) => g.id === id);

beforeAll(async () => {
  app = criarApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/educacao/discrepancias', () => {
  describe('com as duas fontes em vários anos', () => {
    beforeAll(() => popularCenario(CENARIO));

    it('responde 200, com nada faltando', async () => {
      const { status, corpo } = await pedir();

      expect(status).toBe(200);
      expect(corpo.disponivel).toBe(true);
      expect(corpo.faltando).toEqual([]);
    });

    it('os índices: um caso por ano e índice em que o valor difere, do ano mais antigo ao mais novo', async () => {
      const { corpo } = await pedir();

      expect(grupoDe(corpo, 'indices')?.casos.map((c) => [c.ano, c.item])).toEqual([
        [2020, 'Aplicação em educação'],
        [2020, 'Fundeb na remuneração'],
        [2021, 'Aplicação em educação'],
      ]);
    });

    it('valor diferente com percentual igual é caso: 1.000,00 × 986,45 dá 13,55 a mais no SIOPE', async () => {
      const { corpo } = await pedir();

      expect(grupoDe(corpo, 'indices')?.casos[2]).toEqual({
        ano: 2021,
        item: 'Aplicação em educação',
        a: { valor: 1000, percentual: 23.28 },
        b: { valor: 986.45, percentual: 23.28 },
        diferenca: 13.55,
        maior: 'a',
        nota: null,
      });
    });

    it('o SICONFI maior fica do lado b: 1.000,00 × 1.200,50 dá 200,50', async () => {
      const { corpo } = await pedir();

      expect(grupoDe(corpo, 'indices')?.casos[0]).toMatchObject({ diferenca: 200.5, maior: 'b' });
    });

    it('sem o valor do Anexo 8, não há diferença: só os dois percentuais, com a nota', async () => {
      const { corpo } = await pedir();

      expect(grupoDe(corpo, 'indices')?.casos[1]).toEqual({
        ano: 2020,
        item: 'Fundeb na remuneração',
        a: { valor: null, percentual: 80.66 },
        b: { valor: 800, percentual: 87.13 },
        diferenca: null,
        maior: null,
        nota: 'Uma das fontes não traz o valor deste ano, e só os percentuais ficam lado a lado.',
      });
    });

    it('valor igual não é caso, mesmo com percentual diferente: Fundeb de 2021', async () => {
      const { corpo } = await pedir();

      const fundeb = grupoDe(corpo, 'indices')?.casos.filter((c) => c.item === 'Fundeb na remuneração');
      expect(fundeb?.map((c) => c.ano)).toEqual([2020]);
    });

    it('2017 só tem o SICONFI e 2023 só tem o Anexo 8: nenhum índice sai deles', async () => {
      const { corpo } = await pedir();

      const anos = grupoDe(corpo, 'indices')?.casos.map((c) => c.ano);
      expect(anos).not.toContain(2017);
      expect(anos).not.toContain(2023);
    });

    it('o gasto compara o liquidado do Anexo 8 com a função 12, e 2021 e 2023, iguais, não saem', async () => {
      const { corpo } = await pedir();

      expect(grupoDe(corpo, 'gasto_total')?.casos).toEqual([
        {
          ano: 2020,
          item: 'Gasto liquidado',
          a: { valor: 3000, percentual: null },
          b: { valor: 3457.25, percentual: null },
          diferenca: 457.25,
          maior: 'b',
          nota: null,
        },
        {
          ano: 2022,
          item: 'Gasto liquidado',
          a: { valor: 5000.01, percentual: null },
          b: { valor: 5000, percentual: null },
          diferenca: 0.01,
          maior: 'a',
          nota: null,
        },
      ]);
    });

    it('cada grupo nomeia as duas fontes da comparação', async () => {
      const { corpo } = await pedir();

      const nomes = corpo.grupos.map((g) => [g.id, g.fonteA.nome, g.fonteB.nome]);
      expect(nomes).toEqual([
        ['indices', 'SIOPE, Anexo 8', 'SICONFI, RREO Anexo 14'],
        ['gasto_total', 'SIOPE, Anexo 8', 'SICONFI, DCA Anexo I-E'],
      ]);
    });

    it('não depende de ano: pedir com ?ano responde o mesmo', async () => {
      const { corpo } = await pedir();

      expect((await pedir('/api/educacao/discrepancias?ano=2021')).corpo).toEqual(corpo);
    });

    it('sem rótulo de problema, sem hipótese de causa e sem o que o Anexo 8 traz fora da comparação', async () => {
      const { corpo } = await pedir();

      const texto = JSON.stringify(corpo);
      expect(texto).not.toMatch(/validad[oa]s?\b|valida[çc][ãa]o|irregular|fraude|\berros?\b|fantasma/i);
      expect(texto).not.toMatch(/problema|causa|motivo|emenda|\b119\b/i);
      expect(texto).not.toMatch(/\b(777|666|555|444)\b/);
    });

    it('não tem CSV', async () => {
      const resposta = await app.inject({ method: 'GET', url: '/api/educacao/discrepancias.csv' });

      expect(resposta.statusCode).toBe(404);
    });
  });

  describe('função 12 × ações da Betha', () => {
    const acao = (empenhado: number, liquidado: number, pago: number) =>
      snapshot(57170, [
        despesa(
          '728:1',
          '33903000000000',
          { numero: '54', nome: 'Manutenção do Ensino Fundamental' },
          0,
          empenhado,
          liquidado,
          pago,
        ),
      ]);

    it('com diferença, um caso por etapa que difere, e etapa igual não sai', async () => {
      // A DCA padrão das fixtures tem 53.000,00 na função 12, nas três etapas.
      await popularCenario({ despesas: acao(53000, 52900.5, 52999.99) });

      const { corpo } = await pedir();

      const grupo = grupoDe(corpo, 'gasto_acoes');
      expect([grupo?.fonteA.nome, grupo?.fonteB.nome]).toEqual(['SICONFI, DCA Anexo I-E', 'Betha, consulta 57170']);
      expect(grupo?.casos).toEqual([
        {
          ano: 2025,
          item: 'Liquidado',
          a: { valor: 53000, percentual: null },
          b: { valor: 52900.5, percentual: null },
          diferenca: 99.5,
          maior: 'a',
          nota: null,
        },
        {
          ano: 2025,
          item: 'Pago',
          a: { valor: 53000, percentual: null },
          b: { valor: 52999.99, percentual: null },
          diferenca: 0.01,
          maior: 'a',
          nota: null,
        },
      ]);
    });

    it('conferido não vira caso', async () => {
      await popularCenario({ despesas: acao(53000, 53000, 53000) });

      expect(grupoDe((await pedir()).corpo, 'gasto_acoes')).toBeUndefined();
    });

    it('ano com DCA sem a Betha não vira caso', async () => {
      await popularCenario(CENARIO);

      expect(grupoDe((await pedir()).corpo, 'gasto_acoes')).toBeUndefined();
    });
  });

  describe('sem coleta de uma das fontes', () => {
    it.each([
      ['siope_anexo8', { educacao: { siope_anexo8: null } }],
      ['siconfi_indices', { siconfiIndices: [] }],
      ['siconfi_funcoes', { siconfiFuncoes: [] }],
    ])('sem %s, o bloco some e diz o que falta', async (chave, cenario) => {
      await popularCenario(cenario);

      const { status, corpo } = await pedir();

      expect(status).toBe(200);
      expect(corpo).toEqual({ disponivel: false, faltando: [chave], grupos: [] });
    });
  });

  describe('sem nenhuma diferença', () => {
    it('as fontes iguais em todo ano: disponível, sem grupo', async () => {
      await popularCenario({
        educacao: { siope_anexo8: [anexo8(2021, ['1000.00', '23.28'], ['500.00', '78.12'], '2000.00')] },
        siconfiIndices: [siconfiIndices({ ano: 2021, educacao: ['1000.00', '23.28'], fundeb: ['500.00', '78.12'] })],
        siconfiFuncoes: [dca(2021, '2000.00')],
      });

      expect((await pedir()).corpo).toEqual({ disponivel: true, faltando: [], grupos: [] });
    });

    it.each([
      ['com o percentual igual', '78.12'],
      ['sem o percentual', null],
    ])('sem o valor do Anexo 8 e %s, não há o que mostrar', async (_cenario, percentual) => {
      await popularCenario({
        educacao: { siope_anexo8: [anexo8(2021, ['1000.00', '23.28'], [null, percentual], '2000.00')] },
        siconfiIndices: [siconfiIndices({ ano: 2021, educacao: ['1000.00', '23.28'], fundeb: ['500.00', '78.12'] })],
        siconfiFuncoes: [dca(2021, '2000.00')],
      });

      expect((await pedir()).corpo.grupos).toEqual([]);
    });
  });
});
