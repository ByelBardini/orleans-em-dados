// Snapshots fictícios das consultas, no formato que os coletores entregam a
// gravarColeta. Nenhum dado real: credores são empresas inventadas.
//
// O conjunto é pequeno, mas carrega os casos que a conferência e a API tratam:
// receita negativa (ajuste), incoerência entre arrecadado no mês e acumulado
// (FMS em fevereiro), empenho renumerado (12 na Betha, 112 no TCE-SC), cópia
// antiga de empenho na Betha (13), empenho sem liquidação e despesa da Câmara,
// que só existe no TCE-SC. O TCE-SC tem dados só até fevereiro: exercício parcial.

import type { RegistroBruto, Snapshot, StatusDoLote } from '@orleans-em-dados/importador-nucleo';

export const ANO = 2025;
const QUANDO = '2025-03-01T12:00:00.000Z';

const FILTROS: Record<number, unknown> = {
  57153: { ano: [String(ANO)] },
  57140: { anoExercicio: [String(ANO)] },
  57170: { ano: [String(ANO)] },
  900001: {
    selecoes: { nome_ente: 'ORLEANS', ano_competencia: String(ANO) },
    ultimaRecargaApp: '2025-03-01T06:00:00.000Z',
  },
  900002: { selecoes: { Ente: 'ORLEANS', Ano_Empenho: String(ANO) }, ultimaRecargaApp: '2025-03-01T06:00:00.000Z' },
};

/** Monta o snapshot com meta coerente com os registros. */
export function snapshot(
  consultaId: number,
  registros: RegistroBruto[],
  {
    status = 'totalizador_conciliado',
    ano = ANO,
    erros = [],
  }: { status?: StatusDoLote; ano?: number; erros?: string[] } = {},
): Snapshot {
  const ids = new Set(registros.map((r) => r.id));
  return {
    meta: {
      consultaId,
      ano,
      filtro: FILTROS[consultaId] ?? {},
      iniciadoEm: QUANDO,
      coletadoEm: QUANDO,
      totalHits: registros.length,
      capturados: registros.length,
      idsUnicos: ids.size,
      camposAusentes: {},
      conferencia: [],
      status,
      erros,
    },
    registros,
  };
}

export const receita = (
  id: string,
  rubricaNatureza: string,
  descricaoNatureza: string,
  mes: number,
  arrecadado: number,
  acumulado: number,
  orcado = 0,
) => ({
  id: `211:${id}_${mes}`,
  rubricaNatureza,
  descricaoNatureza,
  valorOrcado: orcado,
  valorOrcadoDeducoes: 0,
  valorOrcadoAtualizado: orcado,
  valorLancadoNoMes: 0,
  valorArrecadadoNoMes: arrecadado,
  valorArrecadadoAteMes: acumulado,
  percentualRealizado: 0,
});

export const receitas = () =>
  snapshot(57153, [
    receita('728:101', '11125001000000', 'IPTU (exemplo)', 1, 300000, 300000, 1000000),
    receita('728:101', '11125001000000', 'IPTU (exemplo)', 2, 250000.5, 550000.5),
    receita('728:102', '17115101000000', 'Cota-parte FPM (exemplo)', 1, 1000000, 1000000, 6000000),
    receita('728:102', '17115101000000', 'Cota-parte FPM (exemplo)', 2, -5000.25, 994999.75),
    receita('319:201', '17135011000000', 'Transferência SUS (exemplo)', 1, 200000, 200000, 2400000),
    // Arrecadado no mês 200 mil, mas o acumulado só sobe 150 mil: incoerência da própria fonte.
    receita('319:201', '17135011000000', 'Transferência SUS (exemplo)', 2, 200000, 350000),
  ]);

export const empenho = (
  id: string,
  numero: number,
  data: string,
  orgao: string,
  credor: string,
  historico: string,
  valor: number,
  liquidado: number | null,
  pago: number | null,
  saldo: number | null,
) => ({
  id: `211:${id}`,
  numeroEmpenho: numero,
  dataEmpenho: data,
  descricaoOrgao: orgao,
  credor: { nomeCredor: credor },
  historicoEmpenho: historico,
  valorEmpenho: valor,
  valorLiquidadoEmpenho: liquidado,
  valorPagoEmpenho: pago,
  saldoAPagar: saldo,
});

const EDUCACAO = 'SECRETARIA MUNICIPAL DE EDUCAÇÃO';
const OBRAS = 'SECRETARIA MUNICIPAL DE OBRAS';
const SAUDE = 'FUNDO MUNICIPAL DE SAÚDE';

export const empenhos = () =>
  snapshot(57140, [
    empenho(
      '728:1001',
      10,
      '2025-01-10',
      EDUCACAO,
      'MERENDA EXEMPLO LTDA',
      'Merenda escolar (exemplo)',
      50000,
      50000,
      50000,
      0,
    ),
    empenho(
      '728:1002',
      11,
      '2025-01-15',
      OBRAS,
      'CONSTRUTORA FICTICIA S.A.',
      'Pavimentação; trecho "A" (exemplo)',
      120000,
      60000,
      40000,
      80000,
    ),
    // Renumerado: no TCE-SC é o 112.
    empenho(
      '728:1003',
      12,
      '2025-02-01',
      OBRAS,
      'CONSTRUTORA FICTICIA S.A.',
      'Drenagem\nsegunda linha (exemplo)',
      7000,
      7000,
      7000,
      0,
    ),
    // Cópia antiga (id menor, sem execução) e a vigente do mesmo empenho 13.
    empenho(
      '728:900',
      13,
      '2025-02-05',
      EDUCACAO,
      'PAPELARIA MODELO ME',
      'Material escolar (exemplo)',
      3000,
      null,
      null,
      null,
    ),
    empenho(
      '728:1004',
      13,
      '2025-02-05',
      EDUCACAO,
      'PAPELARIA MODELO ME',
      'Material escolar (exemplo)',
      3000,
      3000,
      3000,
      0,
    ),
    // Sem liquidação registrada: liquidado e pago nulos, não zero.
    empenho(
      '319:2001',
      5,
      '2025-01-20',
      SAUDE,
      'LABORATORIO EXEMPLO LTDA',
      'Exames (exemplo)',
      15000,
      null,
      null,
      15000,
    ),
  ]);

export const despesa = (
  id: string,
  natureza: string,
  acao: { numero: string; nome: string },
  orcado: number,
  empenhado: number,
  liquidado: number,
  pago: number,
) => ({
  id: `211:${id}`,
  idNatureza: natureza,
  numero: acao.numero,
  descricao: acao.nome,
  valorOrcado: orcado,
  valorOrcadoAtualizado: orcado,
  valorEmpenhadoAtualizado: empenhado,
  valorLiquidadoAtualizado: liquidado,
  valorPagoAtualizado: pago,
});

export const despesas = () =>
  snapshot(57170, [
    despesa(
      '728:3001',
      '33903000000000',
      { numero: '2001', nome: 'Manutenção do ensino (exemplo)' },
      400000,
      53000,
      53000,
      53000,
    ),
    despesa(
      '728:3002',
      '44905100000000',
      { numero: '1001', nome: 'Obras urbanas (exemplo)' },
      900000,
      127000,
      67000,
      47000,
    ),
    despesa('319:3003', '33903900000000', { numero: '2010', nome: 'Atenção básica (exemplo)' }, 300000, 15000, 0, 0),
  ]);

export const PREFEITURA_TCE = 'Prefeitura Municipal de Orleans';
export const FMS_TCE = 'Fundo Municipal de Saúde de Orleans';
export const SAMAE_TCE = 'Serviço Autônomo Municipal de Água e Esgoto de Orleans';
export const FUNDACAO_TCE = 'Fundação Ambiental Municipal de Orleans';

export const receitaTce = (unidade: string, codigoreceita: string, natureza: string, mes: string, valor: string) => ({
  id: [unidade, codigoreceita, mes, ''].join('|'),
  nomeunidade: unidade,
  codigoreceita,
  Mês: mes,
  descricaotipodeducaoreceita: null,
  valorArrecadado: valor,
  natureza,
});

export const tcescReceitas = () =>
  snapshot(900001, [
    receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'jan', '300000.00'),
    receitaTce(PREFEITURA_TCE, '1.1.1.2.50.0.1', 'IPTU', 'fev', '250000.50'),
    receitaTce(PREFEITURA_TCE, '1.7.1.1.51.0.1', 'Cota-parte FPM', 'jan', '1000000.00'),
    receitaTce(PREFEITURA_TCE, '1.7.1.1.51.0.1', 'Cota-parte FPM', 'fev', '-5000.25'),
    receitaTce(FMS_TCE, '1.7.1.3.50.1.1', 'Transferência SUS', 'jan', '200000.00'),
    receitaTce(FMS_TCE, '1.7.1.3.50.1.1', 'Transferência SUS', 'fev', '150000.00'),
  ]);

export const empenhoTce = (
  id: number,
  ug: string,
  numero: number,
  data: string,
  credor: string,
  valor: string,
  liquidado: string,
  pago: string,
) => ({
  id: String(id),
  'ID Empenho': String(id),
  codigoUG: ug,
  numero: String(numero),
  dataEmpenho: data,
  credor,
  historico: 'Empenho (exemplo)',
  valorOriginal: valor,
  valorReforco: '0.00',
  valorEstorno: '0.00',
  valorEmpenhado: valor,
  valorLiquidado: liquidado,
  valorPago: pago,
});

export const tcescEmpenhos = () =>
  snapshot(900002, [
    empenhoTce(5001, '204', 10, '2025-01-10', 'MERENDA EXEMPLO LTDA', '50000.00', '50000.00', '50000.00'),
    empenhoTce(5002, '204', 11, '2025-01-15', 'CONSTRUTORA FICTICIA S.A.', '120000.00', '60000.00', '40000.00'),
    empenhoTce(5003, '204', 112, '2025-02-01', 'CONSTRUTORA FICTICIA S.A.', '7000.00', '7000.00', '7000.00'),
    empenhoTce(5004, '204', 13, '2025-02-05', 'PAPELARIA MODELO ME', '3000.00', '3000.00', '3000.00'),
    empenhoTce(5005, '486', 5, '2025-01-20', 'LABORATORIO EXEMPLO LTDA', '15000.00', '0.00', '0.00'),
    // Câmara: só no TCE-SC.
    empenhoTce(5006, '1864', 1, '2025-01-05', 'GRAFICA EXEMPLO LTDA', '25000.00', '25000.00', '20000.00'),
  ]);

// IBGE: o lote traz a série inteira, com `ano` igual ao da coleta. Valores inventados, coerentes entre si.
export const ANO_DA_COLETA_IBGE = 2026;

export const valorIbge = (
  tabela: string,
  variavel: string,
  unidade: string,
  periodo: string,
  valor: string,
  categoria = '',
  localidade = '4211702',
) => ({
  id: `${localidade === '4211702' ? '' : `${localidade}:`}${tabela}:${variavel}:${periodo}:${categoria}`,
  tabela,
  variavel,
  unidade,
  periodo,
  categoria,
  localidade,
  valor,
});

const FAIXAS = [
  '0 a 4 anos',
  '5 a 9 anos',
  '10 a 14 anos',
  '15 a 19 anos',
  '20 a 24 anos',
  '25 a 29 anos',
  '30 a 34 anos',
  '35 a 39 anos',
  '40 a 44 anos',
  '45 a 49 anos',
  '50 a 54 anos',
  '55 a 59 anos',
  '60 a 64 anos',
  '65 a 69 anos',
  '70 a 74 anos',
  '75 a 79 anos',
  '80 a 84 anos',
  '85 a 89 anos',
  '90 a 94 anos',
  '95 a 99 anos',
  '100 anos ou mais',
];
// Somam 11.405 e 12.095: os 23.500 do Censo fictício. `-` é o zero absoluto do SIDRA.
const HOMENS = '700 650 700 750 850 900 950 900 900 800 800 750 600 450 350 170 100 60 20 5 -'.split(' ');
const MULHERES = '750 795 650 750 880 860 980 900 950 850 830 760 700 470 400 280 150 90 40 5 5'.split(' ');

export const ibgePopulacao = () =>
  snapshot(
    900101,
    [
      valorIbge('6579', '9324', 'Pessoas', '2021', '23000'),
      valorIbge('6579', '9324', 'Pessoas', '2024', '24000'),
      valorIbge('6579', '9324', 'Pessoas', '2025', '24200'),
      valorIbge('6579', '9324', 'Pessoas', '2026', '24400'),
      valorIbge('200', '93', 'Pessoas', '2000', '20000'),
      valorIbge('200', '93', 'Pessoas', '2010', '21000'),
      valorIbge('4709', '93', 'Pessoas', '2022', '23500'),
    ],
    { ano: ANO_DA_COLETA_IBGE },
  );

export const ibgeCenso = () =>
  snapshot(
    900102,
    [
      valorIbge('4714', '93', 'Pessoas', '2022', '23500'),
      valorIbge('4714', '6318', 'Quilômetros quadrados', '2022', '550.125'),
      valorIbge('4714', '614', 'Habitante por quilômetro quadrado', '2022', '42.72'),
      valorIbge('9923', '93', 'Pessoas', '2022', '23500'),
      valorIbge('9923', '93', 'Pessoas', '2022', '15000', 'Urbana'),
      valorIbge('9923', '93', 'Pessoas', '2022', '8500', 'Rural'),
      valorIbge('9514', '93', 'Pessoas', '2022', '23500'),
      ...FAIXAS.flatMap((faixa, i) => [
        valorIbge('9514', '93', 'Pessoas', '2022', HOMENS[i]!, `Homens|${faixa}`),
        valorIbge('9514', '93', 'Pessoas', '2022', MULHERES[i]!, `Mulheres|${faixa}`),
      ]),
      valorIbge('10295', '13431', 'Reais', '2022', '2000.50'),
      valorIbge('10295', '13534', 'Reais', '2022', '1500.25'),
    ],
    { ano: ANO_DA_COLETA_IBGE },
  );

const PARCELAS_DO_PIB = ['513', '517', '6575', '525', '543'];

const anoDoPib = (periodo: string, pib: string, parcelas: string[] | null) => [
  valorIbge('5938', '37', 'Mil Reais', periodo, pib),
  ...PARCELAS_DO_PIB.map((variavel, i) => valorIbge('5938', variavel, 'Mil Reais', periodo, parcelas?.[i] ?? '...')),
];

export const ibgePib = () =>
  snapshot(
    900103,
    [
      ...anoDoPib('2020', '900000', ['100000', '300000', '300000', '100000', '100000']),
      ...anoDoPib('2021', '1000000', ['100000', '300000', '400000', '100000', '100000']),
      ...anoDoPib('2022', '1270000', null),
      ...anoDoPib('2023', '1400000', null),
    ],
    { ano: ANO_DA_COLETA_IBGE },
  );

// SICONFI: mesmos totais do TCE-SC fictício. Sem a Câmara, empenhado 195.000, liquidado 120.000 e pago 100.000.
const COLUNAS_DA_DCA: Record<string, string> = {
  empenhado: 'Despesas Empenhadas',
  liquidado: 'Despesas Liquidadas',
  pago: 'Despesas Pagas',
  rp_nao_processados: 'Inscrição de Restos a Pagar Não Processados',
  rp_processados: 'Inscrição de Restos a Pagar Processados',
};

export const contaDaDca = (etapa: string, conta: string, valor: string, ano: number = ANO) => ({
  id: `${etapa}:${conta}`,
  exercicio: ano,
  cod_ibge: 4211702,
  anexo: 'DCA-Anexo I-E',
  rotulo: 'Total Geral da Despesa por Função',
  coluna: COLUNAS_DA_DCA[etapa],
  cod_conta: 'TotalDespesas',
  conta,
  valor,
});

type ValoresDaConta = [empenhado: string, liquidado: string, pago: string];

const DCA_PADRAO: Record<string, ValoresDaConta> = {
  'Despesas Exceto Intraorçamentárias': ['220000.00', '145000.00', '120000.00'],
  '01 - Legislativa': ['25000.00', '25000.00', '20000.00'],
  '01.031 - Ação Legislativa': ['25000.00', '25000.00', '20000.00'],
  '10 - Saúde': ['15000.00', '0.00', '0.00'],
  '10.301 - Atenção Básica': ['15000.00', '0.00', '0.00'],
  '12 - Educação': ['53000.00', '53000.00', '53000.00'],
  '12.361 - Ensino Fundamental': ['50000.00', '50000.00', '50000.00'],
  'FU12 - Demais Subfunções': ['3000.00', '3000.00', '3000.00'],
  '15 - Urbanismo': ['127000.00', '67000.00', '47000.00'],
  '15.451 - Infraestrutura Urbana': ['127000.00', '67000.00', '47000.00'],
};

/** A DCA de um exercício; `contas` troca ou acrescenta linhas para descasar do TCE-SC. */
export const siconfiFuncoes = ({
  ano = ANO,
  contas = {},
}: { ano?: number; contas?: Record<string, ValoresDaConta> } = {}) =>
  snapshot(
    900201,
    [
      ...Object.entries({ ...DCA_PADRAO, ...contas }).flatMap(([conta, [empenhado, liquidado, pago]]) => [
        contaDaDca('empenhado', conta, empenhado, ano),
        contaDaDca('liquidado', conta, liquidado, ano),
        contaDaDca('pago', conta, pago, ano),
      ]),
      contaDaDca('rp_nao_processados', 'Despesas Exceto Intraorçamentárias', '75000.00', ano),
      contaDaDca('rp_processados', 'Despesas Exceto Intraorçamentárias', '25000.00', ano),
    ],
    { ano },
  );

type LugarDaComparacao = {
  localidade: string;
  censo2010: string;
  censo2022: string;
  estimativa2024: string;
  densidade: string;
  urbana: string;
  rural: string;
  // Por sexo, nas três faixas da fixture: 0 a 4, 20 a 24 e 60 a 64 anos.
  faixas: [string, string, string];
  rendimento: [string, string];
  pib2023: string;
};

function linhasDoLugar(l: LugarDaComparacao) {
  const valor = (tabela: string, variavel: string, periodo: string, v: string, categoria = '') =>
    valorIbge(tabela, variavel, 'Unidade', periodo, v, categoria, l.localidade);
  return [
    valor('6579', '9324', '2024', l.estimativa2024),
    valor('200', '93', '2010', l.censo2010),
    valor('4709', '93', '2022', l.censo2022),
    valor('4714', '93', '2022', l.censo2022),
    valor('4714', '6318', '2022', '1000.000'),
    valor('4714', '614', '2022', l.densidade),
    valor('9923', '93', '2022', l.censo2022),
    valor('9923', '93', '2022', l.urbana, 'Urbana'),
    valor('9923', '93', '2022', l.rural, 'Rural'),
    valor('9514', '93', '2022', l.censo2022),
    ...['Homens', 'Mulheres'].flatMap((sexo) =>
      ['0 a 4 anos', '20 a 24 anos', '60 a 64 anos'].map((faixa, i) =>
        valor('9514', '93', '2022', l.faixas[i]!, `${sexo}|${faixa}`),
      ),
    ),
    valor('10295', '13431', '2022', l.rendimento[0]),
    valor('10295', '13534', '2022', l.rendimento[1]),
    valor('5938', '37', '2023', l.pib2023),
    ...PARCELAS_DO_PIB.map((variavel) => valor('5938', variavel, '2023', '...')),
  ];
}

/** Brasil e Santa Catarina, com valores inventados e coerentes entre si. */
export const ibgeComparacao = (extras: ReturnType<typeof valorIbge>[] = []) =>
  snapshot(
    900104,
    [
      ...linhasDoLugar({
        localidade: '42',
        censo2010: '80000',
        censo2022: '100000',
        estimativa2024: '110000',
        densidade: '75.50',
        urbana: '85000',
        rural: '15000',
        faixas: ['5000', '30000', '15000'],
        rendimento: ['2200.00', '1500.00'],
        pib2023: '6000000',
      }),
      ...linhasDoLugar({
        localidade: '1',
        censo2010: '800000',
        censo2022: '1000000',
        estimativa2024: '1050000',
        densidade: '24.00',
        urbana: '900000',
        rural: '100000',
        faixas: ['100000', '300000', '100000'],
        rendimento: ['1600.00', '1000.00'],
        pib2023: '50000000',
      }),
      ...extras,
    ],
    { ano: ANO_DA_COLETA_IBGE },
  );
