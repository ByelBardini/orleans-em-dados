import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { popularBancoDeTeste, popularCenario, limparColetas } from '../../../importadores/fixtures/src/banco-de-teste';
import {
  FMS_TCE,
  FUNDACAO_TCE,
  PREFEITURA_TCE,
  SAMAE_TCE,
  despesa,
  empenho,
  empenhoTce,
  empenhos,
  receita,
  receitaTce,
  snapshot,
  tcescEmpenhos,
} from '../../../importadores/fixtures/src/snapshots';
import { conferencia, dadosConferidos, empenhosConferidos } from '../../src/conferencia/conferencia.service';
import { pool } from '../../src/index';

const GRAVADA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/api/test/paridade/respostas/api_conferencias_ano_2025.json',
);

afterAll(() => pool.end());

describe('conferencia(ano)', () => {
  beforeAll(popularBancoDeTeste);

  it('com as cinco coletas publicadas, devolve o mesmo que a API gravada', async () => {
    const { corpo } = JSON.parse(readFileSync(GRAVADA, 'utf8'));
    const resultado = await conferencia(2025);
    // A resposta passou por JSON; `coletadoEm` vira texto no caminho.
    expect({ ...JSON.parse(JSON.stringify(resultado)), geradoEm: corpo.geradoEm }).toEqual(corpo);
  });

  it('mês divergente decompõe a diferença por rubrica, e o mês igual fica sem parcela', async () => {
    const resultado = await conferencia(2025);
    if (!resultado.disponivel) throw new Error('fixture deveria estar disponível');
    expect(resultado.receitaPorMes.map((m) => [m.mes, m.parcelas])).toEqual([
      [1, []],
      [2, [{ mes: 2, ent: '319', entidade: 'FMS', natureza: '17135011', diferenca: 50000 }]],
    ]);
  });

  it('rubrica explicada pelo acumulado recebe causa e sai da lista sem explicação', async () => {
    const resultado = await conferencia(2025);
    if (!resultado.disponivel) throw new Error('fixture deveria estar disponível');
    expect(resultado.receitaPorNatureza[0]).toMatchObject({
      natureza: '17135011',
      causa: 'Lançamento fora do acumulado',
      explicada: true,
    });
    expect(resultado.semExplicacao.filter((i) => i.onde === 'receita')).toEqual([]);
  });

  it('sem outro exercício publicado, nenhuma rubrica é conhecida', async () => {
    const resultado = await conferencia(2025);
    if (!resultado.disponivel) throw new Error('fixture deveria estar disponível');
    expect(resultado.resumo.conhecidas).toBe(0);
  });

  it('ano sem coleta nenhuma lista as cinco que faltam', async () => {
    expect(await conferencia(2019)).toEqual({
      ano: 2019,
      disponivel: false,
      faltando: ['receitas', 'empenhos', 'despesas', 'tcesc_receitas', 'tcesc_empenhos'],
      coletas: [],
    });
  });

  it('falta da coleta do TCE-SC é apontada, sem comparar pela metade', async () => {
    await pool.query(`DELETE FROM publicacoes WHERE consulta_id = 900002`);
    const resultado = await conferencia(2025);
    await limparColetas();
    expect(resultado.disponivel).toBe(false);
    expect(resultado).toMatchObject({ faltando: ['tcesc_empenhos'] });
  });
});

const disponiveis = async (ano: number) => {
  const dados = await dadosConferidos(ano);
  if (!dados.disponivel) throw new Error('o cenário deveria ter as cinco coletas');
  return dados;
};

describe('dadosConferidos: exercício encerrado', () => {
  beforeAll(() =>
    popularCenario({
      receitas: snapshot(57153, [
        // Divergente em dezembro: a natureza fica em 8 dígitos.
        receita('728:101', '11125001000000', 'IPTU (exemplo)', 1, 300000, 300000),
        receita('728:101', '11125001000000', 'IPTU (exemplo)', 12, 250000.5, 550000.5),
        // Todos os meses batem no nível comum: duas linhas de 14 dígitos.
        receita('728:102', '17115101010000', 'FPM cota (exemplo)', 1, 100000.1, 100000.1),
        receita('728:103', '17115101020000', 'FPM adicional (exemplo)', 1, 200000.2, 200000.2),
        // O mesmo valor em duas rubricas do mês; só a primeira existe no TCE.
        receita('319:201', '17135011000000', 'SUS (exemplo)', 3, 5000, 5000),
        receita('319:202', '24145001000000', 'Convênio (exemplo)', 3, 5000, 5000),
        // A linha a mais é de maio; o acumulado só desencontra em junho.
        receita('320:301', '13210100000000', 'Rendimentos (exemplo)', 5, 150, 150),
        receita('320:301', '13210100000000', 'Rendimentos (exemplo)', 6, 100, 200),
      ]),
      tcescReceitas: snapshot(900001, [
        receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'jan', '300000.00'),
        receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'dez', '250000.25'),
        receitaTce(PREFEITURA_TCE, '1.7.1.1.51.0.1', 'FPM', 'jan', '300000.30'),
        receitaTce(FMS_TCE, '1.7.1.3.50.1.1', 'SUS', 'mar', '5000.00'),
        receitaTce(FUNDACAO_TCE, '1.3.2.1.01.0.0', 'Rendimentos', 'mai', '100.00'),
        receitaTce(FUNDACAO_TCE, '1.3.2.1.01.0.0', 'Rendimentos', 'jun', '100.00'),
        receitaTce(SAMAE_TCE, '1.1.1.3.03.1.1', 'Imposto retido', 'dez', '428.37'),
        // A Câmara não tem par na Betha: fica fora da conta.
        receitaTce('Câmara Municipal de Orleans', '1.9.9.9.99.0.1', 'Devolução', 'dez', '9.99'),
      ]),
    }),
  );

  it('rubrica duplicada: o total conferido é a soma das partes comuns', async () => {
    const { receita: r, parcial } = await disponiveis(2025);
    expect(parcial).toBe(false);
    // 300000 + 250000,25 + 300000,30 + 5000 + 100 + 100
    expect(r.totais.conferido).toBe(855200.55);
  });

  it('a conta fecha: conferido + diferença de cada lado = total de cada fonte', async () => {
    const { totais } = (await disponiveis(2025)).receita;
    expect(totais).toEqual({
      conferido: 855200.55,
      diferencaBetha: 5050.25, // 0,25 do IPTU + 5000 do convênio + 50 dos rendimentos
      diferencaTce: 428.37,
      aguardandoTce: 0,
      totalBetha: 860250.8,
      totalTce: 855628.92,
    });
  });

  it('misto: natureza com todos os meses iguais em 14 dígitos, com um mês divergente em 8', async () => {
    const { naturezas } = (await disponiveis(2025)).receita;
    const prefeitura = naturezas.filter((n) => n.codigoEntidade === '728');
    expect(prefeitura).toEqual([
      {
        codigoEntidade: '728',
        entidade: 'Prefeitura',
        natureza: '11125001',
        nivel: 8,
        descricao: 'IPTU',
        betha: 550000.5,
        tce: 550000.25,
        conferido: 550000.25,
        diferencaBetha: 0.25,
        diferencaTce: 0,
        tipo: 'sem_causa',
      },
      {
        codigoEntidade: '728',
        entidade: 'Prefeitura',
        natureza: '17115101020000',
        nivel: 14,
        descricao: 'FPM adicional (exemplo)',
        betha: 200000.2,
        tce: null,
        conferido: 200000.2,
        diferencaBetha: 0,
        diferencaTce: 0,
        tipo: null,
      },
      {
        codigoEntidade: '728',
        entidade: 'Prefeitura',
        natureza: '17115101010000',
        nivel: 14,
        descricao: 'FPM cota (exemplo)',
        betha: 100000.1,
        tce: null,
        conferido: 100000.1,
        diferencaBetha: 0,
        diferencaTce: 0,
        tipo: null,
      },
    ]);
  });

  it('a tabela mista soma o mesmo conferido do total', async () => {
    const { naturezas } = (await disponiveis(2025)).receita;
    const emCentavos = naturezas.reduce((soma, n) => soma + Math.round(n.conferido * 100), 0);
    expect(emCentavos).toBe(85520055);
  });

  it('agrega conferido e diferença por mês, entidade e origem', async () => {
    const { porMes, porEntidade, porOrigem } = (await disponiveis(2025)).receita;
    expect(porMes.find((m) => m.mes === 12)).toEqual({
      mes: 12,
      betha: 250000.5,
      tce: 250428.62,
      conferido: 250000.25,
      diferencaBetha: 0.25,
      diferencaTce: 428.37,
      aguardandoTce: 0,
    });
    expect(porEntidade.find((e) => e.codigoEntidade === '319')).toEqual({
      codigoEntidade: '319',
      entidade: 'FMS',
      conferido: 5000,
      diferencaBetha: 5000,
      diferencaTce: 0,
      aguardandoTce: 0,
      totalBetha: 10000,
      totalTce: 5000,
    });
    expect(porOrigem.find((o) => o.origem === '24')).toEqual({
      origem: '24',
      conferido: 0,
      diferencaBetha: 5000,
      diferencaTce: 0,
      aguardandoTce: 0,
    });
  });

  it('natureza duplicada e natureza só no TCE viram discrepância do tipo certo', async () => {
    const { discrepancias } = await disponiveis(2025);
    expect(discrepancias.find((d) => d.natureza === '24145001')).toMatchObject({
      area: 'receita',
      tipo: 'duas_rubricas',
      entidade: 'FMS',
      mes: 3,
      betha: 5000,
      tce: null,
      diferenca: 5000,
      diferencaBetha: 5000,
      diferencaTce: 0,
    });
    expect(discrepancias.find((d) => d.natureza === '11130311')).toMatchObject({
      tipo: 'so_tce',
      entidade: 'SAMAE',
      betha: null,
      tce: 428.37,
      diferenca: -428.37,
    });
  });

  it('fora do acumulado: aponta o mês da diferença entre as fontes, e a nota não diz que a linha é do mês do desencontro', async () => {
    const { discrepancias } = await disponiveis(2025);
    const caso = discrepancias.find((d) => d.natureza === '13210100');
    expect(caso).toMatchObject({ tipo: 'fora_do_acumulado', mes: 5, betha: 250, tce: 200, diferenca: 50 });
    expect(caso?.nota).toContain('junho');
    expect(caso?.nota).toContain('pode ser de outro mês');
  });

  it('natureza igual em todos os meses não vira discrepância', async () => {
    const { discrepancias } = await disponiveis(2025);
    expect(discrepancias.filter((d) => d.natureza === '17115101' || d.natureza === '17135011')).toEqual([]);
  });

  it('nenhuma nota usa o termo proibido', async () => {
    const { discrepancias } = await disponiveis(2025);
    expect(discrepancias.length).toBeGreaterThan(0);
    expect(discrepancias.filter((d) => /irregular|fraude/i.test(d.nota))).toEqual([]);
  });
});

describe('dadosConferidos: natureza explicada em parte pelo acumulado', () => {
  beforeAll(() =>
    popularCenario({
      receitas: snapshot(57153, [
        receita('319:201', '17135011000000', 'SUS (exemplo)', 1, 300, 300),
        // O acumulado só sobe 120: 30 ficam fora dele.
        receita('319:201', '17135011000000', 'SUS (exemplo)', 2, 150, 420),
      ]),
      tcescReceitas: snapshot(900001, [
        receitaTce(FMS_TCE, '1.7.1.3.50.1.1', 'SUS', 'jan', '300.00'),
        receitaTce(FMS_TCE, '1.7.1.3.50.1.1', 'SUS', 'dez', '100.00'),
      ]),
    }),
  );

  it('vira duas discrepâncias, e a conta com os totais das fontes não muda', async () => {
    const { discrepancias: todas, receita: r } = await disponiveis(2025);
    const discrepancias = todas.filter((d) => d.area === 'receita');
    expect(discrepancias.map((d) => [d.tipo, d.natureza, d.diferenca, d.diferencaDaNatureza])).toEqual([
      ['fora_do_acumulado', '17135011', 30, 50],
      ['sem_causa', '17135011', 20, 50],
    ]);
    expect(r.totais).toMatchObject({
      conferido: 300,
      diferencaBetha: 150,
      diferencaTce: 100,
      totalBetha: 450,
      totalTce: 400,
    });
    const somaDe = (campo: 'diferencaBetha' | 'diferencaTce') =>
      discrepancias.reduce((soma, d) => soma + Math.round((d[campo] ?? 0) * 100), 0);
    expect([somaDe('diferencaBetha'), somaDe('diferencaTce')]).toEqual([15000, 10000]);
  });
});

describe('dadosConferidos: repetição linha a linha entre rubricas', () => {
  const rubrica = (id: string, codigo: string, mes: number, valor: number, acumulado = valor) =>
    receita(id, codigo, 'Rendimentos (exemplo)', mes, valor, acumulado);
  beforeAll(() =>
    popularCenario({
      receitas: snapshot(57153, [
        // Três linhas da provisória iguais às da definitiva, uma no limite de R$ 1,00.
        rubrica('728:1', '13210300000001', 1, 300),
        rubrica('728:2', '13210300000002', 1, 200),
        rubrica('728:3', '13210300000003', 1, 1),
        // Abaixo de R$ 1,00: não entra, mesmo igual.
        rubrica('728:4', '13210300000004', 1, 0.5),
        // Só a soma de duas linhas da definitiva bate.
        rubrica('728:5', '13210300000005', 1, 77.77),
        // Mesma rubrica em meses diferentes, e fevereiro sem par.
        rubrica('728:1', '13210300000001', 2, 7.92, 307.92),
        rubrica('728:11', '13210111000001', 1, 300),
        rubrica('728:12', '13210111000002', 1, 200),
        rubrica('728:13', '13210111000003', 1, 1),
        rubrica('728:14', '13210111000004', 1, 0.5),
        rubrica('728:15', '13210111000005', 1, 50),
        rubrica('728:16', '13210111000006', 1, 27.77),
        // O mesmo valor só em outra entidade.
        rubrica('319:1', '13210300000001', 1, 640),
        rubrica('728:17', '13210111000007', 1, 640),
        // A mesma rubrica repete em dois meses: não é esta regra.
        rubrica('320:1', '13210300000001', 1, 90),
        rubrica('320:1', '13210300000001', 2, 90, 180),
        receita('728:9', '11125001000000', 'IPTU (exemplo)', 12, 1, 1),
      ]),
      tcescReceitas: snapshot(900001, [
        receitaTce(PREFEITURA_TCE, '1.3.2.1.01.1.1', 'Rendimentos', 'jan', '1219.27'),
        receitaTce(FUNDACAO_TCE, '1.3.2.1.03.0.0', 'Rendimentos', 'jan', '90.00'),
        receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'dez', '1.00'),
      ]),
    }),
  );

  const daNatureza = async (entidade: string) =>
    (await disponiveis(2025)).discrepancias.filter((d) => d.natureza === '13210300' && d.entidade === entidade);

  it('só as linhas iguais, de R$ 1,00 para cima, contam; a soma de duas e o mês sem par ficam no resto', async () => {
    const partes = await daNatureza('Prefeitura');
    expect(partes.map((d) => [d.tipo, d.diferenca, d.diferencaDaNatureza])).toEqual([
      ['duas_rubricas', 501, 587.19],
      ['sem_causa', 86.19, 587.19],
    ]);
  });

  it('valor igual em outra entidade não marca', async () => {
    expect((await daNatureza('FMS')).map((d) => [d.tipo, d.diferenca])).toEqual([['sem_causa', 640]]);
  });

  it('a mesma rubrica em meses diferentes não marca por esta regra', async () => {
    expect((await daNatureza('Fundação Ambiental')).map((d) => [d.tipo, d.diferenca])).toEqual([['sem_causa', 90]]);
  });

  it('a conta com os totais das fontes não muda', async () => {
    const { receita: r } = await disponiveis(2025);
    expect(r.totais).toEqual({
      conferido: 1310.27,
      diferencaBetha: 1317.19,
      diferencaTce: 0,
      aguardandoTce: 0,
      totalBetha: 2627.46,
      totalTce: 1310.27,
    });
  });
});

describe('dadosConferidos: ano em curso', () => {
  beforeAll(() =>
    popularCenario({
      receitas: snapshot(57153, [
        receita('728:101', '11125001000000', 'IPTU (exemplo)', 9, 1000, 1000),
        receita('728:101', '11125001000000', 'IPTU (exemplo)', 10, 777.77, 1777.77),
        receita('319:201', '17135011000000', 'SUS (exemplo)', 10, 22.23, 22.23),
      ]),
      tcescReceitas: snapshot(900001, [receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'set', '1000.00')]),
    }),
  );

  it('mês depois do corte do TCE fica fora do conferido e entra na conta como aguardando', async () => {
    const { parcial, limites, receita: r } = await disponiveis(2025);
    expect(parcial).toBe(true);
    expect(limites.mesReceita).toBe(9);
    expect(r.totais).toEqual({
      conferido: 1000,
      diferencaBetha: 0,
      diferencaTce: 0,
      aguardandoTce: 800,
      totalBetha: 1800,
      totalTce: 1000,
    });
    expect(r.porMes.map((m) => [m.mes, m.conferido, m.aguardandoTce])).toEqual([
      [9, 1000, 0],
      [10, 0, 800],
    ]);
  });

  it('cada entidade com mês depois do corte é listada como aguardando_tce, sem linguagem de erro', async () => {
    const { discrepancias } = await disponiveis(2025);
    const aguardando = discrepancias.filter((d) => d.tipo === 'aguardando_tce');
    expect(aguardando.map((d) => [d.entidade, d.mes, d.betha, d.tce, d.diferenca])).toEqual([
      ['Prefeitura', 10, 777.77, null, 777.77],
      ['FMS', 10, 22.23, null, 22.23],
    ]);
    expect(aguardando[0]?.nota).toContain('outubro');
    expect(aguardando[0]?.nota).not.toMatch(/divergên|erro/i);
  });

  it('a tabela conferida só soma até o corte, e natureza só com mês depois dele não entra', async () => {
    const { naturezas } = (await disponiveis(2025)).receita;
    expect(naturezas.map((n) => [n.natureza, n.conferido])).toEqual([['11125001000000', 1000]]);
  });
});

describe('dadosConferidos: sem conferência', () => {
  beforeAll(() => popularCenario());

  it('sem a coleta do TCE-SC não há número conferido', async () => {
    await pool.query(`DELETE FROM publicacoes WHERE consulta_id = 900001`);
    expect(await dadosConferidos(2025)).toEqual({
      ano: 2025,
      disponivel: false,
      faltando: ['tcesc_receitas'],
      exemplo: false,
    });
  });

  it('coleta de exemplo publicada continua identificada como exemplo, sem número conferido', async () => {
    await popularCenario();
    await pool.query(`UPDATE coletas SET status = 'exemplo'`);
    expect(await dadosConferidos(2025)).toEqual({
      ano: 2025,
      disponivel: false,
      faltando: ['receitas', 'empenhos', 'despesas', 'tcesc_receitas', 'tcesc_empenhos'],
      exemplo: true,
    });
  });
});

const ACAO = { numero: '2001', nome: 'Ação (exemplo)' };

describe('dadosConferidos: despesa de exercício encerrado', () => {
  beforeAll(() =>
    popularCenario({
      // Dezembro no TCE-SC: o exercício está completo.
      tcescReceitas: snapshot(900001, [receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'dez', '1.00')]),
      despesas: snapshot(57170, [
        // SAMAE: a linha de modalidade 71 é a diferença nas três etapas.
        despesa('2473:1', '33903900000000', ACAO, 0, 900, 800, 700),
        // 71 no elemento (dígitos 5-6), não na modalidade: fica.
        despesa('2473:2', '33907100000000', ACAO, 0, 50, 50, 50),
        despesa('2473:3', '33713300000000', ACAO, 0, 100, 80, 80),
        // Prefeitura: tem modalidade 71 e bate com o TCE, então nada sai.
        despesa('728:1', '33903000000000', ACAO, 0, 4000, 3000, 2000),
        despesa('728:2', '44710000000000', ACAO, 0, 200, 200, 200),
        // FMS: diferença sem padrão.
        despesa('319:1', '33903900000000', ACAO, 0, 15000, 15000, 15000),
      ]),
      tcescEmpenhos: snapshot(900002, [
        empenhoTce(1, '524', 1, '2025-03-10', 'SANEAMENTO EXEMPLO LTDA', '950.00', '850.00', '750.00'),
        empenhoTce(2, '204', 1, '2025-03-10', 'CONSTRUTORA FICTICIA S.A.', '4200.00', '3200.00', '2200.00'),
        empenhoTce(3, '486', 1, '2025-03-10', 'LABORATORIO EXEMPLO LTDA', '14000.00', '15000.00', '15000.00'),
        empenhoTce(4, '1864', 1, '2025-03-10', 'GRAFICA EXEMPLO LTDA', '25000.00', '25000.00', '20000.00'),
      ]),
    }),
  );

  it('diferença igual à modalidade 71 tira só essas linhas, e a do elemento 71 fica', async () => {
    const { despesa: d } = await disponiveis(2025);
    expect(d.porEntidade.find((e) => e.entidade === 'SAMAE')).toMatchObject({
      codigoEntidade: '2473',
      empenhado: 950,
      liquidado: 850,
      pago: 750,
      fonte: 'betha_57170',
      conferida: true,
      tipo: 'despesa_duplicada',
    });
  });

  it('modalidade 71 igual ao TCE fica no valor, e diferença sem padrão sai da soma', async () => {
    const { despesa: d } = await disponiveis(2025);
    expect(d.porEntidade.find((e) => e.entidade === 'Prefeitura')).toMatchObject({ empenhado: 4200, tipo: null });
    expect(d.porEntidade.find((e) => e.entidade === 'FMS')).toMatchObject({ empenhado: null, tipo: 'sem_causa' });
    expect(d.totais).toEqual({
      empenhado: 5150,
      liquidado: 4050,
      pago: 2950,
      aguardandoTce: 0,
      entidadesConferidas: 2,
      entidadesFora: 1,
    });
  });

  it('as discrepâncias de despesa saem com o tipo, a entidade e as etapas, e sem data de corte', async () => {
    const { discrepancias, despesa: d } = await disponiveis(2025);
    const daDespesa = discrepancias.filter((x) => x.area === 'despesa');
    expect(daDespesa.map((x) => [x.tipo, x.entidade, x.diferenca])).toEqual([
      ['despesa_duplicada', 'SAMAE', 100],
      ['sem_causa', 'FMS', 1000],
    ]);
    expect(d.porEntidade.every((e) => e.dataCorte === undefined)).toBe(true);
  });
});

const DEZEMBRO = () => snapshot(900001, [receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'dez', '1.00')]);
const SETOR = 'SETOR (exemplo)';
const SAMAE = '524';
const comHistorico = (e: ReturnType<typeof empenhoTce>, historico: string) => ({ ...e, historico });

describe('empenhos de exercício encerrado', () => {
  beforeAll(() =>
    popularCenario({
      tcescReceitas: DEZEMBRO(),
      empenhos: snapshot(57140, [
        empenho('2473:1', 1, '2025-03-10', SETOR, 'AGUA EXEMPLO LTDA', 'Casado (exemplo)', 1000, 1000, 1000, 0),
        // Sem nenhum campo de execução e sem par.
        empenho('2473:2', 340, '2025-04-01', SETOR, 'FROTA EXEMPLO LTDA', 'Frota (exemplo)', 20000, null, null, null),
        // Sem par, mas com execução.
        empenho('2473:3', 234, '2025-03-28', SETOR, 'AGUA EXEMPLO LTDA', 'Obra (exemplo)', 214179.3, 214179.3, 0, null),
        // Um só campo de execução já basta.
        empenho('2473:11', 701, '2025-06-01', SETOR, 'AGUA EXEMPLO LTDA', 'Só liquidado', 100, 100, null, null),
        empenho('2473:12', 702, '2025-06-02', SETOR, 'AGUA EXEMPLO LTDA', 'Só pago', 100, null, 100, null),
        empenho('2473:13', 703, '2025-06-03', SETOR, 'AGUA EXEMPLO LTDA', 'Só saldo', 100, null, null, 100),
        // O id maior, com execução, é o válido; a cópia antiga sobra.
        empenho('2473:5', 5, '2025-04-02', SETOR, 'AGUA EXEMPLO LTDA', 'Cópia (exemplo)', 48.72, 48.72, 48.72, 0),
        empenho('2473:4', 5, '2025-04-02', SETOR, 'AGUA EXEMPLO LTDA', 'Cópia (exemplo)', 48.72, null, null, null),
        // Credor com outra grafia, histórico diferente.
        empenho('2473:6', 59, '2025-05-01', SETOR, 'João Exemplo-da Silva.', 'Serviço A', 500, null, null, null),
        // Credor diferente, histórico igual.
        empenho('2473:7', 60, '2025-05-02', SETOR, 'CREDOR UM LTDA', 'Mesma descrição', 600, null, null, null),
        // Mesma data e valor, com credor e histórico diferentes.
        empenho('2473:8', 61, '2025-05-03', SETOR, 'CREDOR DOIS LTDA', 'Compra B', 700, null, null, null),
        // Histórico vazio dos dois lados não confirma nada.
        empenho('2473:9', 62, '2025-05-04', SETOR, 'CREDOR TRES LTDA', '', 800, null, null, null),
        // O número existe no TCE-SC, com outro valor.
        empenho('2473:10', 611, '2025-07-26', SETOR, 'AGUA EXEMPLO LTDA', 'Conta (exemplo)', 794.72, 4060.44, 0, null),
      ]),
      tcescEmpenhos: snapshot(900002, [
        empenhoTce(1, SAMAE, 1, '2025-03-10', 'AGUA EXEMPLO LTDA', '1000.00', '900.00', '800.00'),
        empenhoTce(2, SAMAE, 5, '2025-04-02', 'AGUA EXEMPLO LTDA', '48.72', '48.72', '48.72'),
        empenhoTce(3, SAMAE, 159, '2025-05-01', 'JOAO EXEMPLO DA  SILVA', '500.00', '500.00', '500.00'),
        comHistorico(
          empenhoTce(4, SAMAE, 160, '2025-05-02', 'OUTRO CREDOR LTDA', '600.00', '600.00', '600.00'),
          'MESMA DESCRIÇÃO',
        ),
        empenhoTce(5, SAMAE, 161, '2025-05-03', 'OUTRO CREDOR LTDA', '700.00', '700.00', '700.00'),
        comHistorico(empenhoTce(6, SAMAE, 162, '2025-05-04', 'OUTRO CREDOR LTDA', '800.00', '800.00', '800.00'), ''),
        empenhoTce(7, SAMAE, 761, '2025-08-29', 'AGUA EXEMPLO LTDA', '160.00', '160.00', '160.00'),
        empenhoTce(8, SAMAE, 611, '2025-07-26', 'AGUA EXEMPLO LTDA', '4060.44', '4060.44', '4060.44'),
      ]),
    }),
  );

  const daBetha = async (numero: number) =>
    (await disponiveis(2025)).discrepancias.find(
      (d) => d.area === 'empenho' && d.fonte === 'betha' && d.numero === numero,
    );
  const doTce = async (numero: number) =>
    (await disponiveis(2025)).discrepancias.find(
      (d) => d.area === 'empenho' && d.fonte === 'tce' && d.numero === numero,
    );

  it('sem par e sem execução é fantasma, com o valor no lado da Betha', async () => {
    expect(await daBetha(340)).toMatchObject({
      tipo: 'empenho_fantasma',
      entidade: 'SAMAE',
      dataEmpenho: '2025-04-01',
      betha: 20000,
      tce: null,
      diferenca: 20000,
      id: '211:2473:2',
    });
  });

  it('sem par com execução fica sem_causa', async () => {
    expect((await daBetha(234))?.tipo).toBe('sem_causa');
  });

  it.each([
    ['liquidado', 701],
    ['pago', 702],
    ['saldo a pagar', 703],
  ])('só com %s preenchido, nunca é fantasma', async (_, numero) => {
    expect((await daBetha(numero))?.tipo).toBe('sem_causa');
  });

  it('a cópia antiga é repetida, e a válida casa', async () => {
    const lista = (await disponiveis(2025)).discrepancias.filter((d) => d.numero === 5);
    expect(lista.map((d) => [d.tipo, d.id])).toEqual([['empenho_repetido', '211:2473:4']]);
  });

  it('mesma data e valor, com o credor em outra grafia, é renumerado nos dois lados', async () => {
    expect(await daBetha(59)).toMatchObject({ tipo: 'empenho_renumerado', nota: expect.stringContaining('nº 159') });
    expect(await doTce(159)).toMatchObject({ tipo: 'empenho_renumerado', nota: expect.stringContaining('nº 59') });
  });

  it('mesma data e valor, com outro credor e o mesmo histórico, é renumerado', async () => {
    expect((await daBetha(60))?.tipo).toBe('empenho_renumerado');
  });

  it('mesma data e valor, com credor e histórico diferentes, não tem pista de renumeração', async () => {
    expect((await daBetha(61))?.tipo).toBe('empenho_fantasma');
    expect((await doTce(161))?.tipo).toBe('empenho_ausente');
  });

  it('histórico vazio nos dois lados não confirma a renumeração', async () => {
    expect((await daBetha(62))?.tipo).toBe('empenho_fantasma');
  });

  it('só no TCE, com número que a Betha não tem, é ausente', async () => {
    expect(await doTce(761)).toMatchObject({ tipo: 'empenho_ausente', betha: null, tce: 160, diferenca: -160 });
  });

  it('só no TCE, com o número na Betha em outro valor, fica sem_causa', async () => {
    expect((await doTce(611))?.tipo).toBe('sem_causa');
  });

  it('a comparação antiga usa a mesma pista de número na outra fonte', async () => {
    const resultado = await conferencia(2025);
    if (!resultado.disponivel) throw new Error('fixture deveria estar disponível');
    const pista = (numero: number) => resultado.empenhosSemPar.find((e) => e.numero === numero)?.numeroNaOutra;
    expect([pista(59), pista(60), pista(61), pista(62)]).toEqual([159, 160, null, null]);
  });

  it('nenhuma discrepância de empenho carrega credor ou histórico', async () => {
    const lista = (await disponiveis(2025)).discrepancias.filter((d) => d.area === 'empenho');
    expect(lista.length).toBe(17);
    expect(JSON.stringify(lista)).not.toMatch(
      /AGUA EXEMPLO|FROTA EXEMPLO|Exemplo-da|EXEMPLO DA|CREDOR|Serviço A|Compra B|Só liquidado|Só pago|Só saldo|Mesma descri|MESMA DESCRI|\(exemplo\)/,
    );
    const permitidas = ['area', 'betha', 'codigoEntidade', 'dataEmpenho', 'diferenca', 'entidade', 'fonte', 'id'];
    permitidas.push('nota', 'numero', 'tce', 'tipo', 'situacao', 'data', 'evidencia');
    expect(lista.filter((d) => Object.keys(d).some((k) => !permitidas.includes(k)))).toEqual([]);
  });

  it('o conjunto casado traz os ids e a execução do TCE-SC, e deixa de fora quem não casou', async () => {
    const conjunto = await empenhosConferidos(2025);
    if (!conjunto.disponivel) throw new Error('o cenário deveria ter as cinco coletas');
    expect(conjunto.parcial).toBe(false);
    expect(conjunto.dataCorte).toBeNull();
    expect(conjunto.empenhos).toEqual([
      { id: '211:2473:1', idTce: '1', codigoEntidade: '2473', empenhado: 1000, liquidado: 900, pago: 800 },
      { id: '211:2473:5', idTce: '2', codigoEntidade: '2473', empenhado: 48.72, liquidado: 48.72, pago: 48.72 },
    ]);
  });

  it('sem as coletas, o conjunto casado diz o que falta, sem nenhum empenho', async () => {
    await pool.query(`DELETE FROM publicacoes WHERE consulta_id = 900002`);
    const conjunto = await empenhosConferidos(2025);
    await popularCenario();
    expect(conjunto).toEqual({ ano: 2025, disponivel: false, faltando: ['tcesc_empenhos'], exemplo: false });
  });
});

describe('dadosConferidos: conferências manuais', () => {
  beforeAll(() =>
    popularCenario({
      tcescReceitas: snapshot(900001, [
        receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'dez', '1.00'),
        // Fixture com o mesmo caso real, e o mesmo valor, do registro de 2025.
        receitaTce(SAMAE_TCE, '1.1.1.3.03.1.1', 'Imposto retido', 'dez', '428717.37'),
      ]),
      empenhos: snapshot(57140, [
        // O nº 340 tem registro com 20000; o nº 342, com 48,72, e aqui mudou.
        empenho('2473:1', 340, '2025-04-01', SETOR, 'AGUA EXEMPLO LTDA', 'Um (exemplo)', 20000, null, null, null),
        empenho('2473:2', 342, '2025-04-02', SETOR, 'AGUA EXEMPLO LTDA', 'Dois (exemplo)', 48.72, 48.72, 48.72, 0),
        empenho('2473:3', 342, '2025-04-02', SETOR, 'AGUA EXEMPLO LTDA', 'Dois (exemplo)', 48.72, 48.72, 48.72, 0),
        empenho('2473:4', 342, '2025-04-03', SETOR, 'AGUA EXEMPLO LTDA', 'Três (exemplo)', 10, 10, 10, 0),
        empenho('2473:5', 342, '2025-04-03', SETOR, 'AGUA EXEMPLO LTDA', 'Três (exemplo)', 10, 10, 10, 0),
      ]),
      tcescEmpenhos: snapshot(900002, [
        empenhoTce(1, SAMAE, 342, '2025-04-02', 'AGUA EXEMPLO LTDA', '48.72', '48.72', '48.72'),
        empenhoTce(2, SAMAE, 342, '2025-04-03', 'AGUA EXEMPLO LTDA', '10.00', '10.00', '10.00'),
      ]),
    }),
  );

  it('caso com registro traz situação, data, evidência e protocolo', async () => {
    const { discrepancias } = await disponiveis(2025);
    const caso = discrepancias.find((d) => d.natureza === '11130311');
    expect(caso).toMatchObject({
      tipo: 'so_tce',
      situacao: 'confirmada_no_portal',
      data: '2026-11-01',
      protocolo: 'e-SIC 000/0000',
    });
    expect(caso?.evidencia).toContain('portal');
  });

  it('empenho com registro é confirmado pelo número, e a data do empenho não vira a da conferência', async () => {
    const { discrepancias } = await disponiveis(2025);
    expect(discrepancias.find((d) => d.numero === 340)).toMatchObject({
      tipo: 'empenho_fantasma',
      situacao: 'confirmada_no_portal',
      dataEmpenho: '2025-04-01',
      data: '2026-11-01',
    });
  });

  it('valor que mudou fica rever, e o aviso é interno', async () => {
    const { discrepancias, avisos } = await disponiveis(2025);
    expect(discrepancias.filter((d) => d.numero === 342).map((d) => d.situacao)).toEqual(['rever', 'rever']);
    expect(avisos).toContain(
      'Registro manual com valor diferente: 2025, SAMAE, empenho_repetido, 342: confirmado 48.72, agora 58.72.',
    );
  });

  it('o que não tem registro é calculada, e registro sem caso vira aviso sem quebrar', async () => {
    const { discrepancias, avisos } = await disponiveis(2025);
    const semRegistro = discrepancias.filter((d) => d.tipo === 'despesa_duplicada' || d.tipo === 'sem_causa');
    expect(semRegistro.length).toBeGreaterThan(0);
    expect(new Set(semRegistro.map((d) => d.situacao))).toEqual(new Set(['calculada']));
    expect(avisos).toContain('Registro manual sem discrepância: 2025, SAMAE, fora_do_acumulado, 22130101.');
  });
});

describe('dadosConferidos: despesa no ano em curso', () => {
  beforeAll(() =>
    popularCenario({
      empenhos: snapshot(57140, [
        ...empenhos().registros,
        // Depois do último empenho que o TCE-SC recebeu.
        empenho(
          '728:1005',
          14,
          '2025-03-10',
          'SECRETARIA (exemplo)',
          'PAPELARIA MODELO ME',
          'Compra',
          900,
          null,
          null,
          900,
        ),
      ]),
      tcescEmpenhos: snapshot(900002, [
        ...tcescEmpenhos().registros.filter((r) => r.id !== '5002'),
        // Casa pelo valor original, 120000; a soma usa o líquido do estorno.
        {
          ...empenhoTce(
            5002,
            '204',
            11,
            '2025-01-15',
            'CONSTRUTORA FICTICIA S.A.',
            '120000.00',
            '60000.00',
            '40000.00',
          ),
          valorEstorno: '20000.00',
          valorEmpenhado: '100000.00',
        },
        // A Câmara remete à parte: não move a data de corte.
        empenhoTce(5007, '1864', 2, '2025-03-20', 'GRAFICA EXEMPLO LTDA', '1000.00', '1000.00', '1000.00'),
      ]),
    }),
  );

  it('empenhos casados até o corte somam o líquido do TCE, com a data do corte', async () => {
    const { despesa: d, parcial, limites } = await disponiveis(2025);
    expect(parcial).toBe(true);
    expect(limites.dataEmpenho).toBe('2025-02-05');
    expect(d.porEntidade.map((e) => [e.entidade, e.empenhado, e.liquidado, e.pago, e.fonte, e.dataCorte])).toEqual(
      expect.arrayContaining([
        // 50000 + 100000 + 3000; o 112 do TCE não casa com o 12 da Betha
        ['Prefeitura', 153000, 113000, 93000, 'tce', '2025-02-05'],
        ['FMS', 15000, 0, 0, 'tce', '2025-02-05'],
      ]),
    );
    expect(d.totais).toEqual({
      empenhado: 168000,
      liquidado: 113000,
      pago: 93000,
      aguardandoTce: 900,
      entidadesConferidas: 2,
      entidadesFora: 0,
    });
  });

  it('empenho depois do corte fica como aguardando_tce e fora da soma', async () => {
    const { despesa: d, discrepancias } = await disponiveis(2025);
    expect(d.porEntidade.find((e) => e.entidade === 'Prefeitura')?.aguardandoTce).toBe(900);
    const pendentes = discrepancias.filter((x) => x.tipo === 'aguardando_tce' && x.area === 'despesa');
    expect(pendentes).toMatchObject([
      { entidade: 'Prefeitura', codigoEntidade: '728', betha: 900, tce: null, diferenca: 900, quantidade: 1 },
    ]);
    expect(pendentes[0]?.nota).toContain('05/02/2025');
  });

  it('empenho sem par até o corte fica fora da soma e é listado um a um, sem nome de credor', async () => {
    const { discrepancias } = await disponiveis(2025);
    const semPar = discrepancias.filter((x) => x.area === 'empenho');
    // O 12 da Betha é o 112 do TCE, com o mesmo credor; o 13 tem uma cópia antiga.
    expect(semPar.map((x) => [x.tipo, x.fonte, x.numero, x.diferenca])).toEqual([
      ['empenho_repetido', 'betha', 13, 3000],
      ['empenho_renumerado', 'betha', 12, 7000],
      ['empenho_renumerado', 'tce', 112, -7000],
    ]);
    expect(JSON.stringify(semPar)).not.toMatch(/CONSTRUTORA|PAPELARIA/);
    expect(discrepancias.filter((x) => x.area === 'despesa' && x.tipo === 'sem_causa')).toEqual([]);
  });

  it('o conjunto casado para no corte, com a execução do TCE-SC de cada um', async () => {
    const conjunto = await empenhosConferidos(2025);
    if (!conjunto.disponivel) throw new Error('o cenário deveria ter as cinco coletas');
    expect(conjunto.parcial).toBe(true);
    expect(conjunto.dataCorte).toBe('2025-02-05');
    expect(conjunto.empenhos.map((e) => e.id)).not.toContain('211:728:1005');
    expect(conjunto.empenhos.find((e) => e.idTce === '5002')).toEqual({
      id: '211:728:1002',
      idTce: '5002',
      codigoEntidade: '728',
      empenhado: 100000,
      liquidado: 60000,
      pago: 40000,
    });
  });

  it('a Câmara fica à parte, fora da soma das entidades', async () => {
    const { despesa: d } = await disponiveis(2025);
    expect(d.porEntidade.map((e) => e.entidade)).not.toContain('Câmara');
    expect(d.camara).toEqual({
      empenhos: 2,
      empenhado: 26000,
      liquidado: 26000,
      pago: 21000,
      ultimo: '2025-03-20',
      fonte: 'tce',
      conferida: false,
    });
  });
});
