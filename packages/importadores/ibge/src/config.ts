// As tabelas de agregados do IBGE usadas no painel. Cada variável e categoria foi lida da
// API para Orleans (código 4211702); tabela ou variável nova começa conferindo os metadados.

export const IBGE = {
  api: 'https://servicodados.ibge.gov.br/api/v3/agregados',
  apiDePesquisas: 'https://servicodados.ibge.gov.br/api/v1/pesquisas',
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

// Censo de educação. Os recortes vêm das URLs de docs/educacao/extratos/ibge-censo.json; recortes da mesma tabela
// repetem linhas (o total, por exemplo), que a coleta tira. 2 = sexo, 58 = idade, 2661 = localização, 1 = situação,
// 59 = alfabetização, 86 = cor ou raça, 11798 = nível, 1568 = instrução, 468 = local da escola, 11322 = curso.
const LOCAL_DA_ESCOLA = (local: string, curso: string) => `468[${local}]|2[6794]|58[95253]|11322[${curso}]`;

export const EDUCACAO_CENSO: readonly ConsultaDeAgregado[] = [
  { tabela: '10091', variaveis: ['2513'], classificacao: '2[all]|58[95253]|2661[32776]|1[6795]' }, // alfabetização, sexo
  { tabela: '10091', variaveis: ['2513'], classificacao: '2[6794]|58[all]|2661[32776]|1[6795]' }, // idade
  { tabela: '10091', variaveis: ['2513'], classificacao: '2[6794]|58[95253]|2661[32776]|1[all]' }, // situação
  { tabela: '10092', variaveis: ['950'], classificacao: '59[all]|2[6794]|58[95253]|2661[32776]|1[6795]' },
  {
    tabela: '10056',
    variaveis: ['3795'],
    classificacao: '58[95253,99749,47813,31615,2792,100052,108866]|2[6794]|86[95251]',
  },
  { tabela: '10057', variaveis: ['13282'], classificacao: '11798[all]|58[95253,99749,47813]|2[6794]|86[95251]' },
  { tabela: '10058', variaveis: ['13283'], classificacao: '11798[all]|58[95253]|2[6794]|86[95251]' },
  { tabela: '10059', variaveis: ['13284'], classificacao: '11798[all]|58[95253]|2[6794]|86[95251]' },
  { tabela: '10061', variaveis: ['2667'], classificacao: '1568[all]|58[108866]|2[6794]|86[95251]' },
  { tabela: '10061', variaveis: ['2667'], classificacao: '1568[99713]|58[108866]|2[all]|86[95251]' }, // superior, sexo
  { tabela: '10062', variaveis: ['13285'], classificacao: '58[95253,108866,100052]|2[all]|86[95251]' },
  { tabela: '10324', variaveis: ['2021'], classificacao: LOCAL_DA_ESCOLA('all', '79175') }, // todos os cursos
  { tabela: '10324', variaveis: ['2021'], classificacao: LOCAL_DA_ESCOLA('12164', 'all') }, // outro município, por curso
  { tabela: '10324', variaveis: ['2021'], classificacao: LOCAL_DA_ESCOLA('all', '121405') }, // graduação
  { tabela: '10324', variaveis: ['2021'], classificacao: LOCAL_DA_ESCOLA('all', '12123') }, // pós-graduação
  { tabela: '1549', variaveis: ['93', '364'], classificacao: '58[all]' }, // Censo 2010: população e quem frequentava
];

export const EDUCACAO_COMPARACAO: readonly ConsultaDeAgregado[] = EDUCACAO_CENSO.map((agregado) => ({
  ...agregado,
  localidades: 'N1[all]|N3[42]',
}));

// Pesquisas 40 (IDEB) e 13 (rede escolar). O Brasil não responde nesta API: IDEB nacional só no arquivo do INEP.
export const PESQUISAS_DE_EDUCACAO = ['40', '13'];
export const LUGARES_DAS_PESQUISAS = [
  { localidade: IBGE.municipio, nome: 'Orleans', campo: 'orleans' },
  { localidade: '42', nome: 'Santa Catarina', campo: 'santa_catarina' },
];

/** O `fetch` global; injetado para o teste não sair para a rede. */
export type TransporteHttp = (url: string | URL, init?: RequestInit) => Promise<Response>;

export const esperarDeVerdade = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// IPCA: tabela 1737, número-índice (dezembro de 1993 = 100), mensal, só do Brasil. Corrige o dinheiro pela inflação.
export const IPCA: readonly ConsultaDeAgregado[] = [{ tabela: '1737', variaveis: ['2266'], localidades: 'N1[all]' }];
export const LOCALIDADE_DO_IPCA = '1';
