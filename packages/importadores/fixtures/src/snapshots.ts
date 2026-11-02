// Snapshots fictícios das cinco consultas, no formato que os coletores entregam a
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

const receita = (
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

const empenho = (
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

const despesa = (
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

const PREFEITURA_TCE = 'Prefeitura Municipal de Orleans';
const FMS_TCE = 'Fundo Municipal de Saúde de Orleans';

const receitaTce = (unidade: string, codigoreceita: string, natureza: string, mes: string, valor: string) => ({
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

const empenhoTce = (
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
