// As tabelas de agregados do IBGE usadas no painel. Cada variável e categoria foi lida da
// API para Orleans (código 4211702); tabela ou variável nova começa conferindo os metadados.

export const IBGE = {
  api: 'https://servicodados.ibge.gov.br/api/v3/agregados',
  municipio: '4211702',
};

export type ConsultaDeAgregado = {
  tabela: string;
  variaveis: readonly string[];
  /** Formato do parâmetro `classificacao` da API: `2[all]|287[100362]`. */
  classificacao?: string;
  /** Formato do parâmetro `localidades` da API; sem ele, o município de Orleans. */
  localidades?: string;
};

// 2 = sexo; 287 = idade (Total e as faixas de 5 anos, até "100 anos ou mais"); 286 = forma de declaração.
const FAIXAS_DE_IDADE = [
  100362, 93070, 93084, 93085, 93086, 93087, 93088, 93089, 93090, 93091, 93092, 93093, 93094, 93095, 93096, 93097,
  93098, 49108, 49109, 60040, 60041, 6653,
];

export const POPULACAO: readonly ConsultaDeAgregado[] = [
  { tabela: '6579', variaveis: ['9324'] }, // estimativas
  { tabela: '200', variaveis: ['93'] }, // censos até 2010
  { tabela: '4709', variaveis: ['93'] }, // Censo 2022
];

export const CENSO: readonly ConsultaDeAgregado[] = [
  { tabela: '4714', variaveis: ['93', '6318', '614'] }, // população, área e densidade
  { tabela: '9923', variaveis: ['93'], classificacao: '1[all]' }, // situação do domicílio
  { tabela: '9514', variaveis: ['93'], classificacao: `2[all]|287[${FAIXAS_DE_IDADE.join(',')}]|286[113635]` },
  { tabela: '10295', variaveis: ['13431', '13534'] }, // rendimento domiciliar per capita: médio e mediano
];

export const VARIAVEIS_DO_PIB = {
  pib: '37',
  valorAdicionado: '498',
  agropecuaria: '513',
  industria: '517',
  servicos: '6575',
  administracao: '525',
  impostos: '543',
};

export const PIB: readonly ConsultaDeAgregado[] = [{ tabela: '5938', variaveis: Object.values(VARIAVEIS_DO_PIB) }];

// Os lugares com que Orleans é comparada: os mesmos agregados, cada um com o código de localidade do IBGE.
export const LUGARES_DA_COMPARACAO = [
  { localidade: '1', nome: 'Brasil', campo: 'brasil' },
  { localidade: '42', nome: 'Santa Catarina', campo: 'santa_catarina' },
];

export const COMPARACAO: readonly ConsultaDeAgregado[] = [...POPULACAO, ...CENSO, ...PIB].map((agregado) => ({
  ...agregado,
  localidades: 'N1[all]|N3[42]',
}));

/** O `fetch` global; injetado para o teste não sair para a rede. */
export type TransporteHttp = (url: string | URL, init?: RequestInit) => Promise<Response>;

export const esperarDeVerdade = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
