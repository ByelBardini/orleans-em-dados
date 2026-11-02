import { describe, expect, it } from 'vitest';
import {
  anotarEmpenho,
  anotarNaturezas,
  completarRubricas,
  conferirDespesaEncerrada,
  empenhosForaDaSoma,
  listarSemExplicacao,
  montarConferencia,
  montarDespesaConferida,
  separarReceita,
  separarValores,
  type CruzamentoReceita,
  type DadosDaConferencia,
  type DespesaPorEntidade,
  type EmpenhoSemPar,
  type LinhaNatureza,
  type Modalidade71,
  type PistasDaReceita,
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

  it('incoerência aponta o mês em que o acumulado desencontra, sem dizer que a linha sobrando é desse mês', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 50000 })],
      [],
      [{ ent: '728', nat: '11125001', mes: 6, excesso: 50000 }],
    );
    expect(linha?.nota).toBe(
      `Na própria Betha, o arrecadado no mês não fecha com o acumulado da rubrica em junho (R$${NBSP}50.000,00): é onde a conta desencontra. A linha que o acumulado provavelmente desconsidera pode ser de outro mês. Explica toda a diferença.`,
    );
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
  repetidasMeses: [],
  mesPorRubrica: [],
  outrosAnos: new Map(),
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

describe('causa da natureza divergente', () => {
  it('mesmo valor em duas rubricas do mês é possível duplicidade, com causa', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 500 })],
      [{ ent: '728', nat: '11125001', outra: '17115121', mes: 7, v: 500 }],
      [],
    );
    expect(linha).toMatchObject({ causa: 'Possível duplicidade', explicada: true });
  });

  it('mesmo valor em dois meses da mesma rubrica é possível duplicidade, e a nota cita os meses', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 500 })],
      [],
      [],
      [{ ent: '728', nat: '11125001', mes: 7, outroMes: 8, v: 500 }],
    );
    expect(linha).toMatchObject({ causa: 'Possível duplicidade', explicada: true });
    expect(linha?.nota).toContain('julho e em agosto');
  });

  it('mesmo valor em dois meses de outra entidade não explica', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 500 })],
      [],
      [],
      [{ ent: '319', nat: '11125001', mes: 7, outroMes: 8, v: 500 }],
    );
    expect(linha).toMatchObject({ causa: null, explicada: false });
  });

  it('diferenças que compensam exatamente em outro grupo são provável reclassificação', () => {
    const linhas = anotarNaturezas(
      [natureza({ natureza: '17295101', diferenca: -20 }), natureza({ natureza: '24299901', diferenca: 20 })],
      [],
      [],
    );
    expect(linhas.map((l) => l.causa)).toEqual(['Provável reclassificação', 'Provável reclassificação']);
  });

  it('grupo de 6 dígitos que soma zero com três rubricas é provável reclassificação', () => {
    const [primeira] = anotarNaturezas(
      [
        natureza({ natureza: '17135011', diferenca: 30 }),
        natureza({ natureza: '17135021', diferenca: -10 }),
        natureza({ natureza: '17135031', diferenca: -20 }),
      ],
      [],
      [],
    );
    expect(primeira).toMatchObject({ causa: 'Provável reclassificação', explicada: true });
    expect(primeira?.nota).toContain('No grupo 171350');
  });

  it('incoerência que explica toda a diferença é causa conhecida', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 500 })],
      [],
      [{ ent: '728', nat: '11125001', mes: 2, excesso: 500 }],
    );
    expect(linha).toMatchObject({ causa: 'Lançamento fora do acumulado', explicada: true });
  });

  it('incoerência que explica só parte deixa a diferença em aberto', () => {
    const [linha] = anotarNaturezas(
      [natureza({ diferenca: 500 })],
      [],
      [{ ent: '728', nat: '11125001', mes: 2, excesso: 300 }],
    );
    expect(linha).toMatchObject({ causa: null, explicada: false });
  });

  it('diferença sem padrão fica sem causa', () => {
    const [linha] = anotarNaturezas([natureza({ diferenca: 10 })], [], []);
    expect(linha).toMatchObject({ causa: null, explicada: false });
  });
});

describe('causa do empenho sem par', () => {
  it.each([
    ['repetido', { ocorrencia: 2 }, 'Registro repetido', true],
    ['renumerado', { numeroNaOutra: 112 }, 'Provável renumeração', true],
    ['sem pista', {}, null, false],
  ])('empenho %s recebe a causa certa', (_nome, campos, causa, explicada) => {
    expect(anotarEmpenho(semPar(campos))).toMatchObject({ causa, explicada });
  });
});

describe('completarRubricas', () => {
  const aberta = () => anotarNaturezas([natureza({ diferenca: 10 })], [], []);
  const parcela = (mes: number, diferenca: number) => ({
    mes,
    ent: '728',
    entidade: 'Prefeitura',
    natureza: '11125001',
    diferenca,
  });

  it('rubrica em aberto diz em quais meses a diferença aparece e de que lado', () => {
    const [linha] = completarRubricas(aberta(), [parcela(3, 4), parcela(5, 6)], new Map(), 2025);
    expect(linha?.nota).toContain(`março (R$${NBSP}4,00 a mais na Betha) e maio (R$${NBSP}6,00 a mais na Betha)`);
  });

  it('diferença em mais de seis meses diz só quantos', () => {
    const parcelas = [1, 2, 3, 4, 5, 6, 7].map((mes) => parcela(mes, 1));
    const [linha] = completarRubricas(aberta(), parcelas, new Map(), 2025);
    expect(linha?.nota).toContain('se repete em 7 meses');
  });

  it('parcela de outra natureza não entra na nota', () => {
    const [linha] = completarRubricas(aberta(), [{ ...parcela(3, 4), natureza: '17135011' }], new Map(), 2025);
    expect(linha?.nota).toBe('A Betha registra mais que o TCE nesta rubrica.');
  });

  it('mesma rubrica divergindo do mesmo lado em outro ano é conhecida, sem virar explicada', () => {
    const outros = new Map([['728|11125001', [{ ano: 2024, diferenca: 7, parcial: false }]]]);
    const [linha] = completarRubricas(aberta(), [], outros, 2025);
    expect(linha).toMatchObject({
      conhecida: true,
      causa: 'Conhecida e recorrente',
      explicada: false,
      recorrenteEm: [2024, 2025],
    });
    expect(linha?.nota).toContain('Causa ainda não confirmada');
  });

  it('divergência do lado oposto em outro ano não torna a rubrica conhecida', () => {
    const outros = new Map([['728|11125001', [{ ano: 2024, diferenca: -7, parcial: false }]]]);
    const [linha] = completarRubricas(aberta(), [], outros, 2025);
    expect(linha).toMatchObject({ causa: null, explicada: false });
    expect(linha?.conhecida).toBeUndefined();
  });

  it('rubrica já explicada não recebe meses nem recorrência', () => {
    const explicada = anotarNaturezas(
      [natureza({ diferenca: 10 })],
      [],
      [{ ent: '728', nat: '11125001', mes: 2, excesso: 10 }],
    );
    const notaOriginal = explicada[0]?.nota;
    const outros = new Map([['728|11125001', [{ ano: 2024, diferenca: 7, parcial: false }]]]);
    const [linha] = completarRubricas(explicada, [parcela(2, 10)], outros, 2025);
    expect(linha?.nota).toBe(notaOriginal);
    expect(linha?.conhecida).toBeUndefined();
  });
});

describe('listarSemExplicacao', () => {
  const rubricaAberta = () =>
    completarRubricas(anotarNaturezas([natureza({ diferenca: 10 })], [], []), [], new Map(), 2025);
  const despesaComparavel = (difEmpenhado: number) => ({
    ...despesa({ sigla: 'SAMAE', entidadeBetha: '2473', bethaEmpenhado: 110, tceEmpenhado: 100, difEmpenhado }),
    comparavel: true,
  });

  it('entidade com despesa divergente entra na lista', () => {
    const [item] = listarSemExplicacao([despesaComparavel(10)], [], []);
    expect(item).toMatchObject({
      onde: 'despesa',
      entidade: 'SAMAE',
      titulo: 'Despesa orçamentária (57170)',
      diferenca: 10,
    });
  });

  it('entidade com despesa igual fica de fora', () => {
    expect(listarSemExplicacao([despesaComparavel(0)], [], [])).toEqual([]);
  });

  it('rubrica em aberto entra na lista', () => {
    expect(listarSemExplicacao([], rubricaAberta(), []).map((i) => i.titulo)).toEqual(['Rubrica 11125001']);
  });

  it('rubrica conhecida fica de fora', () => {
    const conhecida = completarRubricas(
      anotarNaturezas([natureza({ diferenca: 10 })], [], []),
      [],
      new Map([['728|11125001', [{ ano: 2024, diferenca: 7, parcial: false }]]]),
      2025,
    );
    expect(listarSemExplicacao([], conhecida, [])).toEqual([]);
  });

  it('rubrica explicada fica de fora', () => {
    const explicada = anotarNaturezas(
      [natureza({ diferenca: 10 })],
      [],
      [{ ent: '728', nat: '11125001', mes: 2, excesso: 10 }],
    );
    expect(listarSemExplicacao([], explicada, [])).toEqual([]);
  });

  it('empenho sem pista entra com o valor do lado da fonte, negativo quando é do TCE-SC', () => {
    const lista = listarSemExplicacao(
      [],
      [],
      [
        anotarEmpenho(semPar({ valor: 40 })),
        anotarEmpenho(semPar({ fonte: 'tce', valor: 25, numero: 11, id: '5001' })),
      ],
    );
    expect(lista.map((i) => [i.titulo, i.betha, i.tce, i.diferenca])).toEqual([
      ['Empenho nº 10', 40, null, 40],
      ['Empenho nº 11', null, 25, -25],
    ]);
  });

  it('empenho repetido fica de fora', () => {
    expect(listarSemExplicacao([], [], [anotarEmpenho(semPar({ ocorrencia: 2 }))])).toEqual([]);
  });
});

describe('montarConferencia com as causas', () => {
  const AGORA = new Date('2026-01-15T10:00:00.000Z');

  it('mês recebe as próprias parcelas e meses sem diferença ficam com lista vazia', () => {
    const parcela = { mes: 2, ent: '728', entidade: 'Prefeitura', natureza: '11125001', diferenca: 10 };
    const { receitaPorMes } = montarConferencia(
      2025,
      dados({
        receitaMes: [
          { mes: 1, betha: 5, tce: 5, diferenca: 0 },
          { mes: 2, betha: 15, tce: 5, diferenca: 10 },
        ],
        mesPorRubrica: [parcela],
      }),
      AGORA,
    );
    expect(receitaPorMes.map((m) => m.parcelas)).toEqual([[], [parcela]]);
  });

  it('resumo separa sem explicação, causa provável e conhecidas', () => {
    const { resumo, semExplicacao } = montarConferencia(
      2025,
      dados({
        naturezas: [
          natureza({ natureza: '11125001', diferenca: 10 }),
          natureza({ natureza: '12000000', diferenca: 20 }),
          natureza({ natureza: '13000000', diferenca: 30 }),
        ],
        incoerentes: [{ ent: '728', nat: '12000000', mes: 2, excesso: 20 }],
        semPar: [semPar({ ocorrencia: 2 })],
        outrosAnos: new Map([['728|13000000', [{ ano: 2024, diferenca: 1, parcial: false }]]]),
      }),
      AGORA,
    );
    expect(resumo).toMatchObject({ semExplicacao: 1, comCausaProvavel: 2, conhecidas: 1 });
    expect(semExplicacao.map((i) => i.titulo)).toEqual(['Rubrica 11125001']);
  });
});

describe('separarValores', () => {
  it.each([
    ['iguais', 100, 100, 100, 0, 0],
    ['Betha maior', 150, 100, 100, 50, 0],
    ['TCE maior', 100, 150, 100, 0, 50],
    ['negativos de mesmo sinal', -100, -60, -60, -40, 0],
    ['negativos com o TCE mais negativo', -60, -100, -60, 0, -40],
    ['sinais opostos', 50, -50, 0, 50, -50],
    ['só na Betha', 80, null, 0, 80, 0],
    ['só no TCE', null, 80, 0, 0, 80],
    ['linha negativa só na Betha', -15312.12, null, 0, -15312.12, 0],
  ])('%s: Betha %s e TCE %s conferem %s', (_cenario, betha, tce, conferido, diferencaBetha, diferencaTce) => {
    expect(separarValores(betha, tce)).toEqual({ conferido, diferencaBetha, diferencaTce });
  });

  it('valores quebrados saem em centavos exatos, sem erro de ponto flutuante', () => {
    // Em number, 1234567.89 - 1234567.8 dá 0.08999999985.
    expect(separarValores(1234567.89, 1234567.8)).toEqual({
      conferido: 1234567.8,
      diferencaBetha: 0.09,
      diferencaTce: 0,
    });
  });
});

const cruzamento = (campos: Partial<CruzamentoReceita>): CruzamentoReceita => ({
  ent: '728',
  entidade: 'Prefeitura',
  natureza: '11125001',
  descricao: 'IPTU',
  mes: 1,
  betha: 100,
  tce: 100,
  ...campos,
});

const SEM_PISTAS: PistasDaReceita = { repetidas: [], incoerentes: [], repetidasMeses: [] };

describe('separarReceita', () => {
  it('cruzamento igual é todo conferido e fica sem tipo', () => {
    const { linhas } = separarReceita([cruzamento({})], SEM_PISTAS, 12);
    expect(linhas).toMatchObject([{ conferido: 100, diferencaBetha: 0, diferencaTce: 0, tipo: null }]);
  });

  it('natureza que só existe no TCE confere zero e é so_tce', () => {
    const { linhas } = separarReceita([cruzamento({ betha: null, tce: 80 })], SEM_PISTAS, 12);
    expect(linhas).toMatchObject([{ conferido: 0, diferencaBetha: 0, diferencaTce: 80, tipo: 'so_tce' }]);
  });

  it('mês sem Betha em natureza que a Betha tem em outro mês não é so_tce', () => {
    const { linhas } = separarReceita(
      [cruzamento({ mes: 1 }), cruzamento({ mes: 2, betha: null, tce: 80 })],
      SEM_PISTAS,
      12,
    );
    expect(linhas.map((l) => l.tipo)).toEqual([null, 'sem_causa']);
  });

  it('natureza cuja diferença o acumulado explica inteira é fora_do_acumulado, mesmo em outro mês', () => {
    // A linha sobrando é de maio; o acumulado só desencontra em junho.
    const { linhas } = separarReceita(
      [cruzamento({ mes: 5, betha: 150, tce: 100 }), cruzamento({ mes: 6, betha: 100, tce: 100 })],
      { ...SEM_PISTAS, incoerentes: [{ ent: '728', nat: '11125001', mes: 6, excesso: 50 }] },
      12,
    );
    expect(linhas.map((l) => [l.mes, l.tipo])).toEqual([
      [5, 'fora_do_acumulado'],
      [6, null],
    ]);
  });

  it('acumulado que explica só parte da natureza deixa o resto como sem_causa', () => {
    const { linhas } = separarReceita(
      [cruzamento({ betha: 150, tce: 100 })],
      { ...SEM_PISTAS, incoerentes: [{ ent: '728', nat: '11125001', mes: 1, excesso: 30 }] },
      12,
    );
    expect(linhas[0]?.tipo).toBe('sem_causa');
  });

  it('mesmo valor lançado em outra rubrica do mês é duas_rubricas', () => {
    const { linhas } = separarReceita(
      [cruzamento({ betha: 5000, tce: null })],
      { ...SEM_PISTAS, repetidas: [{ ent: '728', nat: '11125001', outra: '11125002', mes: 1, v: 5000 }] },
      12,
    );
    expect(linhas).toMatchObject([{ conferido: 0, diferencaBetha: 5000, tipo: 'duas_rubricas' }]);
  });

  it('diferença anual zero com meses opostos é mes_diferente, com os dois lados fora do conferido', () => {
    const { linhas } = separarReceita(
      [cruzamento({ mes: 1, betha: 100, tce: null }), cruzamento({ mes: 2, betha: null, tce: 100 })],
      SEM_PISTAS,
      12,
    );
    expect(linhas).toMatchObject([
      { mes: 1, conferido: 0, diferencaBetha: 100, diferencaTce: 0, tipo: 'mes_diferente' },
      { mes: 2, conferido: 0, diferencaBetha: 0, diferencaTce: 100, tipo: 'mes_diferente' },
    ]);
  });

  it('diferença sem padrão é sem_causa', () => {
    const { linhas } = separarReceita([cruzamento({ betha: 150, tce: 100 })], SEM_PISTAS, 12);
    expect(linhas[0]?.tipo).toBe('sem_causa');
  });

  it('pista de outra entidade não classifica a natureza', () => {
    const { linhas } = separarReceita(
      [cruzamento({ betha: 150, tce: 100 })],
      { ...SEM_PISTAS, incoerentes: [{ ent: '319', nat: '11125001', mes: 1, excesso: 50 }] },
      12,
    );
    expect(linhas[0]?.tipo).toBe('sem_causa');
  });

  it('mês além do que o TCE recebeu sai das linhas e vai para aguardando', () => {
    const { linhas, aguardando } = separarReceita(
      [cruzamento({ mes: 9 }), cruzamento({ mes: 10, betha: 700, tce: null })],
      SEM_PISTAS,
      9,
    );
    expect(linhas.map((l) => l.mes)).toEqual([9]);
    expect(aguardando).toMatchObject([{ mes: 10, valor: 700 }]);
  });

  it('o mês do corte ainda é comparado, e linha sem mês na Betha nunca aguarda', () => {
    const { linhas, aguardando } = separarReceita(
      [cruzamento({ mes: 9 }), cruzamento({ mes: null, betha: 40, tce: null })],
      SEM_PISTAS,
      9,
    );
    expect(linhas.map((l) => l.mes)).toEqual([9, null]);
    expect(aguardando).toEqual([]);
  });

  it('sem mês nenhum no TCE, toda linha aguarda', () => {
    const { linhas, aguardando } = separarReceita([cruzamento({ mes: 1, tce: null })], SEM_PISTAS, null);
    expect(linhas).toEqual([]);
    expect(aguardando).toMatchObject([{ mes: 1, valor: 100 }]);
  });
});

const despesaDaEntidade = (campos: Partial<DespesaPorEntidade>): DespesaPorEntidade => ({
  sigla: 'SAMAE',
  nome: 'Serviço de Água (exemplo)',
  poder: 'Executivo',
  entidadeBetha: '2473',
  bethaEmpenhado: 1000,
  tceEmpenhado: 1000,
  difEmpenhado: 0,
  bethaLiquidado: 900,
  tceLiquidado: 900,
  difLiquidado: 0,
  bethaPago: 800,
  tcePago: 800,
  difPago: 0,
  ...campos,
});

const comDiferenca = (empenhado: number, liquidado: number, pago: number) =>
  despesaDaEntidade({
    tceEmpenhado: 1000 - empenhado,
    difEmpenhado: empenhado,
    tceLiquidado: 900 - liquidado,
    difLiquidado: liquidado,
    tcePago: 800 - pago,
    difPago: pago,
  });

const linhas71 = (empenhado: number, liquidado: number, pago: number): Modalidade71 => ({
  ent: '2473',
  linhas: 3,
  empenhado,
  liquidado,
  pago,
});

describe('conferirDespesaEncerrada', () => {
  it('igual nas três etapas: conferida com o valor da 57170, sem discrepância', () => {
    const { entidade, discrepancia } = conferirDespesaEncerrada(despesaDaEntidade({}), undefined);
    expect(entidade).toMatchObject({
      empenhado: 1000,
      liquidado: 900,
      pago: 800,
      fonte: 'betha_57170',
      conferida: true,
      tipo: null,
    });
    expect(discrepancia).toBeNull();
  });

  it('linhas de modalidade 71 sem diferença com o TCE ficam no valor', () => {
    const { entidade } = conferirDespesaEncerrada(despesaDaEntidade({}), linhas71(100, 80, 80));
    expect(entidade).toMatchObject({ empenhado: 1000, liquidado: 900, pago: 800, tipo: null });
  });

  it('diferença igual à modalidade 71 nas três etapas: valor sem essas linhas, tipo despesa_duplicada', () => {
    const { entidade, discrepancia } = conferirDespesaEncerrada(comDiferenca(100, 80, 80), linhas71(100, 80, 80));
    expect(entidade).toMatchObject({
      empenhado: 900,
      liquidado: 820,
      pago: 720,
      fonte: 'betha_57170',
      conferida: true,
      tipo: 'despesa_duplicada',
    });
    expect(discrepancia).toMatchObject({
      area: 'despesa',
      tipo: 'despesa_duplicada',
      entidade: 'SAMAE',
      betha: 1000,
      tce: 900,
      diferenca: 100,
      etapas: {
        empenhado: { betha: 1000, tce: 900, diferenca: 100 },
        liquidado: { betha: 900, tce: 820, diferenca: 80 },
        pago: { betha: 800, tce: 720, diferenca: 80 },
      },
    });
    expect(discrepancia?.nota).toContain('provável');
  });

  it('valor sem as linhas 71 sai em centavos exatos', () => {
    const { entidade } = conferirDespesaEncerrada(
      despesaDaEntidade({
        bethaEmpenhado: 10915539.85,
        tceEmpenhado: 10791652.53,
        difEmpenhado: 123887.32,
        bethaLiquidado: 10216383.98,
        tceLiquidado: 10127438.11,
        difLiquidado: 88945.87,
        bethaPago: 10213772.91,
        tcePago: 10124827.04,
        difPago: 88945.87,
      }),
      linhas71(123887.32, 88945.87, 88945.87),
    );
    expect(entidade).toMatchObject({ empenhado: 10791652.53, liquidado: 10127438.11, pago: 10124827.04 });
  });

  it.each([
    ['liquidado', 100, 70, 80],
    ['pago', 100, 80, 70],
    ['empenhado', 90, 80, 80],
  ])('modalidade 71 que não fecha no %s: não conferida, sem_causa', (_etapa, empenhado, liquidado, pago) => {
    const { entidade, discrepancia } = conferirDespesaEncerrada(
      comDiferenca(100, 80, 80),
      linhas71(empenhado, liquidado, pago),
    );
    expect(entidade).toMatchObject({
      empenhado: null,
      liquidado: null,
      pago: null,
      fonte: null,
      conferida: false,
      tipo: 'sem_causa',
    });
    expect(discrepancia?.tipo).toBe('sem_causa');
  });

  it('entidade que só existe na Betha não é conferida', () => {
    const { entidade, discrepancia } = conferirDespesaEncerrada(
      despesaDaEntidade({
        tceEmpenhado: null,
        difEmpenhado: null,
        tceLiquidado: null,
        difLiquidado: null,
        tcePago: null,
        difPago: null,
      }),
      undefined,
    );
    expect(entidade).toMatchObject({ empenhado: null, conferida: false, tipo: 'sem_causa' });
    expect(discrepancia).toMatchObject({ betha: 1000, tce: null, diferenca: 1000 });
  });
});

describe('montarDespesaConferida', () => {
  const CAMARA = { empenhos: 1, empenhado: 25000, liquidado: 25000, pago: 20000, ultimo: '2025-12-17' };
  const VAZIO = { modalidade71: [], casadas: [], empenhos: [], aguardando: [] };

  it('diferença sem padrão tira só aquela entidade, sem zerar as demais', () => {
    const { despesa, discrepancias } = montarDespesaConferida(
      false,
      { mesReceita: 12, dataEmpenho: '2025-12-30' },
      {
        ...VAZIO,
        despesa: [
          comDiferenca(10, 0, 0),
          despesaDaEntidade({ sigla: 'Prefeitura', entidadeBetha: '728' }),
          despesaDaEntidade({ sigla: 'FMS', entidadeBetha: '319' }),
        ],
        camara: CAMARA,
      },
    );
    expect(despesa.porEntidade.map((e) => [e.entidade, e.empenhado, e.conferida])).toEqual([
      ['SAMAE', null, false],
      ['Prefeitura', 1000, true],
      ['FMS', 1000, true],
    ]);
    expect(despesa.totais).toEqual({
      empenhado: 2000,
      liquidado: 1800,
      pago: 1600,
      aguardandoTce: 0,
      entidadesConferidas: 2,
      entidadesFora: 1,
    });
    expect(discrepancias.map((d) => [d.tipo, d.entidade])).toEqual([['sem_causa', 'SAMAE']]);
  });

  it('a Câmara fica à parte, fora da soma e das entidades conferidas', () => {
    const { despesa } = montarDespesaConferida(
      false,
      { mesReceita: 12, dataEmpenho: '2025-12-30' },
      {
        ...VAZIO,
        despesa: [
          despesaDaEntidade({ sigla: 'Prefeitura', entidadeBetha: '728' }),
          despesaDaEntidade({
            sigla: 'Câmara',
            entidadeBetha: null,
            bethaEmpenhado: null,
            difEmpenhado: null,
            bethaLiquidado: null,
            difLiquidado: null,
            bethaPago: null,
            difPago: null,
          }),
        ],
        camara: CAMARA,
      },
    );
    expect(despesa.porEntidade.map((e) => e.entidade)).toEqual(['Prefeitura']);
    expect(despesa.totais.empenhado).toBe(1000);
    expect(despesa.camara).toEqual({ ...CAMARA, fonte: 'tce', conferida: false });
  });

  it('ano em curso sem nenhum empenho no TCE: tudo aguarda, sem contar a Betha como sem par', () => {
    const { despesa, discrepancias } = montarDespesaConferida(
      true,
      { mesReceita: 2, dataEmpenho: null },
      {
        ...VAZIO,
        despesa: [despesaDaEntidade({ sigla: 'Prefeitura', entidadeBetha: '728' })],
        empenhos: [
          {
            entidade: 'Prefeitura',
            codigoEntidade: '728',
            betha: 1,
            tce: 0,
            casados: 0,
            soBetha: 1,
            valorSoBetha: 500,
            soTce: 0,
            valorSoTce: 0,
          },
        ],
        aguardando: [{ ent: '728', quantidade: 1, valor: 500 }],
        camara: CAMARA,
      },
    );
    expect(despesa.porEntidade).toMatchObject([{ empenhado: null, conferida: false, tipo: null, aguardandoTce: 500 }]);
    expect(discrepancias.map((d) => d.tipo)).toEqual(['aguardando_tce']);
  });
});
