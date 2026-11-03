import type { FastifyInstance } from 'fastify';
import { municipioSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gravarSnapshot, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import {
  ANO_DA_COLETA_IBGE,
  ibgeComparacao,
  ibgePib,
  ibgePopulacao,
  snapshot,
  valorIbge,
} from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarImportadorIbge } from '../../../../packages/importadores/ibge/src/importador';
import { criarApp } from '../../src/app';

let app: FastifyInstance;

const pedir = async (method: 'GET' | 'POST' = 'GET') => {
  const resposta = await app.inject({ method, url: '/api/municipio' });
  return { status: resposta.statusCode, corpo: resposta.json() };
};

type Ponto = { ano: number; populacao: number; tipo: string };
type AnoDoPib = { ano: number; pib: number; perCapita: number; divisor: Ponto; composicao: unknown };

beforeAll(async () => {
  app = criarApp();
  await app.ready();
});
beforeEach(() => popularCenario());
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/municipio', () => {
  it('responde pelo schema do contrato', async () => {
    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(municipioSchema.safeParse(corpo).error?.issues).toBeUndefined();
    expect(corpo.disponivel).toBe(true);
  });

  it('série marca censo em 2000, 2010 e 2022 e estimativa nos outros', async () => {
    const { corpo } = await pedir();

    expect(corpo.populacao.serie).toEqual([
      { ano: 2000, populacao: 20000, tipo: 'censo' },
      { ano: 2010, populacao: 21000, tipo: 'censo' },
      { ano: 2021, populacao: 23000, tipo: 'estimativa' },
      { ano: 2022, populacao: 23500, tipo: 'censo' },
      { ano: 2024, populacao: 24000, tipo: 'estimativa' },
      { ano: 2025, populacao: 24200, tipo: 'estimativa' },
      { ano: 2026, populacao: 24400, tipo: 'estimativa' },
    ]);
  });

  it('território, situação e rendimento vêm com o ano do Censo', async () => {
    const { corpo } = await pedir();

    expect(corpo.territorio).toEqual({ ano: 2022, areaKm2: 550.125, densidade: 42.72 });
    expect(corpo.situacao).toEqual({ ano: 2022, total: 23500, urbana: 15000, rural: 8500 });
    expect(corpo.rendimento).toEqual({ ano: 2022, medio: 2000.5, mediano: 1500.25 });
  });

  it('PIB per capita de 2023, sem estimativa no ano, divide pelo Censo 2022', async () => {
    const { corpo } = await pedir();

    const ano = corpo.pib.serie.find((p: AnoDoPib) => p.ano === 2023);

    expect(ano.divisor).toEqual({ ano: 2022, populacao: 23500, tipo: 'censo' });
    // 1.400.000 mil reais / 23.500 pessoas
    expect(ano.perCapita).toBe(59574.47);
  });

  it('PIB per capita de 2021 divide pela estimativa do próprio ano', async () => {
    const { corpo } = await pedir();

    const ano = corpo.pib.serie.find((p: AnoDoPib) => p.ano === 2021);

    expect(ano.divisor).toEqual({ ano: 2021, populacao: 23000, tipo: 'estimativa' });
    expect(ano.perCapita).toBe(43478.26);
  });

  it('composição do PIB em 2023 fica nula, sem virar zero, e 2021 é o último ano com ela', async () => {
    const { corpo } = await pedir();

    expect(corpo.pib.serie.find((p: AnoDoPib) => p.ano === 2023).composicao).toBeNull();
    expect(corpo.pib.serie.find((p: AnoDoPib) => p.ano === 2021).composicao).toEqual({
      agropecuaria: 100000,
      industria: 300000,
      servicos: 400000,
      administracao: 100000,
      impostos: 100000,
    });
    expect(corpo.pib.ultimoAnoDaComposicao).toBe(2021);
  });

  it('pirâmide soma a faixa de 80 anos ou mais a partir das faixas abertas, e `-` conta zero', async () => {
    const { corpo } = await pedir();

    expect(corpo.piramide.total).toBe(23500);
    expect(corpo.piramide.faixas).toHaveLength(17);
    expect(corpo.piramide.faixas[0]).toEqual({ faixa: '0 a 4 anos', homens: 700, mulheres: 750 });
    expect(corpo.piramide.faixas.at(-1)).toEqual({ faixa: '80 anos ou mais', homens: 185, mulheres: 290 });
  });

  it('com dois lotes publicados de anos diferentes, vale o de maior ano', async () => {
    const lote2027 = ibgePopulacao();
    lote2027.meta.ano = 2027;
    lote2027.registros.push(valorIbge('6579', '9324', 'Pessoas', '2027', '24600'));
    lote2027.meta.totalHits = lote2027.meta.capturados = lote2027.meta.idsUnicos = lote2027.registros.length;
    const [consulta] = criarImportadorIbge({ cliente: { agregado: async () => [] } }).consultas;
    await gravarSnapshot(consulta!, lote2027, 'arquivo', new RepositorioDeLotesPostgres());

    const { corpo } = await pedir();

    expect(corpo.populacao.serie.at(-1)).toEqual({ ano: 2027, populacao: 24600, tipo: 'estimativa' });
    expect(corpo.populacao.serie.filter((p: Ponto) => p.ano === 2026)).toHaveLength(1);
  });

  it('sem coleta do IBGE responde 200 dizendo o que falta', async () => {
    await popularCenario({ ibgePopulacao: null, ibgeCenso: null, ibgePib: null });

    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo).toEqual({ disponivel: false, faltando: ['ibge_populacao', 'ibge_censo', 'ibge_pib'] });
  });

  it('faltando só uma consulta, responde indisponível citando qual', async () => {
    await popularCenario({ ibgePib: null });

    const { corpo } = await pedir();

    expect(corpo).toEqual({ disponivel: false, faltando: ['ibge_pib'] });
  });

  it('método diferente de GET é 404', async () => {
    const { status, corpo } = await pedir('POST');

    expect(status).toBe(404);
    expect(corpo).toEqual({ erro: 'Rota não encontrada' });
  });
});

describe('GET /api/municipio: comparação', () => {
  it('Santa Catarina e Brasil trazem os indicadores calculados dos próprios dados', async () => {
    const { corpo } = await pedir();

    expect(corpo.comparacao.santaCatarina).toEqual({
      densidade: 75.5,
      urbana: 85,
      ate14Anos: 10,
      aPartirDe60Anos: 30,
      crescimento: 25,
      rendimentoMedio: 2200,
      rendimentoMediano: 1500,
      // 6.000.000 mil reais ÷ 100.000 moradores do Censo 2022, o mais próximo antes de 2023.
      pibPerCapita: 60000,
    });
    expect(corpo.comparacao.brasil).toEqual({
      densidade: 24,
      urbana: 90,
      ate14Anos: 20,
      aPartirDe60Anos: 20,
      crescimento: 25,
      rendimentoMedio: 1600,
      rendimentoMediano: 1000,
      pibPerCapita: 50000,
    });
  });

  it('Orleans entra com a mesma conta, e o rendimento é o da tabela', async () => {
    const { corpo } = await pedir();

    expect(corpo.comparacao.orleans.densidade).toBe(42.72);
    expect(corpo.comparacao.orleans.urbana).toBe(63.83);
    expect(corpo.comparacao.orleans.rendimentoMedio).toBe(2000.5);
    // 23.500 no Censo 2022 sobre 21.000 no de 2010.
    expect(corpo.comparacao.orleans.crescimento).toBe(11.9);
  });

  it('o ano do PIB é o mesmo nos três lugares, e os anos do Censo vêm na resposta', async () => {
    const { corpo } = await pedir();

    expect(corpo.comparacao.anoDoPib).toBe(2023);
    expect(corpo.comparacao.anoDoCenso).toBe(2022);
    expect(corpo.comparacao.anoDoCensoAnterior).toBe(2010);
  });

  it.each([
    ['só Santa Catarina', ['42']],
    ['Santa Catarina e o Brasil, mas não Orleans', ['42', '1']],
  ])('ano de PIB que %s já tem fica fora: os três lugares usam o mesmo ano', async (_quem, lugares) => {
    await popularCenario({
      ibgeComparacao: ibgeComparacao(
        lugares.map((lugar) => valorIbge('5938', '37', 'Mil Reais', '2024', '60000000', '', lugar)),
      ),
    });

    const { corpo } = await pedir();

    expect(corpo.comparacao.anoDoPib).toBe(2023);
    expect(corpo.comparacao.santaCatarina.pibPerCapita).toBe(60000);
  });

  it('ano de PIB que Orleans e Santa Catarina já têm, mas o Brasil não, fica fora', async () => {
    await popularCenario({
      ibgePib: snapshot(900103, [...ibgePib().registros, valorIbge('5938', '37', 'Mil Reais', '2024', '1500000')], {
        ano: ANO_DA_COLETA_IBGE,
      }),
      ibgeComparacao: ibgeComparacao([valorIbge('5938', '37', 'Mil Reais', '2024', '60000000', '', '42')]),
    });

    const { corpo } = await pedir();

    expect(corpo.pib.serie.at(-1).ano).toBe(2024);
    expect(corpo.comparacao.anoDoPib).toBe(2023);
  });

  it('as linhas da comparação não entram no retrato de Orleans', async () => {
    const { corpo } = await pedir();

    expect(corpo.territorio.densidade).toBe(42.72);
    expect(corpo.populacao.serie.at(-1)).toEqual({ ano: 2026, populacao: 24400, tipo: 'estimativa' });
  });

  it('sem a coleta da comparação, o retrato continua disponível, com a comparação nula', async () => {
    await popularCenario({ ibgeComparacao: null });

    const { corpo } = await pedir();

    expect(corpo.disponivel).toBe(true);
    expect(corpo.comparacao).toBeNull();
  });

  it('sem o retrato de Orleans, a comparação sozinha não torna a página disponível', async () => {
    await popularCenario({ ibgeCenso: null });

    const { corpo } = await pedir();

    expect(corpo).toEqual({ disponivel: false, faltando: ['ibge_censo'] });
  });
});
