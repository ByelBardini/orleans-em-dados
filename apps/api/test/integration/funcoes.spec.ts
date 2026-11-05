import type { FastifyInstance } from 'fastify';
import { funcoesSchema, funcoesSerieSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { despesa, siconfiFuncoes, snapshot } from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';

let app: FastifyInstance;

const pedir = async (url: string) => {
  const resposta = await app.inject({ method: 'GET', url });
  return { status: resposta.statusCode, corpo: resposta.json() };
};
const do2025 = () => pedir('/api/funcoes?ano=2025');

type Funcao = { codigo: string; empenhado: number; subfuncoes: { codigo: string; nome: string }[] };
const funcao = (corpo: { funcoes: Funcao[] }, codigo: string) => corpo.funcoes.find((f) => f.codigo === codigo);

beforeAll(async () => {
  app = criarApp();
  await app.ready();
});
beforeEach(() => popularCenario());
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/funcoes', () => {
  it('responde pelo schema, com fonte, anexo, URL e data de coleta', async () => {
    const { status, corpo } = await do2025();

    expect(status).toBe(200);
    expect(funcoesSchema.safeParse(corpo).error?.issues).toBeUndefined();
    expect(corpo.meta).toMatchObject({
      fonte: 'SICONFI — Tesouro Nacional',
      consultaNome: 'DCA Anexo I-E — Despesas por Função',
      coletadoEm: '2025-03-01T12:00:00.000Z',
    });
  });

  it('total fica sem a Legislativa, e a soma das funções é igual ao total em cada etapa', async () => {
    const { corpo } = await do2025();

    expect(corpo.total).toEqual({ empenhado: 195000, liquidado: 120000, pago: 100000 });
    expect(corpo.funcoes.map((f: Funcao) => f.empenhado)).toEqual([15000, 53000, 127000]);
  });

  it('Legislativa sai em `camara`, fora de `funcoes`', async () => {
    const { corpo } = await do2025();

    expect(corpo.camara).toMatchObject({
      codigo: '01',
      nome: 'Legislativa',
      empenhado: 25000,
      liquidado: 25000,
      pago: 20000,
    });
    expect(funcao(corpo, '01')).toBeUndefined();
  });

  it('participação é calculada sobre o total sem a Câmara, por etapa', async () => {
    const { corpo } = await do2025();

    expect(funcao(corpo, '12')).toMatchObject({
      nome: 'Educação',
      participacao: { empenhado: 27.18, liquidado: 44.17, pago: 53 },
    });
    expect(funcao(corpo, '10')).toMatchObject({ participacao: { empenhado: 7.69, liquidado: 0, pago: 0 } });
  });

  it('etapas nunca são somadas entre si: cada função traz as três separadas', async () => {
    const { corpo } = await do2025();

    expect(funcao(corpo, '15')).toMatchObject({ empenhado: 127000, liquidado: 67000, pago: 47000 });
  });

  it('subfunções vêm na função, incluindo Demais Subfunções, sem as colunas de restos a pagar', async () => {
    const { corpo } = await do2025();

    expect(funcao(corpo, '12')?.subfuncoes).toEqual([
      { codigo: '12.361', nome: 'Ensino Fundamental', empenhado: 50000, liquidado: 50000, pago: 50000 },
      { codigo: 'FU12', nome: 'Demais Subfunções', empenhado: 3000, liquidado: 3000, pago: 3000 },
    ]);
  });

  it('por morador usa populacaoDoAno, e a resposta diz o divisor', async () => {
    const { corpo } = await do2025();

    expect(corpo.divisor).toEqual({ ano: 2025, populacao: 24200, tipo: 'estimativa' });
    // 195.000 / 24.200
    expect(corpo.porMorador.empenhado).toBe(8.06);
    // 15.000 / 24.200
    expect(funcao(corpo, '10')).toMatchObject({ porMorador: { empenhado: 0.62 } });
  });

  it('ano sem estimativa usa o anterior mais próximo como divisor', async () => {
    await popularCenario({ siconfiFuncoes: [siconfiFuncoes({ ano: 2023 })] });

    const { corpo } = await pedir('/api/funcoes?ano=2023');

    expect(corpo.divisor).toEqual({ ano: 2022, populacao: 23500, tipo: 'censo' });
  });

  it('sem IBGE, porMorador e divisor são nulos, e o resto continua', async () => {
    await popularCenario({ ibgePopulacao: null });

    const { status, corpo } = await do2025();

    expect(status).toBe(200);
    expect(corpo.divisor).toBeNull();
    expect(corpo.porMorador).toBeNull();
    expect(funcao(corpo, '10')).toMatchObject({ porMorador: null });
    expect(corpo.total.empenhado).toBe(195000);
  });

  it('ano que fecha com o TCE-SC é `conferido`, sem diferença', async () => {
    const { corpo } = await do2025();

    expect(corpo.conferencia).toBe('conferido');
    expect(corpo.diferenca).toBeNull();
  });

  it('ano sem coleta do TCE-SC é `sem_tce`, com o total presente', async () => {
    await popularCenario({ siconfiFuncoes: [siconfiFuncoes({ ano: 2023 })] });

    const { corpo } = await pedir('/api/funcoes?ano=2023');

    expect(corpo.conferencia).toBe('sem_tce');
    expect(corpo.diferenca).toBeNull();
    expect(corpo.total.empenhado).toBe(195000);
  });

  it('ano com diferença não é `conferido` e traz a diferença de cada fonte', async () => {
    await popularCenario({
      siconfiFuncoes: [
        siconfiFuncoes({
          contas: {
            'Despesas Exceto Intraorçamentárias': ['220010.00', '145000.00', '120000.00'],
            '15 - Urbanismo': ['127010.00', '67000.00', '47000.00'],
          },
        }),
      ],
    });

    const { corpo } = await do2025();

    expect(corpo.conferencia).toBe('diferenca');
    expect(corpo.diferenca.total.etapas[0]).toEqual({
      etapa: 'empenhado',
      dca: 195010,
      tce: 195000,
      diferenca: 10,
      maior: 'dca',
    });
    expect(corpo.diferenca.legislativa.estado).toBe('conferido');
  });

  it('função 12 igual à soma das ações da Betha sai com a conferência da Educação, sem diferença', async () => {
    const { corpo } = await do2025();

    expect(corpo.conferenciaEducacao).toBe('conferido');
    expect(corpo.diferencaEducacao).toBeNull();
  });

  it('um centavo a menos na Betha põe a Educação em diferença, com a etapa, sem mexer na conferência do total', async () => {
    await popularCenario({
      despesas: snapshot(57170, [
        despesa(
          '728:1',
          '33903000000000',
          { numero: '54', nome: 'Manutenção do Ensino Fundamental' },
          0,
          53000,
          52999.99,
          53000,
        ),
      ]),
    });

    const { corpo } = await do2025();

    expect(corpo.conferenciaEducacao).toBe('diferenca');
    expect(corpo.diferencaEducacao[1]).toEqual({
      etapa: 'liquidado',
      dca: 53000,
      betha: 52999.99,
      diferenca: 0.01,
      maior: 'dca',
    });
    expect(corpo.diferencaEducacao[0].maior).toBeNull();
  });

  it('ano sem coleta da Betha fica sem_betha na Educação', async () => {
    await popularCenario({ siconfiFuncoes: [siconfiFuncoes({ ano: 2023 })] });

    const { corpo } = await pedir('/api/funcoes?ano=2023');

    expect(corpo.conferenciaEducacao).toBe('sem_betha');
    expect(corpo.diferencaEducacao).toBeNull();
  });

  it.each([
    ['/api/funcoes?ano=2019', 'Sem despesa por função para 2019'],
    ['/api/funcoes?ano=abc', 'Sem despesa por função para abc'],
    ['/api/funcoes', 'Sem despesa por função para null'],
  ])('%s responde 404 com a mensagem', async (url, erro) => {
    const { status, corpo } = await pedir(url);

    expect(status).toBe(404);
    expect(corpo).toEqual({ erro });
  });
});

describe('GET /api/funcoes/serie', () => {
  beforeEach(() =>
    popularCenario({
      siconfiFuncoes: [siconfiFuncoes({ ano: 2018 }), siconfiFuncoes({ ano: 2024 }), siconfiFuncoes()],
    }),
  );

  it('responde pelo schema, com os anos em ordem e os valores rotulados como nominais', async () => {
    const { status, corpo } = await pedir('/api/funcoes/serie');

    expect(status).toBe(200);
    expect(funcoesSerieSchema.safeParse(corpo).error?.issues).toBeUndefined();
    expect(corpo.valores).toBe('nominais');
    expect(corpo.anos.map((a: { ano: number }) => a.ano)).toEqual([2018, 2024, 2025]);
  });

  it('cada ano traz a participação de cada função e o próprio nível da conferência', async () => {
    const { corpo } = await pedir('/api/funcoes/serie');

    expect(corpo.anos[0]).toMatchObject({ ano: 2018, conferencia: 'sem_tce' });
    expect(corpo.anos[2]).toMatchObject({
      ano: 2025,
      conferencia: 'conferido',
      total: { empenhado: 195000 },
      camara: { empenhado: 25000 },
    });
    expect(funcao(corpo.anos[2], '12')).toMatchObject({ empenhado: 53000, participacao: { empenhado: 27.18 } });
    expect(funcao(corpo.anos[2], '01')).toBeUndefined();
  });

  it('cada ano traz a conferência da Educação: sem a Betha, sem_betha', async () => {
    const { corpo } = await pedir('/api/funcoes/serie');

    expect(corpo.anos[0]).toMatchObject({ ano: 2018, conferenciaEducacao: 'sem_betha' });
    expect(corpo.anos[2]).toMatchObject({ ano: 2025, conferenciaEducacao: 'conferido' });
  });

  it('sem coleta, a série é vazia', async () => {
    await popularCenario({ siconfiFuncoes: [] });

    const { status, corpo } = await pedir('/api/funcoes/serie');

    expect(status).toBe(200);
    expect(corpo).toEqual({ valores: 'nominais', anos: [] });
  });
});
