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
      { numero: '2001', nome: 'Manutenção do Ensino Fundamental' },
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

// Censo de educação fictício. Pessoas em Orleans; os outros lugares multiplicam a contagem, para as partes seguirem
// fechando com o total. Só Orleans carrega o arredondamento da amostra na graduação: 401 + 190 contra 590.
const POS_GRADUACAO = 'Especialização de nível superior, mestrado ou doutorado';
type Taxas = {
  alfabetizacao: Record<string, string>;
  frequencia: Record<string, string>;
  anosDeEstudo: Record<string, string>;
};

const TAXAS_DE_ORLEANS: Taxas = {
  alfabetizacao: {
    '': '97.50',
    Homens: '97.40',
    Mulheres: '97.60',
    '15 a 17 anos': '99.20',
    '65 anos ou mais': '92.50',
    Urbana: '97.70',
    Rural: '96.80',
  },
  frequencia: {
    '': '22.00',
    '0 a 3 anos': '50.00',
    '4 a 5 anos': '85.00',
    '6 a 14 anos': '97.00',
    '15 a 17 anos': '88.00',
    '18 a 24 anos': '25.00',
    '25 anos ou mais': '2.00',
  },
  anosDeEstudo: { '': '9.6', Homens: '9.5', Mulheres: '9.8', '25 anos ou mais': '9.6', '18 a 24 anos': '12.0' },
};
const TAXAS_DE_SC: Taxas = {
  alfabetizacao: { ...TAXAS_DE_ORLEANS.alfabetizacao, '': '97.30' },
  frequencia: { ...TAXAS_DE_ORLEANS.frequencia, '': '25.00', '0 a 3 anos': '47.00', '4 a 5 anos': '90.00' },
  anosDeEstudo: { ...TAXAS_DE_ORLEANS.anosDeEstudo, '': '10.1' },
};
const TAXAS_DO_BRASIL: Taxas = {
  alfabetizacao: { ...TAXAS_DE_ORLEANS.alfabetizacao, '': '93.00' },
  frequencia: { ...TAXAS_DE_ORLEANS.frequencia, '': '26.00', '0 a 3 anos': '34.00', '4 a 5 anos': '87.00' },
  anosDeEstudo: { ...TAXAS_DE_ORLEANS.anosDeEstudo, '': '9.4' },
};

const PESSOAS_DA_EDUCACAO: readonly [
  tabela: string,
  variavel: string,
  periodo: string,
  pessoas: Record<string, string>,
][] = [
  ['10092', '950', '2022', { '': '20000', Alfabetizadas: '19500', 'Não alfabetizadas': '500' }],
  [
    '10057',
    '13282',
    '2022',
    {
      '': '1000',
      '0 a 3 anos': '550',
      '4 a 5 anos': '450',
      Creche: '720',
      'Pré-escolar': '275',
      'Regular de ensino fundamental': '5',
      'Creche|0 a 3 anos': '540',
      'Creche|4 a 5 anos': '180',
      'Pré-escolar|0 a 3 anos': '10',
      'Pré-escolar|4 a 5 anos': '265',
      'Regular de ensino fundamental|0 a 3 anos': '-',
      'Regular de ensino fundamental|4 a 5 anos': '5',
    },
  ],
  [
    '10058',
    '13283',
    '2022',
    {
      '': '3000',
      Creche: '20',
      'Pré-escolar': '170',
      'Alfabetização de jovens e adultos': '-',
      'Regular de ensino fundamental': '2300',
      'Educação de jovens e adultos do ensino fundamental': '10',
      'Regular do ensino médio': '490',
      'Educação de jovens e adultos do ensino médio': '-',
      'Superior de graduação': '10',
    },
  ],
  [
    '10059',
    '13284',
    '2022',
    {
      '': '950',
      'Alfabetização de jovens e adultos': '10',
      'Regular de ensino fundamental': '20',
      'Educação de jovens e adultos do ensino fundamental': '25',
      'Regular do ensino médio': '190',
      'Educação de jovens e adultos do ensino médio': '30',
      'Superior de graduação': '575',
      'Especialização de nível superior': '75',
      Mestrado: '25',
      Doutorado: '-',
    },
  ],
  [
    '10061',
    '2667',
    '2022',
    {
      '25 anos ou mais': '16000',
      'Sem instrução e fundamental incompleto|25 anos ou mais': '5800',
      'Fundamental completo e médio incompleto|25 anos ou mais': '2600',
      'Médio completo e superior incompleto|25 anos ou mais': '4400',
      'Superior completo|25 anos ou mais': '3200',
      'Superior completo|25 anos ou mais|Homens': '1450',
      'Superior completo|25 anos ou mais|Mulheres': '1750',
    },
  ],
  [
    '10324',
    '2021',
    '2022',
    {
      '': '5000',
      'Município de residência': '4500',
      'Outro município': '500',
      'País estrangeiro': '-',
      'Outro município|Creche': '30',
      'Outro município|Pré-escolar': '40',
      'Outro município|Alfabetização de jovens e adultos': '-',
      'Outro município|Fundamental': '165',
      'Outro município|Médio': '30',
      'Outro município|Superior de graduação': '190',
      [`Outro município|${POS_GRADUACAO}`]: '45',
      'Superior de graduação': '590',
      'Município de residência|Superior de graduação': '400',
      'País estrangeiro|Superior de graduação': '-',
      [POS_GRADUACAO]: '100',
      [`Município de residência|${POS_GRADUACAO}`]: '55',
      [`País estrangeiro|${POS_GRADUACAO}`]: '-',
    },
  ],
  [
    '1549',
    '93',
    '2010',
    {
      '': '21000',
      '0 a 3 anos': '1000',
      '4 ou 5 anos': '600',
      '6 anos': '250',
      '7 a 14 anos': '2650',
      '15 a 17 anos': '1100',
      '18 ou 19 anos': '800',
      '20 a 24 anos': '1900',
      '25 anos ou mais': '12700',
    },
  ],
  [
    '1549',
    '364',
    '2010',
    {
      '': '6000',
      '0 a 3 anos': '350',
      '4 ou 5 anos': '470',
      '6 anos': '250',
      '7 a 14 anos': '2600',
      '15 a 17 anos': '870',
      '18 ou 19 anos': '290',
      '20 a 24 anos': '490',
      '25 anos ou mais': '680',
    },
  ],
];

const linhasDaEducacao = (localidade: string, escala: number, taxas: Taxas) => [
  ...Object.entries(taxas.alfabetizacao).map(([categoria, valor]) =>
    valorIbge('10091', '2513', '%', '2022', valor, categoria, localidade),
  ),
  ...Object.entries(taxas.frequencia).map(([categoria, valor]) =>
    valorIbge('10056', '3795', '%', '2022', valor, categoria, localidade),
  ),
  ...Object.entries(taxas.anosDeEstudo).map(([categoria, valor]) =>
    valorIbge('10062', '13285', 'Anos', '2022', valor, categoria, localidade),
  ),
  ...PESSOAS_DA_EDUCACAO.flatMap(([tabela, variavel, periodo, pessoas]) =>
    Object.entries(pessoas).map(([categoria, valor]) =>
      valorIbge(
        tabela,
        variavel,
        'Pessoas',
        periodo,
        valor === '-' ? '-' : String(Number(valor) * escala),
        categoria,
        localidade,
      ),
    ),
  ),
];

export const ibgeEducacaoCenso = () =>
  snapshot(
    900105,
    linhasDaEducacao('4211702', 1, TAXAS_DE_ORLEANS).map((linha) =>
      linha.categoria === 'Município de residência|Superior de graduação' ? { ...linha, valor: '401' } : linha,
    ),
    { ano: ANO_DA_COLETA_IBGE },
  );

export const ibgeEducacaoComparacao = () =>
  snapshot(900106, [...linhasDaEducacao('42', 300, TAXAS_DE_SC), ...linhasDaEducacao('1', 8000, TAXAS_DO_BRASIL)], {
    ano: ANO_DA_COLETA_IBGE,
  });

// IDEB e rede escolar fictícios, com os ids e os caminhos da árvore real das pesquisas 40 e 13.
const IDEB: readonly [id: string, categoria: string, anos: [string, string, string]][] = [
  ['78187', 'Ensino fundamental > Anos iniciais > Pública', ['6.0', '6.2', '6.6']],
  ['78188', 'Ensino fundamental > Anos iniciais > Pública > Municipal', ['5.9', '6.8', '6.4']],
  ['78189', 'Ensino fundamental > Anos iniciais > Pública > Estadual', ['6.0', '5.8', '6.7']],
  ['78192', 'Ensino fundamental > Anos finais > Pública', ['4.9', '4.5', '5.3']],
  ['78193', 'Ensino fundamental > Anos finais > Pública > Municipal', ['4.6', '3.7', '5.1']],
  ['78194', 'Ensino fundamental > Anos finais > Pública > Estadual', ['4.9', '4.6', '5.3']],
  ['78197', 'Ensino médio > Pública', ['-', '-', '3.9']],
  ['78199', 'Ensino médio > Pública > Estadual', ['-', '-', '3.9']],
];

const idebDoLugar = (localidade: string, ajuste: number) =>
  IDEB.flatMap(([id, categoria, anos]) =>
    (['2021', '2023', '2025'] as const).map((periodo, i) => {
      const valor = anos[i]!;
      const noLugar = valor === '-' ? '-' : (Number(valor) + ajuste).toFixed(1);
      return valorIbge('pesquisa-40', id, 'índice', periodo, noLugar, categoria, localidade);
    }),
  );

const REDES_DA_SERIE = { Municipal: 0, Estadual: 1, Privado: 3 };
// Matrículas por série e rede, de 1 a 9 no fundamental e de 1 a 3 no médio.
const FUNDAMENTAL: Record<keyof typeof REDES_DA_SERIE, number[]> = {
  Municipal: [80, 82, 84, 86, 88, 0, 0, 0, 0],
  Estadual: [70, 72, 74, 76, 78, 180, 177, 170, 165],
  Privado: [30, 30, 28, 28, 26, 24, 24, 22, 22],
};
const MEDIO: Record<keyof typeof REDES_DA_SERIE, number[]> = {
  Municipal: [0, 0, 0],
  Estadual: [200, 180, 160],
  Privado: [30, 25, 20],
};
const soma = (valores: number[]) => valores.reduce((total, v) => total + v, 0);
// Zero não existe nesta fonte: rede sem a série vem como `-`.
const contagem = (valor: number) => (valor === 0 ? '-' : String(valor));

const seriesPorRede = (
  localidade: string,
  periodo: string,
  etapa: string,
  nomeDaSerie: (i: number) => string,
  primeiroNo: number,
  primeiraFolha: number,
  etapaId: string,
  matriculas: Record<keyof typeof REDES_DA_SERIE, number[]>,
) => {
  const valor = (id: string | number, categoria: string, numero: number) =>
    valorIbge('pesquisa-13', String(id), 'matrículas', periodo, contagem(numero), categoria, localidade);
  const redes = Object.keys(REDES_DA_SERIE) as (keyof typeof REDES_DA_SERIE)[];
  const quantas = matriculas.Estadual.length;
  return [
    valor(etapaId, etapa, soma(redes.flatMap((r) => matriculas[r]))),
    ...Array.from({ length: quantas }, (_, i) => [
      valor(primeiroNo + i, `${etapa} > ${nomeDaSerie(i)}`, soma(redes.map((r) => matriculas[r][i]!))),
      ...redes.map((rede) =>
        valor(
          primeiraFolha + 4 * i + REDES_DA_SERIE[rede],
          `${etapa} > ${nomeDaSerie(i)} > ${rede}`,
          matriculas[rede][i]!,
        ),
      ),
    ]).flat(),
  ];
};

const redeDoLugar = (localidade: string, periodo: string, extra: number) => {
  const valor = (id: string, unidade: string, categoria: string, numero: number) =>
    valorIbge('pesquisa-13', id, unidade, periodo, String(numero), categoria, localidade);
  const creche = 400 + extra;
  const pre = 300 + extra;
  return [
    valor('77881', 'matrículas', 'Matrículas > Ensino infantil', creche + 150 + pre + 80),
    valor('77882', 'matrículas', 'Matrículas > Ensino infantil > Creche', creche + 150),
    valor('77883', 'matrículas', 'Matrículas > Ensino infantil > Creche > Municipal', creche),
    valor('77886', 'matrículas', 'Matrículas > Ensino infantil > Creche > Privado', 150),
    valor('5903', 'matrículas', 'Matrículas > Ensino infantil > Pré-escolar', pre + 80),
    valor('5904', 'matrículas', 'Matrículas > Ensino infantil > Pré-escolar > Municipal', pre),
    valor('5907', 'matrículas', 'Matrículas > Ensino infantil > Pré-escolar > Privado', 80),
    ...seriesPorRede(
      localidade,
      periodo,
      'Matrículas > Ensino fundamental',
      (i) => `${i + 1}º ano`,
      77899,
      77941,
      '5908',
      FUNDAMENTAL,
    ),
    ...seriesPorRede(
      localidade,
      periodo,
      'Matrículas > Ensino médio',
      (i) => `${i + 1}º série`,
      77908,
      77977,
      '5913',
      MEDIO,
    ),
    valor('77887', 'docentes', 'Docentes > Ensino infantil', 70),
    valor('77889', 'docentes', 'Docentes > Ensino infantil > Creche > Municipal', 40),
    valor('5925', 'docentes', 'Docentes > Ensino infantil > Pré-escolar > Municipal', 50),
    valor('5929', 'docentes', 'Docentes > Ensino fundamental', 150),
    valor('77997', 'docentes', 'Docentes > Ensino fundamental > Anos iniciais > Municipal', 40),
    valor('5934', 'docentes', 'Docentes > Ensino médio', 60),
    valor('77893', 'escolas', 'Escolas > Ensino infantil', 14),
    valor('5950', 'escolas', 'Escolas > Ensino fundamental', 12),
    valor('78053', 'escolas', 'Escolas > Ensino fundamental > Anos iniciais > Municipal', 6),
    valor('5955', 'escolas', 'Escolas > Ensino médio', 3),
  ];
};

export const ibgeRedeEscolar = () =>
  snapshot(
    900107,
    [
      ...idebDoLugar('4211702', 0),
      ...idebDoLugar('42', 0.1),
      ...redeDoLugar('4211702', '2024', 0),
      ...redeDoLugar('4211702', '2025', 10),
      ...redeDoLugar('42', '2024', 50),
      ...redeDoLugar('42', '2025', 60),
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

const contaDoAnexo14 = (conta: string, [valor, percentual]: ValorDoIndice, minimo: string, ano: number) => ({
  id: conta,
  exercicio: ano,
  periodo: 6,
  cod_ibge: 4211702,
  anexo: 'RREO-Anexo 14',
  rotulo: 'Padrão',
  cod_conta: 'ContaFicticia',
  conta,
  colunas: {
    'Valor Apurado Até o Bimestre': valor,
    '% Mínimo a Aplicar no Exercício': minimo,
    '% Aplicado Até o Bimestre': percentual,
  },
});

type ValorDoIndice = [valor: string, percentual: string];

/** O RREO Anexo 14 de um exercício: valor aplicado e percentual dos dois índices legais. */
export const siconfiIndices = ({
  ano = ANO,
  educacao = ['1500000.00', '27.50'],
  fundeb = ['900000.00', '85.00'],
}: { ano?: number; educacao?: ValorDoIndice; fundeb?: ValorDoIndice } = {}) =>
  snapshot(
    900202,
    [
      contaDoAnexo14(
        'Mínimo Anual de <18% / 25%> das Receitas de Impostos na Manutenção e Desenvolvimento do Ensino',
        educacao,
        '25.00',
        ano,
      ),
      contaDoAnexo14(
        'Mínimo Anual de 70% do FUNDEB na Remuneração dos Profissionais da Educação Básica',
        fundeb,
        '70.00',
        ano,
      ),
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
