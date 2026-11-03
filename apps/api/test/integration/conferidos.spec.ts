// As rotas devolvem só o conferido, e a seção diz o que ficou de fora.
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { discrepanciasSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import {
  despesa,
  empenho,
  empenhos as empenhosPadrao,
  empenhoTce,
  FMS_TCE,
  PREFEITURA_TCE,
  receita,
  receitas as receitasPadrao,
  receitaTce,
  SAMAE_TCE,
  siconfiFuncoes,
  snapshot,
} from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';
import { pedir } from '../paridade/casos';

let app: FastifyInstance;
let base: string;
const get = async (caso: string) => pedir(base, caso);

type Natureza = { chave: string; rubrica: string; nivel: number; arrecadadoNoMes: number };
type Chave = { chave: string | number; arrecadadoNoMes: number };
type Grupo = { tipo: string; area: string; rotulo: string; total: number; itens: { valor: number; numero: number }[] };

const ACAO = { numero: '2001', nome: 'Ação (exemplo)' };
const SETOR = 'SETOR (exemplo)';
const SAMAE = '524';
const PREFEITURA = '204';
const FMS = '486';
const CAMARA = '1864';

// Exercício encerrado, com um caso de cada: duplicidade na receita, modalidade 71 na despesa,
// entidade fora da soma, registro sem par e cópia repetida.
const encerrado = () =>
  popularCenario({
    // Os totais do cenário não são os da DCA fictícia: a diferença dela tem cenário próprio.
    siconfiFuncoes: [],
    receitas: snapshot(57153, [
      // Um centavo de lado a mais em dezembro: a natureza fica em 8 dígitos.
      receita('728:101', '11125001000000', 'IPTU (exemplo)', 1, 300000, 300000, 1000000),
      receita('728:101', '11125001000000', 'IPTU (exemplo)', 12, 250000.5, 550000.5),
      // Todos os meses batem: duas linhas de 14 dígitos.
      receita('728:102', '17115101010000', 'FPM cota (exemplo)', 1, 100000.1, 100000.1, 700),
      receita('728:103', '17115101020000', 'FPM adicional (exemplo)', 1, 200000.2, 200000.2),
      // O mesmo valor em duas rubricas do mês; só a primeira existe no TCE-SC.
      receita('319:201', '17135011000000', 'SUS (exemplo)', 3, 5000, 5000),
      receita('319:202', '24145001000000', 'Convênio (exemplo)', 3, 5000, 5000),
    ]),
    tcescReceitas: snapshot(900001, [
      receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'jan', '300000.00'),
      receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'dez', '250000.25'),
      receitaTce(PREFEITURA_TCE, '1.7.1.1.51.0.1', 'FPM', 'jan', '300000.30'),
      receitaTce(FMS_TCE, '1.7.1.3.50.1.1', 'SUS', 'mar', '5000.00'),
      receitaTce(SAMAE_TCE, '1.1.1.3.03.1.1', 'Imposto retido', 'dez', '428.37'),
    ]),
    despesas: snapshot(57170, [
      // SAMAE: a linha de modalidade 71 é a diferença nas três etapas.
      despesa('2473:1', '33903900000000', ACAO, 0, 950, 850.1, 750.05),
      despesa('2473:2', '33713300000000', ACAO, 0, 100, 80, 80),
      despesa('728:1', '33903000000000', ACAO, 900, 4200, 3200, 2200),
      // FMS: diferença sem padrão, fora da soma.
      despesa('319:1', '33903900000000', ACAO, 0, 99999, 15000, 15000),
    ]),
    empenhos: snapshot(57140, [
      // Os valores de execução da Betha são outros: a lista tem de trazer os do TCE-SC.
      empenho('2473:1', 1, '2025-03-10', SETOR, 'AGUA EXEMPLO LTDA', 'Casado (exemplo)', 1000, 1, 1, 0),
      empenho('728:5', 2, '2025-03-11', SETOR, 'OBRA EXEMPLO LTDA', 'Casado (exemplo)', 4200, 2, 2, 0),
      empenho('319:1', 3, '2025-03-12', SETOR, 'LABORATORIO EXEMPLO LTDA', 'Casado (exemplo)', 14000, 3, 3, 0),
      empenho('319:2', 4, '2025-03-13', SETOR, 'LABORATORIO EXEMPLO LTDA', 'Sem execução (exemplo)', 500, 4, 4, 0),
      // Sem par e sem execução: mesmo número do registro real, com o mesmo valor.
      empenho('2473:2', 340, '2025-04-01', SETOR, 'FROTA EXEMPLO LTDA', 'Abastecimento raro', 20000, null, null, null),
      // Cópia antiga do nº 2.
      empenho('728:1', 2, '2025-03-11', SETOR, 'OBRA EXEMPLO LTDA', 'Casado (exemplo)', 4200, null, null, null),
    ]),
    tcescEmpenhos: snapshot(900002, [
      {
        ...empenhoTce(1, SAMAE, 1, '2025-03-10', 'AGUA EXEMPLO LTDA', '1000.00', '850.10', '750.05'),
        valorEmpenhado: '950.00',
      },
      empenhoTce(2, PREFEITURA, 2, '2025-03-11', 'OBRA EXEMPLO LTDA', '4200.00', '3200.00', '2200.00'),
      empenhoTce(3, FMS, 3, '2025-03-12', 'LABORATORIO EXEMPLO LTDA', '14000.00', '15000.00', '15000.00'),
      {
        ...empenhoTce(4, FMS, 4, '2025-03-13', 'LABORATORIO EXEMPLO LTDA', '500.00', '0', '0'),
        valorLiquidado: null,
        valorPago: null,
      },
      empenhoTce(5, CAMARA, 1, '2025-03-14', 'GRAFICA EXEMPLO LTDA', '25000.00', '25000.00', '20000.00'),
    ]),
  });

beforeAll(async () => {
  app = criarApp();
  base = await app.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('exercício encerrado', () => {
  beforeAll(encerrado);

  describe('/api/receitas', () => {
    it('o excedente da duplicidade não está em nenhum agregado', async () => {
      const { corpo } = await get('/api/receitas?ano=2025');
      // 300000 + 250000,25 + 300000,30 + 5000
      expect(corpo.totais.arrecadadoNoMes).toBe(855000.55);
      expect(corpo.porEntidade.find((e: Chave) => e.chave === '319').arrecadadoNoMes).toBe(5000);
      expect(corpo.porOrigem.find((o: Chave) => o.chave === '24').arrecadadoNoMes).toBe(0);
      expect(corpo.porMes.find((m: Chave) => m.chave === 3).arrecadadoNoMes).toBe(5000);
      expect(corpo.naturezas.find((n: Natureza) => n.rubrica === '24145001').arrecadadoNoMes).toBe(0);
    });

    it('o bloco de conferência fecha a conta com o total de cada fonte', async () => {
      const { corpo } = await get('/api/receitas?ano=2025');
      expect(corpo.conferencia).toEqual({
        disponivel: true,
        parcial: false,
        limites: { mesReceita: 12, dataEmpenho: '2025-03-13' },
        conferido: 855000.55,
        diferencaBetha: 5000.25,
        diferencaTce: 428.37,
        aguardandoTce: 0,
        totalBetha: 860000.8,
        totalTce: 855428.92,
      });
    });

    it('naturezas de 14 e de 8 dígitos juntas somam o conferido', async () => {
      const { corpo } = await get('/api/receitas?ano=2025');
      expect(corpo.naturezas.map((n: Natureza) => [n.rubrica, n.nivel, n.arrecadadoNoMes])).toEqual([
        ['11125001', 8, 550000.25],
        ['17115101020000', 14, 200000.2],
        ['17115101010000', 14, 100000.1],
        ['17135011000000', 14, 5000],
        ['11130311', 8, 0],
        ['24145001', 8, 0],
      ]);
      const centavos = corpo.naturezas.reduce(
        (total: number, n: Natureza) => total + Math.round(n.arrecadadoNoMes * 100),
        0,
      );
      expect(centavos).toBe(85500055);
    });

    it('o orçado continua, e é declarado fonte única', async () => {
      const { corpo } = await get('/api/receitas?ano=2025');
      expect(corpo.fonteUnica).toEqual(['orcadoAtualizado', 'orcadoDeducoes']);
      expect(corpo.totais.orcadoAtualizado).toBe(1000700);
      expect(corpo.naturezas.find((n: Natureza) => n.rubrica === '17115101010000').orcadoAtualizado).toBe(700);
      expect(corpo.naturezas.find((n: Natureza) => n.rubrica === '11125001').orcadoAtualizado).toBe(1000000);
    });

    it('recorte por entidade: agregados e conta só daquela entidade, e a comparação entre elas continua', async () => {
      const { corpo } = await get('/api/receitas?ano=2025&entidade=319');
      expect(corpo.totais.arrecadadoNoMes).toBe(5000);
      expect(corpo.porMes.map((m: Chave) => [m.chave, m.arrecadadoNoMes])).toEqual([[3, 5000]]);
      expect(corpo.porOrigem.map((o: Chave) => [o.chave, o.arrecadadoNoMes])).toEqual([
        ['17', 5000],
        ['24', 0],
      ]);
      expect(corpo.naturezas.map((n: Natureza) => n.rubrica)).toEqual(['17135011000000', '24145001']);
      expect(corpo.conferencia).toMatchObject({
        conferido: 5000,
        diferencaBetha: 5000,
        totalBetha: 10000,
        totalTce: 5000,
      });
      expect(corpo.porEntidade.map((e: Chave) => e.chave)).toContain('728');
    });

    it('entidade que não existe não tem número', async () => {
      const { corpo } = await get('/api/receitas?ano=2025&entidade=9999');
      expect(corpo.totais.arrecadadoNoMes).toBeNull();
      expect(corpo.porMes).toEqual([]);
      expect(corpo.naturezas).toEqual([]);
    });
  });

  describe('/api/receitas.csv', () => {
    it('soma igual ao JSON, linha a linha, e o cabeçalho diz conferido', async () => {
      const [{ corpo: csv }, { corpo: json }] = await Promise.all([
        get('/api/receitas.csv?ano=2025'),
        get('/api/receitas?ano=2025'),
      ]);
      const [cabecalho, ...linhas] = csv.replace('﻿', '').trim().split('\r\n');
      expect(cabecalho).toBe('Rubrica;Descrição;Entidade;Orçado atualizado;Arrecadado conferido');
      const doCsv = linhas.map((l: string) => {
        const c = l.split(';');
        return [c[0], Number((c[4] ?? '').replace(',', '.'))];
      });
      expect(doCsv).toEqual(json.naturezas.map((n: Natureza) => [n.rubrica, n.arrecadadoNoMes]));
    });
  });

  describe('/api/despesas/resumo', () => {
    it('duplicidade: a entidade fica sem as linhas retiradas, com fonte e conferida', async () => {
      const { corpo } = await get('/api/despesas/resumo?ano=2025');
      expect(corpo.porEntidade.find((e: { chave: string }) => e.chave === '2473')).toMatchObject({
        fonte: 'betha_57170',
        conferida: true,
        dataCorte: null,
        empenhado: 950,
        liquidado: 850.1,
        pago: 750.05,
      });
    });

    it('entidade não conferida não entra na soma, e sai sem número', async () => {
      const { corpo } = await get('/api/despesas/resumo?ano=2025');
      expect(corpo.totais).toEqual({ orcadoAtualizado: 900, empenhado: 5150, liquidado: 4050.1, pago: 2950.05 });
      expect(corpo.porEntidade.find((e: { chave: string }) => e.chave === '319')).toMatchObject({
        fonte: null,
        conferida: false,
        empenhado: null,
        liquidado: null,
        pago: null,
      });
    });

    it('a Câmara fica à parte, com conferida falso', async () => {
      const { corpo } = await get('/api/despesas/resumo?ano=2025');
      expect(corpo.camara).toMatchObject({ sigla: 'Câmara', fonte: 'tce', conferida: false, empenhado: 25000 });
      expect(corpo.porEntidade.map((e: { chave: string }) => e.chave)).not.toContain('1864');
    });

    it('a conta do empenhado: conferido + linhas retiradas + entidade fora = total da 57170', async () => {
      const { corpo } = await get('/api/despesas/resumo?ano=2025');
      // SAMAE: 100 de modalidade 71. FMS: 99999, a entidade inteira. Total: 950 + 100 + 4200 + 99999.
      expect(corpo.totais.empenhado).toBe(5150);
      expect(corpo.conferencia).toMatchObject({ diferencaBetha: 100099, totalBetha: 105249 });
    });

    it('a conta do recorte é só da entidade', async () => {
      const { corpo } = await get('/api/despesas/resumo?ano=2025&entidade=2473');
      expect(corpo.totais.empenhado).toBe(950);
      expect(corpo.conferencia).toMatchObject({ diferencaBetha: 100, totalBetha: 1050 });
    });

    it('recorte de entidade não conferida não tem total, e não traz a Câmara', async () => {
      const { corpo } = await get('/api/despesas/resumo?ano=2025&entidade=319');
      expect(corpo.totais).toMatchObject({ empenhado: null, liquidado: null, pago: null });
      expect(corpo.camara).toBeNull();
    });
  });

  describe('/api/despesas/empenhos', () => {
    const numeros = (corpo: { itens: { numero: number }[] }) => corpo.itens.map((i) => i.numero).sort((a, b) => a - b);

    it('registro sem par e cópia repetida somem da lista', async () => {
      const { corpo } = await get('/api/despesas/empenhos?ano=2025');
      expect(corpo.total).toBe(4);
      expect(numeros(corpo)).toEqual([1, 2, 3, 4]);
    });

    it.each(['FROTA', 'Abastecimento', '340'])('q=%s não encontra o registro retirado', async (q) => {
      const { corpo } = await get(`/api/despesas/empenhos?ano=2025&q=${q}`);
      expect(corpo.total).toBe(0);
      expect(corpo.itens).toEqual([]);
    });

    it('empenhado é o original da Betha; a execução e o líquido vêm do TCE-SC, e o saldo é a conta em NUMERIC', async () => {
      const { corpo } = await get('/api/despesas/empenhos?ano=2025&entidade=2473');
      expect(corpo.itens[0]).toMatchObject({
        numero: 1,
        empenhado: 1000,
        empenhadoLiquido: 950,
        liquidado: 850.1,
        pago: 750.05,
        saldoAPagar: 100.05,
      });
    });

    it.each([
      ['pago', [3]],
      ['apagar', [1, 2]],
      ['sem', [4]],
    ])('situacao=%s usa os valores do TCE-SC', async (situacao, esperados) => {
      const { corpo } = await get(`/api/despesas/empenhos?ano=2025&situacao=${situacao}`);
      expect(numeros(corpo)).toEqual(esperados);
    });

    it('o resumo soma só o conjunto casado, e excluidos conta quem ficou de fora', async () => {
      const { corpo } = await get('/api/despesas/empenhos/resumo?ano=2025');
      expect(corpo.totais).toMatchObject({
        quantidade: 4,
        empenhado: 19700,
        empenhadoLiquido: 19650,
        liquidado: 19050.1,
        pago: 17950.05,
        saldoAPagar: 1100.05,
        semValoresDeExecucao: 1,
        semValoresDeExecucaoValor: 500,
        comSaldoAPagar: 2,
        excluidos: 2,
        aguardandoTce: 0,
        emDiscrepancia: 2,
      });
      expect(corpo.conferencia).toEqual({ disponivel: true, parcial: false, dataCorte: null });
    });

    it('nem credor nem maiores trazem o registro retirado', async () => {
      const { corpo } = await get('/api/despesas/empenhos/resumo?ano=2025');
      const texto = JSON.stringify(corpo);
      expect(texto).not.toContain('FROTA');
      expect(texto).not.toContain('Abastecimento');
    });

    it('o CSV é o mesmo conjunto da lista, e não encontra o registro retirado', async () => {
      const { corpo: csv } = await get('/api/despesas/empenhos.csv?ano=2025');
      const [cabecalho, ...linhas] = csv.replace('﻿', '').trim().split('\r\n');
      expect(cabecalho).toBe(
        'Número;Data;Entidade;Órgão;Credor;Histórico;Empenhado;Liquidado;Pago;Saldo a pagar;Empenhado líquido',
      );
      expect(linhas.map((l: string) => Number(l.split(';')[0])).sort()).toEqual([1, 2, 3, 4]);
      expect(csv).not.toContain('FROTA');
      expect((await get('/api/despesas/empenhos.csv?ano=2025&q=FROTA')).corpo.trim().split('\r\n')).toHaveLength(1);
    });
  });

  describe('/api/discrepancias', () => {
    const doTipo = async (tipo: string, area?: string) => {
      const { corpo } = await get('/api/discrepancias?ano=2025');
      return corpo.grupos.find((g: Grupo) => g.tipo === tipo && (!area || g.area === area));
    };

    it('agrupa por tipo, com rótulo em português e a resposta validada pelo contrato', async () => {
      const { corpo, status } = await get('/api/discrepancias?ano=2025');
      expect(status).toBe(200);
      expect(discrepanciasSchema.safeParse(corpo).error).toBeUndefined();
      expect(corpo.grupos.map((g: Grupo) => [g.area, g.tipo])).toEqual([
        ['receita', 'duas_rubricas'],
        ['receita', 'so_tce'],
        ['despesa', 'despesa_duplicada'],
        ['empenho', 'empenho_sem_execucao'],
        ['empenho', 'empenho_repetido'],
        ['despesa', 'sem_causa'],
        ['receita', 'sem_causa'],
      ]);
    });

    it('cada total soma seus itens em centavos', async () => {
      const { corpo } = await get('/api/discrepancias?ano=2025');
      for (const grupo of corpo.grupos as Grupo[]) {
        const centavos = grupo.itens.reduce((t, i) => t + Math.round(i.valor * 100), 0);
        expect(Math.round(grupo.total * 100)).toBe(centavos);
      }
      expect((await doTipo('duas_rubricas'))?.total).toBe(5000);
      expect((await doTipo('so_tce'))?.total).toBe(428.37);
      expect((await doTipo('sem_causa', 'despesa'))?.total).toBe(85499);
    });

    it('o tipo interno sai com o rótulo neutro, confirmado à mão, com data e evidência', async () => {
      const grupo = await doTipo('empenho_sem_execucao');
      expect(grupo.rotulo).toBe('Registro sem execução e sem par no TCE-SC');
      expect(grupo.itens[0]).toMatchObject({
        area: 'empenho',
        situacao: 'confirmada_no_portal',
        data: '2026-11-01',
        numero: 340,
        betha: 20000,
        tce: null,
        valor: 20000,
      });
      expect(grupo.itens[0].evidencia).toContain('portal');
    });

    it('caso só calculado sai sem data nem evidência', async () => {
      const grupo = await doTipo('duas_rubricas');
      expect(grupo.itens[0]).toMatchObject({ situacao: 'calculada', data: null, evidencia: null });
    });

    it.each([
      'avisos',
      'credor',
      'historico',
      'FROTA',
      'Abastecimento',
      'fantasma',
      'irregular',
      'fraude',
      'protocolo',
      'e-SIC',
      'pedido de informação',
    ])('o corpo não contém %s', async (termo) => {
      const { corpo } = await get('/api/discrepancias?ano=2025');
      expect(JSON.stringify(corpo).toLowerCase()).not.toContain(termo.toLowerCase());
    });

    it('o resumo conta por situação e por área, sem somar áreas entre si', async () => {
      const { corpo } = await get('/api/discrepancias?ano=2025');
      expect(corpo.resumo).toEqual({
        casos: 7,
        // A fixture usa o caso real do SAMAE com outro valor: o registro manual fica rever.
        porSituacao: { confirmada_no_portal: 1, confirmada_em_parte: 0, calculada: 5, rever: 1 },
        porArea: {
          receita: { casos: 3, total: 5428.62 },
          despesa: { casos: 2, total: 85599 },
          empenho: { casos: 2, total: 24200 },
        },
      });
    });

    it.each([
      ['sem ano', '/api/discrepancias'],
      ['com ano inválido', '/api/discrepancias?ano=abc'],
      ['com ano fora de quatro dígitos', '/api/discrepancias?ano=99999'],
      ['sem coleta', '/api/discrepancias?ano=2019'],
    ])('%s responde 404 com erro', async (_nome, caso) => {
      const { status, corpo } = await get(caso);
      expect(status).toBe(404);
      expect(Object.keys(corpo)).toEqual(['erro']);
      expect(corpo.erro).toContain('Sem dados de discrepâncias');
    });
  });
});

describe('ano em curso', () => {
  const VALOR_RECEITA = 77777.77;
  const VALOR_EMPENHO = 8888.88;

  // O padrão vai até fevereiro no TCE-SC; a Betha já tem março.
  beforeAll(() =>
    popularCenario({
      receitas: snapshot(57153, [
        ...receitasPadrao().registros,
        receita('728:101', '11125001000000', 'IPTU (exemplo)', 3, 77766.66, 628767.16),
        // Origem que só existe depois do corte: não pode virar linha zerada nos agregados.
        receita('728:109', '13210100000000', 'Rendimentos (exemplo)', 3, 11.11, 11.11),
      ]),
      empenhos: snapshot(57140, [
        ...empenhosPadrao().registros,
        empenho('728:7', 77, '2025-03-10', SETOR, 'TARDIA EXEMPLO LTDA', 'Depois do corte', VALOR_EMPENHO, 1, 1, 0),
      ]),
    }),
  );

  it('receita: nada depois do corte em agregado nenhum, e a conta tem o valor em aguardando', async () => {
    const { corpo } = await get('/api/receitas?ano=2025');
    expect(corpo.porMes.map((m: Chave) => m.chave)).toEqual([1, 2]);
    expect(corpo.porOrigem.map((o: Chave) => o.chave)).not.toContain('13');
    expect(corpo.naturezas.map((n: Natureza) => n.rubrica.slice(0, 2))).not.toContain('13');
    // 300000 + 250000,50 + 1000000 − 5000,25 + 200000 + 150000
    expect(corpo.totais.arrecadadoNoMes).toBe(1895000.25);
    expect(corpo.conferencia).toMatchObject({
      parcial: true,
      limites: { mesReceita: 2, dataEmpenho: '2025-02-05' },
      aguardandoTce: VALOR_RECEITA,
      conferido: 1895000.25,
      diferencaBetha: 50000,
      totalBetha: 2022778.02,
    });
    const iptu = corpo.naturezas.find((n: Natureza) => n.rubrica.startsWith('11125001'));
    expect(iptu.arrecadadoNoMes).toBe(550000.5);
  });

  it('o CSV da receita também para no corte', async () => {
    const { corpo } = await get('/api/receitas.csv?ano=2025');
    expect(corpo).toContain('550000,5');
    expect(corpo).not.toContain('628');
  });

  it('despesa: fonte TCE-SC com a data do corte, e o empenho posterior em aguardando', async () => {
    const { corpo } = await get('/api/despesas/resumo?ano=2025');
    expect(corpo.porEntidade.find((e: { chave: string }) => e.chave === '728')).toMatchObject({
      fonte: 'tce',
      conferida: true,
      dataCorte: '2025-02-05',
      aguardandoTce: VALOR_EMPENHO,
      // 50000 + 120000 + 3000; o 12 não casa com o 112
      empenhado: 173000,
    });
    expect(corpo.conferencia).toMatchObject({ parcial: true, aguardandoTce: VALOR_EMPENHO });
  });

  it('despesa: sem conta até o total, porque o aguardando é valor original da Betha, e o conferido é líquido do TCE-SC', async () => {
    const { corpo } = await get('/api/despesas/resumo?ano=2025');
    expect(corpo.conferencia).toMatchObject({ diferencaBetha: null, totalBetha: null });
  });

  it.each([
    '/api/despesas/empenhos?ano=2025',
    '/api/despesas/empenhos?ano=2025&q=TARDIA',
    '/api/despesas/empenhos/resumo?ano=2025',
    '/api/despesas/empenhos.csv?ano=2025',
  ])('%s não traz empenho depois do corte', async (caso) => {
    const { corpo } = await get(caso);
    expect(typeof corpo === 'string' ? corpo : JSON.stringify(corpo)).not.toContain('TARDIA');
  });

  it('o resumo de empenhos diz o corte e conta o posterior em excluidos', async () => {
    const { corpo } = await get('/api/despesas/empenhos/resumo?ano=2025');
    expect(corpo.conferencia).toEqual({ disponivel: true, parcial: true, dataCorte: '2025-02-05' });
    expect(corpo.porMes.map((m: { chave: number }) => m.chave)).toEqual([1, 2]);
    // Sem par: o 12 e a cópia do 13. Depois do corte: o 77.
    expect(corpo.totais).toMatchObject({ excluidos: 3, aguardandoTce: 1, emDiscrepancia: 2 });
  });

  it('o recorte separa aguardando de discrepância só daquela entidade', async () => {
    const { corpo } = await get('/api/despesas/empenhos/resumo?ano=2025&entidade=319');
    expect(corpo.totais).toMatchObject({ excluidos: 0, aguardandoTce: 0, emDiscrepancia: 0 });
  });

  it('/api/discrepancias: aguardando tem os valores, por área, e não vira grupo', async () => {
    const { corpo } = await get('/api/discrepancias?ano=2025');
    expect(corpo.aguardando.receita.total).toBe(VALOR_RECEITA);
    expect(corpo.aguardando.receita.itens[0]).toMatchObject({ mes: 3, entidade: 'Prefeitura', betha: VALOR_RECEITA });
    expect(corpo.aguardando.despesa).toMatchObject({ total: VALOR_EMPENHO, quantidade: 1 });
    expect(corpo.grupos.map((g: Grupo) => g.tipo)).not.toContain('aguardando_tce');
    expect(JSON.stringify(corpo)).not.toContain('aguardando_tce');
  });
});

describe('texto da seção com empenho renumerado', () => {
  // Regressão: a nota e a explicação do renumerado diziam "credor" e "histórico" (dados reais, 02/11/2026).
  beforeAll(() => popularCenario());

  it.each(['avisos', 'credor', 'historico', 'CONSTRUTORA', 'Drenagem'])('o corpo não contém %s', async (termo) => {
    const { corpo } = await get('/api/discrepancias?ano=2025');
    const texto = JSON.stringify(corpo).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    expect(corpo.grupos.map((g: Grupo) => g.tipo)).toContain('empenho_renumerado');
    expect(texto).not.toContain(termo.toLowerCase());
  });
});

describe('situação do empenho', () => {
  const numerosDa = async (situacao: string) => {
    const { corpo } = await get(`/api/despesas/empenhos?ano=2025&situacao=${situacao}`);
    return corpo.itens.map((i: { numero: number }) => i.numero).sort((a: number, b: number) => a - b);
  };

  // Regressão: `pago` marcava quem tinha liquidado zero no TCE-SC, centenas de empenhos por ano (02/11/2026).
  describe('no conjunto casado, pelos valores do TCE-SC', () => {
    // Do TCE-SC: nº 10 liquidado 50000 e pago 50000; nº 11 60000 e 40000; nº 13 3000 e 3000; nº 5 zero e zero.
    beforeAll(() => popularCenario());

    it.each([
      ['pago', 'liquidado maior que zero e saldo zero', [10, 13]],
      ['apagar', 'liquidado e saldo maiores que zero', [11]],
      ['sem', 'liquidado zero', [5]],
    ])('situacao=%s traz quem tem %s', async (situacao, _regra, esperados) => {
      expect(await numerosDa(situacao)).toEqual(esperados);
    });
  });

  describe('na coleta de exemplo, pelos valores da própria 57140', () => {
    beforeAll(async () => {
      await popularCenario({
        empenhos: snapshot(57140, [
          empenho('728:1', 1, '2025-01-10', SETOR, 'CREDOR A EXEMPLO LTDA', 'Pago (exemplo)', 100, 100, 100, 0),
          empenho('728:2', 2, '2025-01-11', SETOR, 'CREDOR B EXEMPLO LTDA', 'A pagar (exemplo)', 100, 100, 40, 60),
          empenho('728:3', 3, '2025-01-12', SETOR, 'CREDOR C EXEMPLO LTDA', 'Zero (exemplo)', 100, 0, 0, 0),
          empenho('728:4', 4, '2025-01-13', SETOR, 'CREDOR D EXEMPLO LTDA', 'Nulo (exemplo)', 100, null, null, null),
          // Saldo nulo é falta de informação na fonte, não zero: não é pago.
          empenho(
            '728:5',
            5,
            '2025-01-14',
            SETOR,
            'CREDOR E EXEMPLO LTDA',
            'Saldo nulo (exemplo)',
            100,
            100,
            100,
            null,
          ),
          // Regressão: sem liquidação e com saldo, caía em `apagar` e em `sem` ao mesmo tempo (02/11/2026).
          empenho('728:6', 6, '2025-01-15', SETOR, 'CREDOR F EXEMPLO LTDA', 'Saldo sem liq. (exemplo)', 100, 0, 0, 70),
          empenho(
            '728:7',
            7,
            '2025-01-16',
            SETOR,
            'CREDOR G EXEMPLO LTDA',
            'Saldo, nulo (exemplo)',
            100,
            null,
            null,
            80,
          ),
        ]),
      });
      await pool.query(`UPDATE coletas SET status = 'exemplo'`);
    });

    it.each([
      ['pago', [1]],
      ['apagar', [2]],
      ['sem', [3, 4, 6, 7]],
    ])('situacao=%s não trata saldo nulo como zero, e cada registro cai numa só', async (situacao, esperados) => {
      expect(await numerosDa(situacao)).toEqual(esperados);
    });
  });
});

describe('ano sem a coleta do TCE-SC', () => {
  beforeAll(async () => {
    await popularCenario();
    await pool.query(`DELETE FROM publicacoes WHERE consulta_id IN (900001, 900002)`);
  });

  it('/api/receitas: sem número conferido, dizendo o que falta; o orçado continua', async () => {
    const { status, corpo } = await get('/api/receitas?ano=2025');
    expect(status).toBe(200);
    expect(corpo.conferencia).toEqual({
      disponivel: false,
      parcial: null,
      limites: null,
      conferido: null,
      diferencaBetha: null,
      diferencaTce: null,
      aguardandoTce: null,
      totalBetha: null,
      totalTce: null,
      faltando: ['tcesc_receitas', 'tcesc_empenhos'],
    });
    expect(corpo.totais.arrecadadoNoMes).toBeNull();
    expect(corpo.totais.orcadoAtualizado).toBe(9400000);
    expect([corpo.porMes, corpo.porEntidade, corpo.porOrigem, corpo.naturezas]).toEqual([[], [], [], []]);
  });

  it('/api/receitas.csv: só o cabeçalho', async () => {
    const { corpo } = await get('/api/receitas.csv?ano=2025');
    expect(corpo.trim().split('\r\n')).toHaveLength(1);
  });

  it('/api/despesas/resumo: sem número, sem entidade e sem Câmara', async () => {
    const { corpo } = await get('/api/despesas/resumo?ano=2025');
    expect(corpo.totais).toMatchObject({ empenhado: null, liquidado: null, pago: null });
    expect(corpo.porEntidade).toEqual([]);
    expect(corpo.camara).toBeNull();
    expect(corpo.conferencia.disponivel).toBe(false);
  });

  it('empenhos: lista vazia, e todos os registros fora dela', async () => {
    const busca = await get('/api/despesas/empenhos?ano=2025');
    const resumo = await get('/api/despesas/empenhos/resumo?ano=2025');
    expect(busca.corpo.total).toBe(0);
    // Sem conferência não há o que chamar de discrepância nem de pendência.
    expect(resumo.corpo.totais).toMatchObject({
      quantidade: 0,
      empenhado: null,
      excluidos: 6,
      aguardandoTce: 0,
      emDiscrepancia: 0,
    });
    expect(resumo.corpo.conferencia).toEqual({
      disponivel: false,
      parcial: null,
      dataCorte: null,
      faltando: ['tcesc_receitas', 'tcesc_empenhos'],
    });
  });

  it('/api/discrepancias: indisponível, sem grupos, e não 404', async () => {
    const { status, corpo } = await get('/api/discrepancias?ano=2025');
    expect(status).toBe(200);
    expect(corpo).toMatchObject({ disponivel: false, parcial: null, limites: null, grupos: [] });
    expect(corpo.faltando).toEqual(['tcesc_receitas', 'tcesc_empenhos']);
    expect(corpo.aguardando.receita).toEqual({ total: 0, itens: [] });
  });
});

describe('dados de exemplo', () => {
  beforeAll(async () => {
    await popularCenario();
    await pool.query(`UPDATE coletas SET status = 'exemplo'`);
  });

  it('/api/receitas mantém os números fictícios, identificados, sem conferência', async () => {
    const { corpo } = await get('/api/receitas?ano=2025');
    expect(corpo.meta.fonte).toBe('DADOS FICTÍCIOS — exemplo');
    expect(corpo.totais.arrecadadoNoMes).toBe(1945000.25);
    expect(corpo.conferencia.disponivel).toBe(false);
    expect(corpo.naturezas[0].nivel).toBe(14);
  });

  it('o CSV de exemplo não diz conferido', async () => {
    const { corpo } = await get('/api/receitas.csv?ano=2025');
    expect(corpo).toContain('Orçado atualizado;Arrecadado\r\n');
  });

  it('/api/despesas/resumo mantém os números e a Câmara, sem conferida', async () => {
    const { corpo } = await get('/api/despesas/resumo?ano=2025');
    expect(corpo.totais.empenhado).toBe(195000);
    expect(corpo.camara.empenhado).toBe(25000);
    expect(corpo.porEntidade[0]).toMatchObject({ fonte: 'betha', conferida: false, dataCorte: null });
  });

  it('empenhos: a lista inteira, com os valores da própria 57140', async () => {
    const busca = await get('/api/despesas/empenhos?ano=2025');
    const resumo = await get('/api/despesas/empenhos/resumo?ano=2025');
    expect(busca.corpo.total).toBe(6);
    expect(resumo.corpo.totais).toMatchObject({
      quantidade: 6,
      empenhado: 198000,
      excluidos: 0,
      aguardandoTce: 0,
      emDiscrepancia: 0,
    });
    expect(resumo.corpo.conferencia.disponivel).toBe(false);
  });

  it('/api/discrepancias não inventa caso nenhum', async () => {
    const { corpo } = await get('/api/discrepancias?ano=2025');
    expect(corpo).toMatchObject({ disponivel: false, grupos: [] });
  });
});

describe('/api/discrepancias com a despesa por função', () => {
  it('sem diferença entre a DCA e o TCE-SC, não há grupo da função', async () => {
    await popularCenario();

    const { corpo } = await get('/api/discrepancias?ano=2025');

    expect(corpo.grupos.filter((g: Grupo) => g.area === 'funcao')).toEqual([]);
  });

  it('DCA acima do TCE-SC no pago vira grupo da função, e o schema aceita', async () => {
    await popularCenario({
      siconfiFuncoes: [
        siconfiFuncoes({
          contas: {
            'Despesas Exceto Intraorçamentárias': ['220000.00', '145000.00', '120007.50'],
            '15 - Urbanismo': ['127000.00', '67000.00', '47007.50'],
          },
        }),
      ],
    });

    const { corpo } = await get('/api/discrepancias?ano=2025');

    expect(discrepanciasSchema.safeParse(corpo).error?.issues).toBeUndefined();
    const [grupo] = corpo.grupos.filter((g: Grupo) => g.area === 'funcao');
    expect(grupo).toMatchObject({ tipo: 'funcao_pago', total: 7.5 });
    expect(grupo.itens[0]).toMatchObject({ dca: 100007.5, tce: 100000, maior: 'dca' });
  });
});
