// Dados estruturados (schema.org) de cada página: a capa é `WebSite`; as páginas de dados, `Dataset`,
// lidas pelo Google Dataset Search; as de segundo nível, `BreadcrumbList`. Só descrevem: nome, período,
// fonte e licença, nunca um número do painel.
import { PAGINAS, type IdDaPagina, type Pagina } from '@orleans-em-dados/contracts';
import { urlDoSite } from './head';

export type OpcoesDoJsonLd = {
  /** O endereço público, sem barra no fim. */
  siteUrl: string;
  /** Os exercícios publicados (de `/api/anos`), em qualquer ordem. */
  anos: readonly number[];
};

type Bloco = Record<string, unknown>;

const NOME_DO_SITE = 'Orleans em Dados';
const LICENCA = 'https://creativecommons.org/licenses/by/4.0/';
const SUFIXO_DO_TITULO = / · Orleans em Dados$/;
const ORLEANS = {
  '@type': 'City',
  name: 'Orleans',
  containedInPlace: {
    '@type': 'State',
    name: 'Santa Catarina',
    containedInPlace: { '@type': 'Country', name: 'Brasil' },
  },
};

// Os exercícios de `/api/anos` são os das coletas da Betha: dizem o período de receitas e despesas,
// e não o do IBGE, o do SICONFI nem o da Educação.
const COM_OS_EXERCICIOS: readonly IdDaPagina[] = ['receitas', 'despesas'];
// Só o CSV de receitas é distribuição: o de empenhos traz nome de credor que pode ser pessoa física.
const CSV_DO_ULTIMO_ANO: Partial<Record<IdDaPagina, string>> = { receitas: '/api/receitas.csv' };

const organizacao = (siteUrl: string) => ({
  '@type': 'Organization',
  name: NOME_DO_SITE,
  url: urlDoSite(siteUrl, '/'),
});

function trilha(pagina: Pagina, siteUrl: string): Bloco | null {
  if (pagina.area === pagina.id) return null;
  const area = PAGINAS.find((p) => p.id === pagina.area);
  const inicio = PAGINAS.find((p) => p.id === 'visao-geral');
  if (!area || !inicio) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [inicio, area, pagina].map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.nome,
      item: urlDoSite(siteUrl, p.caminho),
    })),
  };
}

function conjuntoDeDados(pagina: Pagina, { siteUrl, anos }: OpcoesDoJsonLd): Bloco {
  const comExercicios = COM_OS_EXERCICIOS.includes(pagina.id) && anos.length > 0;
  const primeiro = Math.min(...anos);
  const ultimo = Math.max(...anos);
  const csv = CSV_DO_ULTIMO_ANO[pagina.id];
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: pagina.titulo.replace(SUFIXO_DO_TITULO, ''),
    description: pagina.descricao,
    url: urlDoSite(siteUrl, pagina.caminho),
    inLanguage: 'pt-BR',
    isAccessibleForFree: true,
    license: LICENCA,
    creator: organizacao(siteUrl),
    publisher: organizacao(siteUrl),
    spatialCoverage: ORLEANS,
    ...(comExercicios ? { temporalCoverage: primeiro === ultimo ? `${ultimo}` : `${primeiro}/${ultimo}` } : {}),
    isBasedOn: pagina.fontes.map((f) => ({ '@type': 'CreativeWork', name: f.nome, url: f.url })),
    ...(csv && anos.length
      ? {
          distribution: [
            {
              '@type': 'DataDownload',
              encodingFormat: 'text/csv',
              contentUrl: urlDoSite(siteUrl, `${csv}?ano=${ultimo}`),
            },
          ],
        }
      : {}),
  };
}

/** Os blocos de JSON-LD da página, na ordem em que entram no head. */
export function jsonLdDaPagina(pagina: Pagina, opcoes: OpcoesDoJsonLd): Bloco[] {
  const blocos: Bloco[] = [];
  if (pagina.id === 'visao-geral') {
    blocos.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: NOME_DO_SITE,
      url: urlDoSite(opcoes.siteUrl, '/'),
      description: pagina.descricao,
      inLanguage: 'pt-BR',
      about: ORLEANS,
      publisher: organizacao(opcoes.siteUrl),
    });
  }
  if (pagina.dataset) blocos.push(conjuntoDeDados(pagina, opcoes));
  const breadcrumb = trilha(pagina, opcoes.siteUrl);
  if (breadcrumb) blocos.push(breadcrumb);
  return blocos;
}

/** JSON para dentro de `<script>`: `</` e `<!--` num texto não fecham a tag nem abrem comentário. */
export const serializarJsonLd = (bloco: unknown) =>
  JSON.stringify(bloco).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\u0021--');
