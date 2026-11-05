// O que as abas do caderno de Educação compartilham: leitura dos lotes publicados, comparação por rede, `faltando` e CSV.
// O que é de uma aba só fica em `<aba>.service.ts`, com o SQL próprio, se houver, em `<aba>.dao.ts`.
import {
  redeSchema,
  type ComparacaoDeEducacao,
  type FonteDoBloco,
  type ValoresDaRede,
} from '@orleans-em-dados/contracts';
import { consultar } from '../../lib/consultas';
import { gerarCsv, type ColunaCsv } from '../../lib/csv';

export const CODIGO_DO_LUGAR: Record<keyof ValoresDaRede, string> = {
  orleans: '4211702',
  santaCatarina: '42',
  brasil: '1',
};
const NOME_DO_LUGAR: Record<keyof ValoresDaRede, string> = {
  orleans: 'Orleans',
  santaCatarina: 'Santa Catarina',
  brasil: 'Brasil',
};
const LUGARES = Object.keys(CODIGO_DO_LUGAR) as (keyof ValoresDaRede)[];

export type LoteDeEducacao = { chave: string; coletaId: number; ano: number; urlOrigem: string };
export type LinhaDoIbge = {
  localidade: string;
  tabela: string;
  variavel: string;
  periodo: string;
  categoria: string;
  valor: number | null;
};
export type LinhaDeEducacao = {
  indicador: string;
  lugar: string;
  rede: string;
  etapa: string;
  recorte: string;
  periodo: string;
  valor: number | null;
  texto: string | null;
  unidade: string;
};

const SELECT_DOS_LOTES = `q.chave, p.coleta_id AS "coletaId", p.ano, q.url_origem AS "urlOrigem"
     FROM publicacoes p
     JOIN consultas q ON q.id = p.consulta_id
     WHERE q.chave = ANY($1::text[])`;

/** O lote publicado de maior ano em cada consulta: o IBGE traz a série inteira nele. */
export const lotesDeMaiorAno = (chaves: readonly string[]) =>
  consultar<LoteDeEducacao>(`SELECT DISTINCT ON (q.chave) ${SELECT_DOS_LOTES} ORDER BY q.chave, p.ano DESC`, [chaves]);

/** Todos os lotes publicados, do ano mais antigo ao mais novo: ENEM e SIOPE são um lote por ano. */
export const lotesDeTodosOsAnos = (chaves: readonly string[]) =>
  consultar<LoteDeEducacao>(`SELECT ${SELECT_DOS_LOTES} ORDER BY q.chave, p.ano`, [chaves]);

export const valoresDoIbge = (lotes: readonly LoteDeEducacao[], tabelas: readonly string[]) =>
  consultar<LinhaDoIbge>(
    `SELECT localidade, tabela, variavel, periodo, categoria, valor
     FROM ibge_valores_publicados
     WHERE coleta_id = ANY($1::bigint[]) AND tabela = ANY($2::text[])`,
    [lotes.map((l) => l.coletaId), tabelas],
  );

export const valoresDeEducacao = (lotes: readonly LoteDeEducacao[]) =>
  consultar<LinhaDeEducacao>(
    `SELECT indicador, lugar, rede, etapa, recorte, periodo, valor, texto, unidade
     FROM educacao_valores_publicados
     WHERE coleta_id = ANY($1::bigint[])`,
    [lotes.map((l) => l.coletaId)],
  );

/** As consultas sem lote, na ordem pedida. É o `faltando` da resposta. */
export const faltandoDe = (chaves: readonly string[], lotes: readonly LoteDeEducacao[]) =>
  chaves.filter((chave) => !lotes.some((l) => l.chave === chave));

/** O nome é o que a tela escreve; o link vem do catálogo de consultas. */
export const fonteDoLote = (lote: LoteDeEducacao, nome: string): FonteDoBloco => ({ nome, url: lote.urlOrigem });

export const lerDoIbge = (
  linhas: readonly LinhaDoIbge[],
  { tabela, variavel, periodo, categoria = '', localidade = CODIGO_DO_LUGAR.orleans }: Partial<LinhaDoIbge>,
) =>
  linhas.find(
    (l) =>
      l.tabela === tabela &&
      (variavel === undefined || l.variavel === variavel) &&
      l.periodo === periodo &&
      l.categoria === categoria &&
      l.localidade === localidade,
  )?.valor ?? null;

/** O mesmo número nos três lugares: a função recebe o código do lugar. */
export const porLugar = (valorDe: (lugar: string) => number | null): ValoresDaRede => ({
  orleans: valorDe(CODIGO_DO_LUGAR.orleans),
  santaCatarina: valorDe(CODIGO_DO_LUGAR.santaCatarina),
  brasil: valorDe(CODIGO_DO_LUGAR.brasil),
});

/** Sem parte ou sem total, sem percentual; zero é dado. Arredonde uma vez só, nas casas que a tela mostra. */
export function emPercentual(parte: number | null, total: number | null, casas = 2) {
  if (parte === null || !total) return null;
  const fator = 10 ** casas;
  return Math.round((parte / total) * 100 * fator) / fator;
}

/** Soma de contagens, nunca de dinheiro. O nulo fica de fora, e tudo nulo é nulo, nunca zero. */
export function somaDosPresentes(valores: readonly (number | null)[]) {
  const presentes = valores.filter((v) => v !== null);
  return presentes.length ? presentes.reduce((soma, v) => soma + v, 0) : null;
}

type Cabecalho = Pick<ComparacaoDeEducacao, 'indicador' | 'etapa' | 'unidade' | 'fonte' | 'meta'>;

/** Rede com rede, em `educacao_valores`: a rede em que nenhum lugar tem dado fica de fora, e `federal` não entra. */
export function comparacaoPorRede(
  linhas: readonly LinhaDeEducacao[],
  { periodo, recorte = '', ...cabecalho }: Cabecalho & { periodo: string; recorte?: string },
): ComparacaoDeEducacao {
  const daComparacao = linhas.filter(
    (l) =>
      l.indicador === cabecalho.indicador &&
      l.etapa === cabecalho.etapa &&
      l.recorte === recorte &&
      l.periodo === periodo,
  );
  const porRede: ComparacaoDeEducacao['porRede'] = {};
  for (const rede of redeSchema.options) {
    const valores = porLugar((lugar) => daComparacao.find((l) => l.rede === rede && l.lugar === lugar)?.valor ?? null);
    if (Object.values(valores).some((v) => v !== null)) porRede[rede] = valores;
  }
  return { ...cabecalho, ano: periodo, porRede };
}

/** O que a fonte não abre por rede, como o Censo do IBGE: conta todas as redes. */
export const comparacaoDosLugares = (
  valores: ValoresDaRede,
  cabecalho: Cabecalho & { ano: string },
): ComparacaoDeEducacao => ({ ...cabecalho, porRede: { todas: valores } });

export type LinhaDoCsv = {
  indicador: string;
  lugar: string;
  rede: string;
  etapa: string;
  ano: string;
  valor: number | string | null;
  unidade: string;
  fonte: string;
};

const COLUNAS_DO_CSV: readonly ColunaCsv[] = [
  ['indicador', 'Indicador'],
  ['lugar', 'Lugar'],
  ['rede', 'Rede'],
  ['etapa', 'Etapa'],
  ['ano', 'Ano'],
  ['valor', 'Valor'],
  ['unidade', 'Unidade'],
  ['fonte', 'Fonte'],
];

/** Uma linha por rede e lugar. O lugar sem dado também sai, com o valor vazio. */
export const linhasDaComparacao = (
  { indicador, etapa, ano, unidade, fonte, porRede }: ComparacaoDeEducacao,
  anoDaLinha = ano,
): LinhaDoCsv[] =>
  Object.entries(porRede).flatMap(([rede, valores]) =>
    LUGARES.map((lugar) => ({
      indicador,
      lugar: NOME_DO_LUGAR[lugar],
      rede,
      etapa,
      ano: anoDaLinha,
      valor: valores[lugar],
      unidade,
      fonte: fonte.nome,
    })),
  );

export const NOME_DE_ORLEANS = NOME_DO_LUGAR.orleans;
export const NOME_DE_SC = NOME_DO_LUGAR.santaCatarina;

export const csvDeEducacao = (linhas: readonly LinhaDoCsv[]) => gerarCsv(COLUNAS_DO_CSV, linhas);
