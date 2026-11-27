// O catálogo das páginas do painel: caminho, título, descrição e fontes de cada uma, num lugar só.
// A tela navega por ele, e a API monta com ele o head, o sitemap, o JSON-LD e o 404.
// Título e descrição são escritos à mão e não levam número: nunca desatualizam nem fogem da regra do selo.

export type FonteDaPagina = { nome: string; url: string };

export const FONTES = {
  betha: {
    nome: 'Portal da Transparência de Orleans',
    url: 'https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==',
  },
  tcesc: { nome: 'Farol do TCE-SC', url: 'https://servicos.tcesc.tc.br/farol_externo/' },
  siconfi: { nome: 'SICONFI (Tesouro Nacional)', url: 'https://www.siconfi.tesouro.gov.br/' },
  ibge: { nome: 'IBGE', url: 'https://servicodados.ibge.gov.br/api/docs' },
  inep: { nome: 'INEP', url: 'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos' },
  siope: { nome: 'SIOPE (FNDE)', url: 'https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope' },
  mec: { nome: 'MEC', url: 'https://www.gov.br/mec/pt-br/pnei/retrato-da-educacao-infantil-no-brasil' },
} as const satisfies Record<string, FonteDaPagina>;

const { betha, tcesc, siconfi, ibge, inep, siope, mec } = FONTES;
const TODAS = Object.values(FONTES);
const DA_EDUCACAO = [inep, ibge, siope, siconfi, mec];

export const IDS_DAS_PAGINAS = [
  'visao-geral',
  'conheca-orleans',
  'financas',
  'receitas',
  'despesas',
  'para-onde-vai',
  'educacao',
  'educacao-aprendizado',
  'educacao-acesso',
  'educacao-permanencia',
  'educacao-professores',
  'educacao-dinheiro',
  'educacao-cidade',
  'discrepancias',
  'metodologia',
  'apoiar',
] as const;

export type IdDaPagina = (typeof IDS_DAS_PAGINAS)[number];

export type Pagina = {
  id: IdDaPagina;
  caminho: string;
  /** O nome na navegação. */
  nome: string;
  /** O `<title>`: até 60 caracteres. */
  titulo: string;
  /** A meta description: de 70 a 160 caracteres, sem número. */
  descricao: string;
  /** A página de primeiro nível onde esta fica; a própria, quando é uma área. */
  area: IdDaPagina;
  /** Os endereços com `#` de antes das rotas por caminho, que ainda abrem a página. */
  hashesAntigos: readonly string[];
  fontes: readonly FonteDaPagina[];
  /** A página descreve um conjunto de dados (`schema.org/Dataset` no JSON-LD). */
  dataset: boolean;
  /** Aparece na navegação. */
  menu: boolean;
};

const SUFIXO = ' · Orleans em Dados';

export const PAGINAS: readonly Pagina[] = [
  {
    id: 'visao-geral',
    caminho: '/',
    nome: 'Início',
    titulo: 'Orleans em Dados · Dados públicos de Orleans/SC',
    descricao:
      'Receitas, despesas, educação e a cidade de Orleans/SC em dados públicos, cada número com fonte, ano e conferência entre as fontes.',
    area: 'visao-geral',
    hashesAntigos: ['#visao-geral'],
    fontes: TODAS,
    dataset: false,
    menu: true,
  },
  {
    id: 'conheca-orleans',
    caminho: '/conheca-orleans',
    nome: 'Conheça Orleans',
    titulo: `População, PIB e renda de Orleans/SC${SUFIXO}`,
    descricao:
      'População, território, idade, rendimento e PIB de Orleans/SC pelo IBGE, comparados com Santa Catarina e o Brasil, cada número com o próprio ano.',
    area: 'conheca-orleans',
    hashesAntigos: ['#conheca-orleans'],
    fontes: [ibge],
    dataset: true,
    menu: true,
  },
  {
    id: 'financas',
    caminho: '/financas',
    nome: 'Finanças',
    titulo: `Finanças públicas de Orleans/SC${SUFIXO}`,
    descricao:
      'Quanto o município de Orleans/SC arrecadou e gastou no exercício, com receitas e despesas do Portal da Transparência conferidas com o TCE-SC.',
    area: 'financas',
    hashesAntigos: ['#financas'],
    fontes: [betha, tcesc],
    dataset: false,
    menu: true,
  },
  {
    id: 'receitas',
    caminho: '/financas/receitas',
    nome: 'Receitas',
    titulo: `Receitas do município de Orleans/SC${SUFIXO}`,
    descricao:
      'Receitas do município de Orleans/SC por mês, origem e rubrica, do Portal da Transparência conferidas com o TCE-SC, com a previsão e a arrecadação.',
    area: 'financas',
    hashesAntigos: ['#receitas'],
    fontes: [betha, tcesc],
    dataset: true,
    menu: true,
  },
  {
    id: 'despesas',
    caminho: '/financas/despesas',
    nome: 'Despesas',
    titulo: `Despesas e empenhos de Orleans/SC${SUFIXO}`,
    descricao:
      'Despesas e empenhos de Orleans/SC por entidade, órgão e credor, com busca nos empenhos e o empenhado, liquidado e pago conferidos com o TCE-SC.',
    area: 'financas',
    hashesAntigos: ['#despesas'],
    fontes: [betha, tcesc],
    dataset: true,
    menu: true,
  },
  {
    id: 'para-onde-vai',
    caminho: '/financas/para-onde-vai',
    nome: 'Para onde vai',
    titulo: `Para onde vai o dinheiro de Orleans/SC${SUFIXO}`,
    descricao:
      'Para onde vai o dinheiro de Orleans/SC: a despesa por função, de saúde e educação a transporte, ano a ano, pela declaração do município ao SICONFI.',
    area: 'financas',
    hashesAntigos: ['#para-onde-vai'],
    fontes: [siconfi, tcesc, betha],
    dataset: true,
    menu: true,
  },
  {
    id: 'educacao',
    caminho: '/educacao',
    nome: 'Educação',
    titulo: `Educação pública em Orleans/SC${SUFIXO}`,
    descricao:
      'Educação pública em Orleans/SC: IDEB, alfabetização, creche, abandono, professores e gasto, comparados com Santa Catarina e o Brasil.',
    area: 'educacao',
    hashesAntigos: ['#educacao'],
    fontes: DA_EDUCACAO,
    dataset: true,
    menu: true,
  },
  {
    id: 'educacao-aprendizado',
    caminho: '/educacao/aprendizado',
    nome: 'Aprendizado',
    titulo: `IDEB e aprendizado em Orleans/SC${SUFIXO}`,
    descricao:
      'IDEB, notas das provas, alfabetização e ENEM das escolas de Orleans/SC, rede com rede, comparados com Santa Catarina e o Brasil, pelo INEP.',
    area: 'educacao',
    hashesAntigos: ['#educacao-aprendizado'],
    fontes: DA_EDUCACAO,
    dataset: false,
    menu: true,
  },
  {
    id: 'educacao-acesso',
    caminho: '/educacao/acesso',
    nome: 'Acesso',
    titulo: `Creche, pré-escola e escola em Orleans/SC${SUFIXO}`,
    descricao:
      'Quantas crianças e jovens de Orleans/SC frequentam creche, pré-escola e escola, pelo Censo do IBGE, diante de Santa Catarina, do Brasil e da meta nacional.',
    area: 'educacao',
    hashesAntigos: ['#educacao-acesso'],
    fontes: DA_EDUCACAO,
    dataset: false,
    menu: true,
  },
  {
    id: 'educacao-permanencia',
    caminho: '/educacao/permanencia',
    nome: 'Permanência',
    titulo: `Abandono e evasão escolar em Orleans/SC${SUFIXO}`,
    descricao:
      'Aprovação, reprovação, abandono, evasão e distorção idade-série nas escolas de Orleans/SC, por etapa e rede, comparadas com Santa Catarina e o Brasil.',
    area: 'educacao',
    hashesAntigos: ['#educacao-permanencia'],
    fontes: DA_EDUCACAO,
    dataset: false,
    menu: true,
  },
  {
    id: 'educacao-professores',
    caminho: '/educacao/professores-e-turmas',
    nome: 'Professores e turmas',
    titulo: `Professores e turmas em Orleans/SC${SUFIXO}`,
    descricao:
      'Professores e turmas em Orleans/SC: alunos por turma, formação dos docentes, horas de aula e remuneração declarada, rede com rede, pelo INEP e pelo SIOPE.',
    area: 'educacao',
    hashesAntigos: ['#educacao-professores'],
    fontes: DA_EDUCACAO,
    dataset: false,
    menu: true,
  },
  {
    id: 'educacao-dinheiro',
    caminho: '/educacao/dinheiro',
    nome: 'Dinheiro',
    titulo: `Gasto com educação em Orleans/SC${SUFIXO}`,
    descricao:
      'Quanto Orleans/SC gasta com educação: o mínimo constitucional, o Fundeb e o gasto por aluno, pelo SIOPE e pelo SICONFI, ano a ano.',
    area: 'educacao',
    hashesAntigos: ['#educacao-dinheiro'],
    fontes: DA_EDUCACAO,
    dataset: false,
    menu: true,
  },
  {
    id: 'educacao-cidade',
    caminho: '/educacao/cidade-e-ensino-superior',
    nome: 'Cidade e ensino superior',
    titulo: `Ensino superior em Orleans/SC${SUFIXO}`,
    descricao:
      'A escolaridade dos moradores de Orleans/SC e o ensino superior oferecido na cidade: alfabetização, cursos, vagas e notas, pelo IBGE e pelo INEP.',
    area: 'educacao',
    hashesAntigos: ['#educacao-cidade'],
    fontes: DA_EDUCACAO,
    dataset: false,
    menu: true,
  },
  {
    id: 'discrepancias',
    caminho: '/discrepancias',
    nome: 'Discrepâncias',
    titulo: `Discrepâncias entre as fontes${SUFIXO}`,
    descricao:
      'Onde o Portal da Transparência de Orleans/SC, o TCE-SC, o SICONFI e o SIOPE registram valores diferentes, separado por tipo e com a conta de cada caso.',
    area: 'discrepancias',
    hashesAntigos: ['#discrepancias', '#conferencia'],
    fontes: [betha, tcesc, siconfi, siope],
    dataset: false,
    menu: true,
  },
  {
    id: 'metodologia',
    caminho: '/sobre-os-dados',
    nome: 'Sobre os dados',
    titulo: `Fontes e metodologia${SUFIXO}`,
    descricao:
      'De onde vêm os números do Orleans em Dados, como as fontes são conferidas, o que quer dizer cada selo e o que o site faz com dados pessoais.',
    area: 'metodologia',
    hashesAntigos: ['#metodologia'],
    fontes: TODAS,
    dataset: false,
    menu: true,
  },
  {
    id: 'apoiar',
    caminho: '/apoiar',
    nome: 'Apoiar',
    titulo: `Apoie o projeto${SUFIXO}`,
    descricao:
      'Apoie o Orleans em Dados, projeto independente que publica os dados públicos de Orleans/SC com fonte e conferência, com um Pix para a hospedagem.',
    area: 'apoiar',
    hashesAntigos: [],
    fontes: [],
    dataset: false,
    menu: false,
  },
];

const PELO_CAMINHO = new Map(PAGINAS.map((p) => [p.caminho, p]));
const PELO_HASH = new Map(PAGINAS.flatMap((p) => p.hashesAntigos.map((hash) => [hash, p] as const)));

export const paginaPeloId = (id: IdDaPagina): Pagina => PAGINAS.find((p) => p.id === id)!;

/**
 * A página do caminho pedido. Com barra no fim, acha a página e diz para onde redirecionar.
 * Caixa diferente não é adivinhada: `/Financas` não existe, e o servidor responde 404.
 */
export function paginaDoCaminho(caminho: string): { pagina: Pagina; redirecionar: string | null } | null {
  const exato = PELO_CAMINHO.get(caminho);
  if (exato) return { pagina: exato, redirecionar: null };
  if (caminho.length > 1 && caminho.endsWith('/')) {
    const semBarra = caminho.replace(/\/+$/, '');
    const pagina = PELO_CAMINHO.get(semBarra);
    if (pagina && semBarra) return { pagina, redirecionar: semBarra };
  }
  return null;
}

/** O caminho novo de um link antigo com `#` (`#educacao-dinheiro` → `/educacao/dinheiro`); nulo se não é um. */
export const caminhoDoHashAntigo = (hash: string): string | null => PELO_HASH.get(hash)?.caminho ?? null;
