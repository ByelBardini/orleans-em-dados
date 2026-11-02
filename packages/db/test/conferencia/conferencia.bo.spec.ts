import { describe, expect, it } from 'vitest';
import {
  anotarEmpenho,
  anotarNaturezas,
  empenhosForaDaSoma,
  montarConferencia,
  type DadosDaConferencia,
  type EmpenhoSemPar,
  type LinhaNatureza,
} from '../../src/conferencia/conferencia.bo';

const NBSP = ' ';

const natureza = (campos: Partial<LinhaNatureza>): LinhaNatureza => ({
  ent: '728',
  entidade: 'Prefeitura',
  natureza: '11125001',
  descricao: 'IPTU',
  betha: 100,
  tce: 100,
  diferenca: 0,
  ...campos,
});

const semPar = (campos: Partial<EmpenhoSemPar>): EmpenhoSemPar => ({
  fonte: 'betha',
  entidade: 'Prefeitura',
  codigoEntidade: '728',
  numero: 10,
  data: '2025-01-10',
  valor: 100,
  liquidado: 100,
  ocorrencia: 1,
  numeroNaOutra: null,
  id: '211:728:1',
  ...campos,
});

describe('anotarNaturezas', () => {
  it('natureza sem diferença sai da lista', () => {
    expect(anotarNaturezas([natureza({ diferenca: 0 })], [], [])).toEqual([]);
  });

  it('natureza só no TCE-SC é classificada e anotada como tal', () => {
    const [linha] = anotarNaturezas([natureza({ betha: null, tce: 50, diferenca: -50 })], [], []);
    expect(linha).toMatchObject({ tipo: 'soTce', nota: 'Registrado no TCE, sem lançamento correspondente na Betha.' });
  });

  it('natureza só na Betha lembra que pode estar em outro nível de detalhe', () => {
    const [linha] = anotarNaturezas([natureza({ betha: 50, tce: null, diferenca: 50 })], [], []);
    expect(linha?.tipo).toBe('soBetha');
    expect(linha?.nota).toContain('pode estar classificado em outro nível de detalhe');
  });

  it.each([
    [10, 'A Betha registra mais que o TCE nesta rubrica.'],
    [-10, 'O TCE registra mais que a Betha nesta rubrica.'],
  ])('diferença de %s sem pista diz só quem registra mais', (diferenca, nota) => {
    const [linha] = anotarNaturezas([natureza({ diferenca })], [], []);
    expect(linha).toMatchObject({ tipo: 'valor', nota });
  });

  it('incoerência do mês que explica toda a diferença é dita assim', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 50000 })],
      [],
      [{ ent: '728', nat: '11125001', mes: 2, excesso: 50000 }],
    );
    expect(linha?.incoerenciaBetha).toBe(50000);
    expect(linha?.nota).toContain(`fevereiro (R$${NBSP}50.000,00)`);
    expect(linha?.nota).toContain('Explica toda a diferença.');
  });

  it('incoerência que explica parte diz quanto explica e quanto resta', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 100 })],
      [],
      [{ ent: '728', nat: '11125001', mes: 1, excesso: 30 }],
    );
    expect(linha?.nota).toContain(`Explica R$${NBSP}30,00; restam R$${NBSP}70,00.`);
  });

  it('incoerência de outra entidade não entra na conta', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 100 })],
      [],
      [{ ent: '319', nat: '11125001', mes: 1, excesso: 30 }],
    );
    expect(linha?.incoerenciaBetha).toBe(0);
  });

  it('mesmo valor lançado em outra rubrica que bate com o TCE é possível duplicidade', () => {
    const linhas = [natureza({ diferenca: 500 }), natureza({ natureza: '17115101', diferenca: 0 })];
    const repetidas = [{ ent: '728', nat: '11125001', outra: '17115101', mes: 3, v: 500 }];
    const [linha] = anotarNaturezas(linhas, repetidas, []);
    expect(linha?.nota).toBe(
      `Em março, o mesmo valor (R$${NBSP}500,00) também foi lançado na rubrica 17115101, que bate com o TCE: possível lançamento em duplicidade na Betha.`,
    );
  });

  it('repetição com valor diferente da diferença não é duplicidade', () => {
    const repetidas = [{ ent: '728', nat: '11125001', outra: '17115101', mes: 3, v: 499 }];
    const [linha] = anotarNaturezas([natureza({ diferenca: 500 })], repetidas, []);
    expect(linha?.nota).toBe('A Betha registra mais que o TCE nesta rubrica.');
  });

  it('diferença que outra rubrica compensa exatamente é provável reclassificação', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 500 }), natureza({ natureza: '17115101', diferenca: -500 })],
      [],
      [],
    );
    expect(linha?.nota).toBe(
      'Compensa exatamente a diferença da rubrica 17115101: provável reclassificação entre rubricas, sem efeito no total.',
    );
  });

  it('incoerência tem prioridade sobre a compensação como explicação', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 500 }), natureza({ natureza: '17115101', diferenca: -500 })],
      [],
      [{ ent: '728', nat: '11125001', mes: 1, excesso: 500 }],
    );
    expect(linha?.nota).toContain('Explica toda a diferença.');
  });

  it('a linha anotada troca `ent` por `codigoEntidade`', () => {
    const [linha] = anotarNaturezas([natureza({ diferenca: 1 })], [], []);
    expect(linha?.codigoEntidade).toBe('728');
    expect(linha).not.toHaveProperty('ent');
  });
});

describe('anotarEmpenho', () => {
  it('ocorrência repetida é registro repetido, mesmo com número na outra fonte', () => {
    expect(anotarEmpenho(semPar({ ocorrencia: 2, numeroNaOutra: 112 })).nota).toBe(
      'Registro repetido: mesmo número, data e valor de outro empenho.',
    );
  });

  it('número diferente na outra fonte é provável renumeração', () => {
    expect(anotarEmpenho(semPar({ numeroNaOutra: 112 })).nota).toBe(
      'Na outra fonte, o empenho com esta data e valor é o nº 112: provável renumeração.',
    );
  });

  it.each([
    ['betha', 'Sem correspondente no TCE.'],
    ['tce', 'Sem correspondente na Betha.'],
  ] as const)('empenho da fonte %s sem pista diz que não tem correspondente', (fonte, nota) => {
    expect(anotarEmpenho(semPar({ fonte })).nota).toBe(nota);
  });

  it('empenho da Betha sem liquidação ganha o aviso', () => {
    expect(anotarEmpenho(semPar({ liquidado: null })).nota).toBe(
      'Sem correspondente no TCE. Não tem liquidação registrada.',
    );
  });

  it('empenho do TCE-SC sem liquidação não ganha o aviso', () => {
    expect(anotarEmpenho(semPar({ fonte: 'tce', liquidado: null })).nota).toBe('Sem correspondente na Betha.');
  });
});

describe('empenhosForaDaSoma', () => {
  it('sai da soma o que é da Betha e repetido ou renumerado', () => {
    const lista = [
      semPar({ id: 'repetido', ocorrencia: 2 }),
      semPar({ id: 'renumerado', numeroNaOutra: 112 }),
      semPar({ id: 'so-na-betha' }),
      semPar({ id: 'do-tce', fonte: 'tce', numeroNaOutra: 12 }),
    ];
    expect(empenhosForaDaSoma(lista)).toEqual(['repetido', 'renumerado']);
  });
});

const dados = (campos: Partial<DadosDaConferencia>): DadosDaConferencia => ({
  coletas: [],
  limites: { mesReceita: 12, dataEmpenho: '2025-12-31' },
  despesa: [],
  receitaEnt: [],
  receitaMes: [],
  naturezas: [],
  repetidas: [],
  incoerentes: [],
  empenhos: [],
  semPar: [],
  camara: { empenhos: 0, empenhado: null, liquidado: null, pago: null, ultimo: null },
  ...campos,
});

const despesa = (campos: object) => ({
  sigla: 'Prefeitura',
  nome: 'Prefeitura Municipal',
  poder: 'Executivo',
  entidadeBetha: '728',
  bethaEmpenhado: 100,
  tceEmpenhado: 100,
  difEmpenhado: 0,
  bethaLiquidado: 100,
  tceLiquidado: 100,
  difLiquidado: 0,
  bethaPago: 100,
  tcePago: 100,
  difPago: 0,
  ...campos,
});

describe('montarConferencia', () => {
  const AGORA = new Date('2026-01-15T10:00:00.000Z');

  it('leva o instante recebido em geradoEm', () => {
    expect(montarConferencia(2025, dados({}), AGORA).geradoEm).toBe('2026-01-15T10:00:00.000Z');
  });

  it.each([
    [12, false],
    [11, true],
  ])('TCE-SC com receita até o mês %s: parcial é %s', (mesReceita, parcial) => {
    const conferencia = montarConferencia(2025, dados({ limites: { mesReceita, dataEmpenho: null } }), AGORA);
    expect(conferencia.parcial).toBe(parcial);
  });

  it('despesa só é comparável em exercício completo', () => {
    const parcial = dados({ limites: { mesReceita: 2, dataEmpenho: null }, despesa: [despesa({})] });
    expect(montarConferencia(2025, parcial, AGORA).despesaPorEntidade[0]?.comparavel).toBe(false);
    expect(montarConferencia(2025, dados({ despesa: [despesa({})] }), AGORA).despesaPorEntidade[0]?.comparavel).toBe(
      true,
    );
  });

  it('entidade que só existe no TCE-SC, como a Câmara, não é comparável', () => {
    const camara = despesa({ bethaEmpenhado: null, entidadeBetha: null });
    expect(montarConferencia(2025, dados({ despesa: [camara] }), AGORA).despesaPorEntidade[0]?.comparavel).toBe(false);
  });

  it('resumo conta como iguais só as entidades sem diferença nas três etapas', () => {
    const lista = [
      despesa({}),
      despesa({ sigla: 'FMS', difPago: 0.01 }),
      despesa({ sigla: 'Câmara', bethaEmpenhado: null }),
    ];
    const { resumo } = montarConferencia(2025, dados({ despesa: lista }), AGORA);
    expect(resumo.despesaEntidadesComparadas).toBe(2);
    expect(resumo.despesaEntidadesIguais).toBe(1);
  });

  it('resumo soma a receita em centavos, sem erro de ponto flutuante', () => {
    const entidade = (betha: number, tce: number) => ({
      sigla: 'X',
      codigoEntidade: '728',
      betha,
      tce,
      diferenca: betha - tce,
    });
    const { resumo } = montarConferencia(
      2025,
      dados({ receitaEnt: [entidade(0.1, 0.05), entidade(0.2, 0.05)] }),
      AGORA,
    );
    expect(resumo.receitaBetha).toBe(0.3);
    expect(resumo.receitaTce).toBe(0.1);
    expect(resumo.receitaDiferenca).toBe(0.2);
  });

  it('receita da entidade recebe a incoerência da própria entidade', () => {
    const conferencia = montarConferencia(
      2025,
      dados({
        receitaEnt: [{ sigla: 'FMS', codigoEntidade: '319', betha: 10, tce: 5, diferenca: 5 }],
        incoerentes: [
          { ent: '319', nat: '1', mes: 1, excesso: 5 },
          { ent: '728', nat: '1', mes: 1, excesso: 99 },
        ],
      }),
      AGORA,
    );
    expect(conferencia.receitaPorEntidade[0]?.incoerenciaBetha).toBe(5);
    expect(conferencia.resumo.receitaIncoerenteBetha).toBe(104);
  });
});
