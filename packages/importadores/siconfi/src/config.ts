// A DCA de Orleans na API do SICONFI (ORDS, sem autenticação). O campo `populacao` da resposta
// não é usado: traz 23.531 em 2024 e 2025, diferente do IBGE.

export const SICONFI = {
  api: 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca',
  anexo: 'DCA-Anexo I-E',
  ente: '4211702',
};

// O RREO: o último bimestre (6) é o que fecha o exercício.
export const SICONFI_RREO = {
  api: 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo',
  demonstrativo: 'RREO',
  anexo: 'RREO-Anexo 14',
  periodo: 6,
};

/** O `fetch` global; injetado para o teste não sair para a rede. */
export type TransporteHttp = (url: string | URL, init?: RequestInit) => Promise<Response>;

export const esperarDeVerdade = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
