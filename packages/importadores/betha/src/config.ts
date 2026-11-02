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

/** O `fetch` global; injetado para o teste não sair para a rede. */
export type TransporteHttp = (url: string | URL, init?: RequestInit) => Promise<Response>;

export const esperarDeVerdade = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
