// Parâmetros observados no Portal da Transparência Betha de Orleans.
// São endpoints internos do portal: estabilidade e autorização de uso
// automatizado contínuo ainda não foram confirmadas (ver docs/FONTES_DE_DADOS.md).

export const BETHA = {
  api: 'https://api.transparencia.betha.cloud',
  portalUrl: 'https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==',
  // Contexto do portal de Orleans ({"portal":"mJRAZlfGu2RI9KNBWj49aw=="}); não é credencial.
  appContext: 'eyJwb3J0YWwiOiJtSlJBWmxmR3UyUkk5S05CV2o0OWF3PT0ifQ==',
  oauth: {
    authorizeUrl: 'https://plataforma-oauth.betha.cloud/auth/oauth2/authorize',
    clientId: '91a97459-f1d8-4b29-b5fa-2e51d1692623',
    redirectUri: 'https://transparencia.betha.cloud/auth-callback.html',
    scope: 'transparencia.public',
  },
};

// Cada consulta usa um esquema de filtro próprio: 57140 usa `anoExercicio`, 57153 usa `ano`.
export const CONSULTAS = {
  receitas: {
    id: 57153,
    nome: 'Receitas Orçamentárias',
    filtro: (ano) => ({ ano: [String(ano)] }),
    camposSoma: ['valorOrcadoAtualizado', 'valorArrecadadoNoMes'],
  },
  empenhos: {
    id: 57140,
    nome: 'Execução Detalhada de Despesas',
    filtro: (ano) => ({ anoExercicio: [String(ano)] }),
    camposSoma: ['valorEmpenho', 'valorLiquidadoEmpenho', 'valorPagoEmpenho'],
  },
};

export const urlConsulta = (id) => `${BETHA.portalUrl}/consulta/${id}`;
