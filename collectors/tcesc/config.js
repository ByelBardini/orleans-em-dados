// Parâmetros observados nos painéis públicos do Farol TCE-SC (Qlik Sense).
// Não é uma API documentada pelo Tribunal: IDs de app e nomes de campo podem
// mudar após recargas ou reformulações dos painéis.

export const TCESC = {
  origin: 'https://paineistransparencia.tce.sc.gov.br',
  wsBase: 'wss://paineistransparencia.tce.sc.gov.br',
  portalUrl: 'https://servicos.tcesc.tc.br/farol_externo/',
  municipio: 'ORLEANS',
  apps: {
    receitas: {
      id: 'c97cd52c-9dd8-4c8c-83c4-733d037539f9',
      painel: 'https://paineistransparencia.tce.sc.gov.br/extensions/appReceitasMunicipaisExterno/index.html',
    },
    despesas: {
      id: '74a8ae0b-233d-44e6-b341-1f718d19802f',
      painel: 'https://paineistransparencia.tce.sc.gov.br/extensions/appDespesasMunicipaisExternoNovo/index.html',
    },
  },
};

// Cada consulta é um hipercubo de sessão montado pelo coletor, não um gráfico
// do painel: as medidas reproduzem as expressões dos objetos publicados
// (czJXw/BEq usam Sum(LiquidoEmpenho); Ztufrs usa Sum(valorarrecadado)).
// `dimensoes` formam a chave da linha; medidas com `soma: true` são
// conferidas contra o total geral calculado pelo próprio motor Qlik.
export const CONSULTAS = {
  receitas: {
    id: 900001,
    app: 'receitas',
    nome: 'Receitas Municipais — arrecadação por natureza e mês',
    filtroEnte: 'nome_ente',
    filtroAno: 'ano_competencia',
    dimensoes: ['nomeunidade', 'codigoreceita', 'Mês', 'descricaotipodeducaoreceita'],
    medidas: [
      { campo: 'valorArrecadado', expr: 'Sum(valorarrecadado)', soma: true },
      { campo: 'natureza', expr: 'Only(espnaturezareceita)' },
    ],
  },
  empenhos: {
    id: 900002,
    app: 'despesas',
    nome: 'Despesas Municipais — empenhos do exercício',
    filtroEnte: 'Ente',
    filtroAno: 'Ano_Empenho',
    dimensoes: ['ID Empenho'],
    medidas: [
      { campo: 'valorEmpenhado', expr: 'Sum(LiquidoEmpenho)', soma: true },
      { campo: 'valorLiquidado', expr: 'Sum(LiquidoLiquidacao)', soma: true },
      { campo: 'valorPago', expr: 'Sum(LiquidoPagamento)', soma: true },
      { campo: 'valorOriginal', expr: 'Sum([Valor Empenho])', soma: true },
      { campo: 'valorReforco', expr: 'Sum([Valor Reforço])', soma: true },
      { campo: 'valorEstorno', expr: 'Sum([Valor Estorno])', soma: true },
      { campo: 'codigoUG', expr: 'Only(identificadorUG)' },
      { campo: 'numero', expr: 'Only([Num Empenho])' },
      { campo: 'dataEmpenho', expr: "Date(Only([Data Empenho]), 'YYYY-MM-DD')" },
      { campo: 'credor', expr: 'Only(NOME_CREDOR)' },
      { campo: 'historico', expr: 'Only([Descrição Histórico Empenho])' },
    ],
  },
};
