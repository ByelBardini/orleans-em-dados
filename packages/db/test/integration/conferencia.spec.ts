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
  receita,
  receitaTce,
  snapshot,
} from '../../../importadores/fixtures/src/snapshots';
import { conferencia, dadosConferidos } from '../../src/conferencia/conferencia.service';
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
