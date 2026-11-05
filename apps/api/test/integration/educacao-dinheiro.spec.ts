import type { FastifyInstance } from 'fastify';
import { educacaoDinheiroSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { financa, siopeAnexo8, siopeIndicadoresValores } from '../../../../packages/importadores/fixtures/src/educacao';
import {
  despesa,
  despesas,
  PREFEITURA_TCE,
  receita,
  receitas,
  receitaTce,
  siconfiFuncoes,
  siconfiIndices,
  snapshot,
  tcescReceitas,
} from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';

let app: FastifyInstance;

const pedir = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/dinheiro' });
  return { status: resposta.statusCode, corpo: educacaoDinheiroSchema.parse(resposta.json()) };
};

const baixarCsv = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/dinheiro.csv' });
  return { resposta, linhas: resposta.body.split('\r\n') };
};

const doAno = <T extends { ano: number }>(anos: readonly T[] | undefined, ano: number) =>
  anos?.find((a) => a.ano === ano);

// As ações somam 650.000,00; a DCA abre a mesma função 12 nas subfunções: 310.000 + 300.000 + 40.000.
const ACAO = (id: string, natureza: string, nome: string, v: number) =>
  despesa(id, natureza, { numero: id.slice(-4), nome }, v, v, v, v);
const FUNDAMENTAL = 'Manutenção do Ensino Fundamental';
const despesasDaEducacao = () =>
  snapshot(57170, [
    ...despesas().registros,
    ACAO('728:4001', '31900000000000', FUNDAMENTAL, 147000),
    ACAO('728:4002', '31900000000000', 'Manutenção do Ensino Infantil', 300000),
    ACAO('728:4003', '33903300000000', 'Manutenção do Transporte Escolar', 100000),
    ACAO('728:4004', '33903000000000', 'Manutenção da Merenda Escolar', 40000),
    ACAO(
      '728:4005',
      '44905100000000',
      'Aquisição de Terreno, Construção, Ampliação e Reforma da Rede Física - Ensino Fundamental',
      10000,
    ),
  ]);
const dcaDaEducacao = (ano = 2025) =>
  siconfiFuncoes({
    ano,
    contas: {
      'Despesas Exceto Intraorçamentárias': ['817000.00', '742000.00', '717000.00'],
      '12 - Educação': ['650000.00', '650000.00', '650000.00'],
      '12.361 - Ensino Fundamental': ['310000.00', '310000.00', '310000.00'],
      '12.365 - Educação Infantil': ['300000.00', '300000.00', '300000.00'],
      'FU12 - Demais Subfunções': ['40000.00', '40000.00', '40000.00'],
    },
  });

// Dezembro nas duas fontes fecha o exercício. Cada linha: id, rubrica da Betha, código do TCE-SC, nome e valor.
type Natureza = readonly [string, string, string, string, number];
const NATUREZAS: readonly Natureza[] = [
  ['501', '17515001000000', '1.7.5.1.50.0.1', 'Fundeb (exemplo)', 16500000],
  ['502', '17155201000000', '1.7.1.5.52.0.1', 'VAAR (exemplo)', 7000],
  ['503', '17245101010000', '1.7.2.4.51.0.1', 'Transporte do Estado (exemplo)', 30000],
  ['504', '17145301000000', '1.7.1.4.53.0.1', 'PNATE (exemplo)', 10000],
  ['505', '17145201000000', '1.7.1.4.52.0.1', 'PNAE (exemplo)', 8000],
];
const comValor = (id: string, v: number): readonly Natureza[] =>
  NATUREZAS.map((l) => (l[0] === id ? [l[0], l[1], l[2], l[3], v] : l));

const receitasFechadas = (linhas: readonly Natureza[] = NATUREZAS) =>
  snapshot(57153, [
    ...receitas().registros,
    ...linhas.map(([id, rubrica, , nome, v]) => receita(`728:${id}`, rubrica, nome, 12, v, v)),
  ]);
const deducaoDoFundeb = (v: string) => ({
  ...receitaTce(PREFEITURA_TCE, '1.7.2.1.50.0.1', 'Cota-parte do ICMS', 'dez', v),
  id: 'deducao-fundeb',
  descricaotipodeducaoreceita: 'FUNDEB',
});
const tceFechado = (
  linhas: readonly Natureza[] = NATUREZAS,
  { deducao = '-15000000.00', extras = [] }: { deducao?: string; extras?: ReturnType<typeof receitaTce>[] } = {},
) =>
  snapshot(900001, [
    ...tcescReceitas().registros,
    ...linhas.map(([, , codigo, nome, v]) => receitaTce(PREFEITURA_TCE, codigo, nome, 'dez', v.toFixed(2))),
    deducaoDoFundeb(deducao),
    ...extras,
  ]);

const exercicioFechado = () =>
  popularCenario({
    receitas: receitasFechadas(),
    tcescReceitas: tceFechado(),
    despesas: despesasDaEducacao(),
    siconfiFuncoes: [dcaDaEducacao()],
  });

const anexo8DoAno = (ano: number, ...registros: ReturnType<typeof financa>[]) => snapshot(900402, registros, { ano });
const FUNDEB_DE_2020 = () => ({
  educacao: {
    siope_anexo8: [
      anexo8DoAno(2020, financa('fundeb_remuneracao', '2020', null, { percentual: '80.66' })),
      ...siopeAnexo8(),
    ],
  },
});
const comGastoNoAnexo8 = (gasto: string) => ({
  siconfiFuncoes: [dcaDaEducacao()],
  educacao: {
    siope_anexo8: [
      anexo8DoAno(
        2025,
        financa('indice_educacao', '2025', '22400000.00', { percentual: '28.00' }),
        financa('gasto_total', '2025', gasto, { recorte: 'liquidado' }),
      ),
    ],
  },
});

beforeAll(async () => {
  app = criarApp();
  await app.ready();
});
beforeEach(() => popularCenario());
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/educacao/dinheiro', () => {
  it('com todas as coletas, nada falta e os valores são nominais', async () => {
    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.disponivel).toBe(true);
    expect(corpo.faltando).toEqual([]);
    expect(corpo.valores).toBe('nominais');
  });

  describe('o mínimo de 25%', () => {
    it('o SIOPE é o número principal, ano a ano, e 2021 aparece abaixo do mínimo', async () => {
      const { corpo } = await pedir();

      expect(corpo.minimo?.anos.map((a) => [a.ano, a.percentual, a.aplicado, a.minimo])).toEqual([
        [2021, 23, 18400000, 25],
        [2024, 26, 20800000, 25],
        [2025, 28, 22400000, 25],
      ]);
    });

    it('quando o SICONFI difere, a resposta traz o valor dele', async () => {
      const { corpo } = await pedir();

      const ano = doAno(corpo.minimo?.anos, 2025);
      expect(ano?.difereDoSiconfi).toBe(true);
      expect(ano?.siconfi).toEqual({ percentual: 27.5, valor: 1500000 });
    });

    it('percentual igual e valor diferente em R$ 0,01 ainda difere', async () => {
      await popularCenario({ siconfiIndices: [siconfiIndices({ educacao: ['22400000.01', '28.00'] })] });

      const { corpo } = await pedir();

      expect(doAno(corpo.minimo?.anos, 2025)?.difereDoSiconfi).toBe(true);
    });

    it('percentual e valor iguais não diferem', async () => {
      await popularCenario({ siconfiIndices: [siconfiIndices({ educacao: ['22400000.00', '28.00'] })] });

      const { corpo } = await pedir();

      expect(doAno(corpo.minimo?.anos, 2025)?.difereDoSiconfi).toBe(false);
    });

    it('ano sem o RREO: não há com que comparar, e não é diferença', async () => {
      const { corpo } = await pedir();

      const ano = doAno(corpo.minimo?.anos, 2021);
      expect(ano?.siconfi).toBeNull();
      expect(ano?.difereDoSiconfi).toBe(false);
    });

    it('2017 do RREO, sem SIOPE, não entra na série', async () => {
      await popularCenario({ siconfiIndices: [siconfiIndices({ ano: 2017 }), siconfiIndices()] });

      const { corpo } = await pedir();

      expect(corpo.minimo?.anos.map((a) => a.ano)).toEqual([2021, 2024, 2025]);
    });

    it('o que o Anexo 8 de 2023 registra sobre 2021 vem à parte', async () => {
      await popularCenario({
        educacao: {
          siope_anexo8: [
            ...siopeAnexo8(),
            anexo8DoAno(
              2023,
              financa('emenda_119', '2023', '1000000.00', { recorte: 'diferenca_a_menor_2021' }),
              financa('emenda_119', '2023', '1200000.00', { recorte: 'complementado_em_2022' }),
            ),
          ],
        },
      });

      const { corpo } = await pedir();

      expect(corpo.minimo?.emenda119).toEqual({ diferencaEm2021: 1000000, complementadoEm2022: 1200000 });
    });

    it('sem o registro da Emenda 119, o campo é nulo', async () => {
      const { corpo } = await pedir();

      expect(corpo.minimo?.emenda119).toBeNull();
    });

    it('sem o Anexo 8, os blocos do SIOPE ficam nulos e o gasto segue', async () => {
      await popularCenario({ educacao: { siope_anexo8: null } });

      const { corpo } = await pedir();

      expect(corpo.faltando).toEqual(['siope_anexo8']);
      expect(corpo.minimo).toBeNull();
      expect(corpo.fundebRemuneracao).toBeNull();
      expect(corpo.contaDoFundeb).toBeNull();
      expect(corpo.gasto).not.toBeNull();
    });
  });

  describe('Fundeb na remuneração', () => {
    it('o mínimo é de 60% em 2020 e de 70% depois', async () => {
      await popularCenario(FUNDEB_DE_2020());

      const { corpo } = await pedir();

      expect(corpo.fundebRemuneracao?.anos.map((a) => [a.ano, a.minimo])).toEqual([
        [2020, 60],
        [2021, 70],
        [2024, 70],
        [2025, 70],
      ]);
    });

    it('2020 só tem o percentual: o aplicado é nulo, nunca zero', async () => {
      await popularCenario(FUNDEB_DE_2020());

      const { corpo } = await pedir();

      expect(doAno(corpo.fundebRemuneracao?.anos, 2020)).toMatchObject({ percentual: 80.66, aplicado: null });
    });

    it('sem valor do SIOPE, a comparação fica no percentual', async () => {
      await popularCenario({
        ...FUNDEB_DE_2020(),
        siconfiIndices: [siconfiIndices({ ano: 2020, fundeb: ['8000000.00', '80.66'] }), siconfiIndices()],
      });

      const { corpo } = await pedir();

      expect(doAno(corpo.fundebRemuneracao?.anos, 2020)?.difereDoSiconfi).toBe(false);
    });
  });

  describe('gasto', () => {
    it('com a Betha igual nas três etapas, o exercício sai conferido; sem ela, fica sem_betha', async () => {
      await popularCenario({
        despesas: despesasDaEducacao(),
        siconfiFuncoes: [siconfiFuncoes({ ano: 2018 }), dcaDaEducacao()],
      });

      const { corpo } = await pedir();

      expect(corpo.gasto?.anos.map((a) => [a.ano, a.conferencia])).toEqual([
        [2018, 'sem_betha'],
        [2025, 'conferido'],
      ]);
    });

    it('um valor a menos na Betha sai como diferenca', async () => {
      await popularCenario({ despesas: despesasDaEducacao(), siconfiFuncoes: [siconfiFuncoes()] });

      const { corpo } = await pedir();

      expect(doAno(corpo.gasto?.anos, 2025)?.conferencia).toBe('diferenca');
    });

    it('por morador divide a função 12 pela população do ano, e o divisor vai junto', async () => {
      await exercicioFechado();

      const { corpo } = await pedir();

      const ano = doAno(corpo.gasto?.anos, 2025);
      // 650.000,00 ÷ 24.200
      expect(ano?.porMorador).toBe(26.86);
      expect(ano?.divisor).toEqual({ ano: 2025, populacao: 24200, tipo: 'estimativa' });
    });

    it('ano sem população própria usa o ponto anterior mais próximo', async () => {
      await popularCenario({ siconfiFuncoes: [siconfiFuncoes({ ano: 2023 }), siconfiFuncoes()] });

      const { corpo } = await pedir();

      const ano = doAno(corpo.gasto?.anos, 2023);
      expect(ano?.divisor).toEqual({ ano: 2022, populacao: 23500, tipo: 'censo' });
      // 53.000,00 ÷ 23.500
      expect(ano?.porMorador).toBe(2.26);
    });

    it('sem população, por morador é nulo e o gasto segue', async () => {
      await popularCenario({ ibgePopulacao: null });

      const { corpo } = await pedir();

      expect(corpo.faltando).toEqual(['ibge_populacao']);
      expect(doAno(corpo.gasto?.anos, 2025)).toMatchObject({ liquidado: 53000, divisor: null, porMorador: null });
    });

    it('a participação tira a Câmara do total', async () => {
      await exercicioFechado();

      const { corpo } = await pedir();

      // 650.000 ÷ (650.000 + 0 + 67.000), sem os 25.000 da Legislativa
      expect(doAno(corpo.gasto?.anos, 2025)?.participacao).toBe(90.7);
    });

    it('a composição é subfunção ÷ função 12, em todas as etapas com linha na DCA', async () => {
      await exercicioFechado();

      const { corpo } = await pedir();

      expect(doAno(corpo.gasto?.anos, 2025)?.etapas).toEqual([
        { chave: 'fundamental', valor: 310000, percentual: 47.7 },
        { chave: 'infantil', valor: 300000, percentual: 46.2 },
        { chave: 'outras', valor: 40000, percentual: 6.2 },
      ]);
    });

    it('a nota sobre as etapas traz transporte e merenda do último exercício com a Betha', async () => {
      await exercicioFechado();

      const { corpo } = await pedir();

      expect(corpo.gasto?.acoesNasEtapas).toEqual({ ano: 2025, transporte: 100000, merenda: 40000 });
    });

    it('sem as duas ações na Betha, a nota fica sem valores, nunca com zero', async () => {
      const { corpo } = await pedir();

      expect(corpo.gasto?.acoesNasEtapas).toEqual({ ano: 2025, transporte: null, merenda: null });
    });

    it('Anexo 8 com o mesmo gasto ao centavo fica marcado', async () => {
      await popularCenario(comGastoNoAnexo8('650000.00'));

      const { corpo } = await pedir();

      expect(doAno(corpo.gasto?.anos, 2025)).toMatchObject({ igualAoAnexo8: true, anexo8: 650000 });
    });

    it('Anexo 8 com R$ 0,01 de diferença não fica marcado', async () => {
      await popularCenario(comGastoNoAnexo8('650000.01'));

      const { corpo } = await pedir();

      expect(doAno(corpo.gasto?.anos, 2025)).toMatchObject({ igualAoAnexo8: false, anexo8: 650000.01 });
    });

    it('sem a DCA, o bloco é nulo e a consulta aparece em "faltando"', async () => {
      await popularCenario({ siconfiFuncoes: [] });

      const { corpo } = await pedir();

      expect(corpo.gasto).toBeNull();
      expect(corpo.faltando).toEqual(['siconfi_funcoes']);
    });
  });

  describe('ações e natureza', () => {
    const comAsAcoes = () => popularCenario({ despesas: despesasDaEducacao(), siconfiFuncoes: [dcaDaEducacao()] });

    it('soma por nome de ação, com número de ação diferente, em ordem de valor', async () => {
      await comAsAcoes();

      const { corpo } = await pedir();

      expect(doAno(corpo.acoes?.anos, 2025)?.acoes.slice(0, 2)).toEqual([
        { nome: 'Manutenção do Ensino Infantil', liquidado: 300000 },
        // 53.000 + 147.000, em duas naturezas e dois números de ação
        { nome: FUNDAMENTAL, liquidado: 200000 },
      ]);
    });

    it('ação de outro nome fica fora, e o total é o das ações de educação', async () => {
      await comAsAcoes();

      const { corpo } = await pedir();

      const ano = doAno(corpo.acoes?.anos, 2025);
      expect(ano?.acoes.map((a) => a.nome)).not.toContain('Obras urbanas (exemplo)');
      expect(ano?.total).toBe(650000);
    });

    it('natureza é o grupo da despesa: 31, 33 e 44', async () => {
      await comAsAcoes();

      const { corpo } = await pedir();

      expect(doAno(corpo.acoes?.anos, 2025)?.naturezas).toEqual([
        { chave: 'pessoal', liquidado: 447000, percentual: 68.8 },
        { chave: 'custeio', liquidado: 193000, percentual: 29.7 },
        { chave: 'investimento', liquidado: 10000, percentual: 1.5 },
      ]);
    });

    it('natureza de outro grupo fica em "outras", sem sumir da conta', async () => {
      await popularCenario({ despesas: snapshot(57170, [ACAO('728:4010', '46900000000000', FUNDAMENTAL, 1000)]) });

      const { corpo } = await pedir();

      expect(doAno(corpo.acoes?.anos, 2025)?.naturezas).toEqual([
        { chave: 'outras', liquidado: 1000, percentual: 100 },
      ]);
    });

    it('o total é marcado conferido quando a função 12 fecha com a Betha', async () => {
      await comAsAcoes();

      const { corpo } = await pedir();

      expect(doAno(corpo.acoes?.anos, 2025)?.totalConferido).toBe(true);
    });

    it('o total não é marcado conferido quando a função 12 difere da Betha', async () => {
      await popularCenario({ despesas: despesasDaEducacao(), siconfiFuncoes: [siconfiFuncoes()] });

      const { corpo } = await pedir();

      expect(doAno(corpo.acoes?.anos, 2025)?.totalConferido).toBe(false);
    });
  });

  describe('repasses', () => {
    it('saem as rubricas de repasse da receita conferida, do maior para o menor', async () => {
      await exercicioFechado();

      const { corpo } = await pedir();

      expect(doAno(corpo.repasses?.anos, 2025)?.rubricas).toEqual([
        { rubrica: '17515001000000', nome: 'Fundeb', valor: 16500000 },
        { rubrica: '17245101010000', nome: 'Transporte escolar, repasse do Estado', valor: 30000 },
        { rubrica: '17145301000000', nome: 'PNATE, transporte escolar', valor: 10000 },
        { rubrica: '17145201000000', nome: 'PNAE, alimentação escolar', valor: 8000 },
        { rubrica: '17155201000000', nome: 'Complementação da União ao Fundeb, VAAR', valor: 7000 },
      ]);
    });

    it('rubrica com diferença entre as fontes aparece sem número', async () => {
      const PETI: Natureza = ['506', '17149901040000', '1.7.1.4.99.0.1', 'PETI (exemplo)', 7000];
      await popularCenario({
        receitas: receitasFechadas([...NATUREZAS, PETI]),
        tcescReceitas: tceFechado(NATUREZAS, {
          extras: [receitaTce(PREFEITURA_TCE, '1.7.1.4.99.0.1', 'PETI (exemplo)', 'dez', '6000.00')],
        }),
      });

      const { corpo } = await pedir();

      expect(doAno(corpo.repasses?.anos, 2025)?.rubricas.find((r) => r.rubrica === '17149901040000')).toEqual({
        rubrica: '17149901040000',
        nome: 'Programa Escola em Tempo Integral',
        valor: null,
      });
    });

    it('receita de outra rubrica, como o rendimento de aplicação, não é repasse', async () => {
      const RENDIMENTO: Natureza = ['507', '13210101010100', '1.3.2.1.01.0.1', 'Rendimento (exemplo)', 500];
      await popularCenario({
        receitas: receitasFechadas([...NATUREZAS, RENDIMENTO]),
        tcescReceitas: tceFechado([...NATUREZAS, RENDIMENTO]),
      });

      const { corpo } = await pedir();

      expect(doAno(corpo.repasses?.anos, 2025)?.rubricas.map((r) => r.rubrica)).not.toContain('13210101010100');
    });

    it('exercício em que o TCE-SC não chegou a dezembro não sai, e não é coleta faltando', async () => {
      const { corpo } = await pedir();

      expect(corpo.repasses).toBeNull();
      expect(corpo.faltando).toEqual([]);
    });

    it('a equivalência é repasse ÷ gasto da ação', async () => {
      await exercicioFechado();

      const { corpo } = await pedir();

      expect(doAno(corpo.repasses?.anos, 2025)?.equivalencias).toEqual([
        // (30.000 + 10.000) ÷ 100.000
        { chave: 'transporte', gasto: 100000, repasses: 40000, percentual: 40 },
        // 8.000 ÷ 40.000
        { chave: 'merenda', gasto: 40000, repasses: 8000, percentual: 20 },
      ]);
    });

    it('a soma dos repasses da equivalência é exata em centavos', async () => {
      const linhas = NATUREZAS.map((l): Natureza => {
        if (l[0] === '503') return [l[0], l[1], l[2], l[3], 0.1];
        return l[0] === '504' ? [l[0], l[1], l[2], l[3], 0.2] : l;
      });
      await popularCenario({
        receitas: receitasFechadas(linhas),
        tcescReceitas: tceFechado(linhas),
        despesas: despesasDaEducacao(),
        siconfiFuncoes: [dcaDaEducacao()],
      });

      const { corpo } = await pedir();

      expect(doAno(corpo.repasses?.anos, 2025)?.equivalencias[0]?.repasses).toBe(0.3);
    });

    it('com um repasse fora do conferido, a equivalência fica sem número', async () => {
      await popularCenario({
        receitas: receitasFechadas(),
        tcescReceitas: tceFechado(comValor('504', 9000)),
        despesas: despesasDaEducacao(),
        siconfiFuncoes: [dcaDaEducacao()],
      });

      const { corpo } = await pedir();

      expect(doAno(corpo.repasses?.anos, 2025)?.equivalencias.find((e) => e.chave === 'transporte')).toEqual({
        chave: 'transporte',
        gasto: 100000,
        repasses: null,
        percentual: null,
      });
    });
  });

  describe('conta do Fundeb', () => {
    it('recebido − contribuição fecha com o resultado: a diferença é zero', async () => {
      await exercicioFechado();

      const { corpo } = await pedir();

      expect(doAno(corpo.contaDoFundeb?.anos, 2025)).toEqual({
        ano: 2025,
        recebido: 16500000,
        contribuicao: 15000000,
        contribuicaoConferida: true,
        conta: 1500000,
        resultado: 1500000,
        diferenca: 0,
      });
    });

    it('quando não fecha, a diferença sai em centavos e com sinal', async () => {
      const linhas = comValor('501', 16500100.1);
      await popularCenario({ receitas: receitasFechadas(linhas), tcescReceitas: tceFechado(linhas) });

      const { corpo } = await pedir();

      expect(doAno(corpo.contaDoFundeb?.anos, 2025)).toMatchObject({ conta: 1500100.1, diferenca: -100.1 });
    });

    it('resultado maior que a conta dá diferença positiva', async () => {
      const linhas = comValor('501', 16499999.99);
      await popularCenario({ receitas: receitasFechadas(linhas), tcescReceitas: tceFechado(linhas) });

      const { corpo } = await pedir();

      expect(doAno(corpo.contaDoFundeb?.anos, 2025)).toMatchObject({ conta: 1499999.99, diferenca: 0.01 });
    });

    it('contribuição diferente da dedução do TCE-SC não fica conferida', async () => {
      await popularCenario({
        receitas: receitasFechadas(),
        tcescReceitas: tceFechado(NATUREZAS, { deducao: '-14999999.99' }),
      });

      const { corpo } = await pedir();

      expect(doAno(corpo.contaDoFundeb?.anos, 2025)?.contribuicaoConferida).toBe(false);
    });

    it('ano sem a receita conferida traz contribuição e resultado, sem conta nem diferença', async () => {
      await exercicioFechado();

      const { corpo } = await pedir();

      expect(doAno(corpo.contaDoFundeb?.anos, 2024)).toEqual({
        ano: 2024,
        recebido: null,
        contribuicao: 15000000,
        contribuicaoConferida: false,
        conta: null,
        resultado: 1500000,
        diferenca: null,
      });
    });

    it('sem contribuição, como em 2020, a conta não sai, mesmo com o recebido', async () => {
      await popularCenario({
        receitas: receitasFechadas(),
        tcescReceitas: tceFechado(),
        educacao: { siope_anexo8: [anexo8DoAno(2025, financa('fundeb_resultado', '2025', '1471934.28'))] },
      });

      const { corpo } = await pedir();

      expect(doAno(corpo.contaDoFundeb?.anos, 2025)).toMatchObject({
        recebido: 16500000,
        contribuicao: null,
        conta: null,
        resultado: 1471934.28,
        diferenca: null,
      });
    });
  });

  describe('por aluno', () => {
    it('traz infantil, fundamental e educação básica, ano a ano', async () => {
      const { corpo } = await pedir();

      expect(doAno(corpo.porAluno?.anos, 2025)).toEqual({
        ano: 2025,
        infantil: 13000,
        fundamental: 21000,
        educacaoBasica: 19000,
      });
    });

    it('educação básica de 2023 não sai, mesmo se houver registro', async () => {
      await popularCenario({
        educacao: {
          siope_indicadores_valores: [
            snapshot(900404, [financa('siope_por_aluno_educacao_basica', '2023', '32000.00')], { ano: 2023 }),
          ],
        },
      });

      const { corpo } = await pedir();

      expect(doAno(corpo.porAluno?.anos, 2023)?.educacaoBasica).toBeNull();
    });

    it('sem a coleta, o bloco é nulo', async () => {
      await popularCenario({ educacao: { siope_indicadores_valores: null } });

      const { corpo } = await pedir();

      expect(corpo.porAluno).toBeNull();
      expect(corpo.faltando).toEqual(['siope_indicadores_valores']);
    });
  });

  it('exercício em curso não aparece em bloco nenhum', async () => {
    const corrente = new Date().getFullYear();
    const periodo = String(corrente);
    await popularCenario({
      siconfiFuncoes: [siconfiFuncoes(), siconfiFuncoes({ ano: corrente })],
      educacao: {
        siope_anexo8: [
          ...siopeAnexo8(),
          anexo8DoAno(
            corrente,
            financa('indice_educacao', periodo, '100.00', { percentual: '24.49' }),
            financa('fundeb_remuneracao', periodo, '100.00', { percentual: '70.72' }),
            financa('fundeb_resultado', periodo, '100.00'),
          ),
        ],
        siope_indicadores_valores: [
          ...siopeIndicadoresValores(),
          snapshot(900404, [financa('siope_por_aluno_infantil', periodo, '100.00')], { ano: corrente }),
        ],
      },
    });

    const { corpo } = await pedir();

    const blocos = [corpo.minimo, corpo.fundebRemuneracao, corpo.gasto, corpo.contaDoFundeb, corpo.porAluno];
    expect(blocos.flatMap((b) => b?.anos.map((a) => a.ano) ?? [])).not.toContain(corrente);
  });

  it('sem nenhuma das coletas próprias, a aba responde 200 e diz o que falta, na ordem', async () => {
    await popularCenario({
      siconfiFuncoes: [],
      siconfiIndices: [],
      ibgePopulacao: null,
      educacao: { siope_anexo8: null, siope_indicadores_valores: null },
    });

    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.faltando).toEqual([
      'siope_anexo8',
      'siope_indicadores_valores',
      'siconfi_indices',
      'siconfi_funcoes',
      'ibge_populacao',
    ]);
  });
});

describe('GET /api/educacao/dinheiro.csv', () => {
  const linhaDe = (linhas: string[], inicio: string) => linhas.find((l) => l.startsWith(inicio));

  it('responde em CSV, em formato longo, com o nome da aba', async () => {
    const { resposta, linhas } = await baixarCsv();

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-disposition']).toContain('educacao-dinheiro.csv');
    expect(linhas[0]).toContain('Indicador');
  });

  it('o índice do SIOPE e o do SICONFI vêm em linhas próprias', async () => {
    const { linhas } = await baixarCsv();

    expect(linhaDe(linhas, 'indice_educacao;Orleans;municipal;;2025;')).toContain(';28;%;');
    expect(linhaDe(linhas, 'indice_educacao_siconfi;Orleans;municipal;;2025;')).toContain(';27,5;%;');
  });

  it('a conta do Fundeb sai com a diferença, com sinal', async () => {
    const linhas = comValor('501', 16500100.1);
    await popularCenario({ receitas: receitasFechadas(linhas), tcescReceitas: tceFechado(linhas) });

    const { linhas: doCsv } = await baixarCsv();

    expect(linhaDe(doCsv, 'fundeb_diferenca;Orleans;municipal;;2025;')).toContain(';-100,1;R$;');
  });

  it('sem coleta, a linha daquele bloco não aparece', async () => {
    await popularCenario({ educacao: { siope_indicadores_valores: null } });

    const { linhas } = await baixarCsv();

    expect(linhaDe(linhas, 'por_aluno')).toBeUndefined();
  });
});
