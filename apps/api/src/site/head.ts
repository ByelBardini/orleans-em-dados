// O head de cada página, no HTML que o servidor entrega: buscador sem JS e prévia de link (WhatsApp,
// Facebook, LinkedIn) não rodam o React, então título, descrição, canonical e imagem já vêm aqui.
import type { Pagina } from '@orleans-em-dados/contracts';

export type PaginaDoHead = Pick<Pagina, 'caminho' | 'titulo' | 'descricao'>;

export type OpcoesDoHead = {
  /** O endereço público do site (`https://…`, sem barra no fim). Sem ele, nada de URL absoluta. */
  siteUrl?: string | undefined;
  /** O código da meta `google-site-verification` do Search Console. */
  verificacaoGoogle?: string | undefined;
  /** Os blocos de JSON-LD já serializados para o `<script>`. */
  jsonLd?: readonly string[];
};

const NOME_DO_SITE = 'Orleans em Dados';
const TITULO_NAO_ENCONTRADA = `Página não encontrada · ${NOME_DO_SITE}`;
const IMAGEM = {
  caminho: '/og.png',
  largura: '1200',
  altura: '630',
  alt: 'Orleans em Dados: dados públicos de Orleans/SC',
};

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Texto seguro dentro de tag e de atributo entre aspas. */
export const escaparHtml = (texto: string) => texto.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

const meta = (chave: 'name' | 'property', nome: string, conteudo: string) =>
  `<meta ${chave}="${nome}" content="${escaparHtml(conteudo)}" />`;

/** A URL absoluta do caminho no site público. */
export const urlDoSite = (siteUrl: string, caminho: string) => `${siteUrl}${caminho}`;

/** O head da página; `null` é a página não encontrada, com `noindex`. */
export function montarHead(pagina: PaginaDoHead | null, { siteUrl, verificacaoGoogle, jsonLd = [] }: OpcoesDoHead) {
  const linhas: string[] = [];
  if (!pagina) {
    linhas.push(`<title>${escaparHtml(TITULO_NAO_ENCONTRADA)}</title>`, meta('name', 'robots', 'noindex'));
  } else {
    const url = siteUrl ? urlDoSite(siteUrl, pagina.caminho) : null;
    linhas.push(
      `<title>${escaparHtml(pagina.titulo)}</title>`,
      meta('name', 'description', pagina.descricao),
      ...(url ? [`<link rel="canonical" href="${escaparHtml(url)}" />`] : []),
      meta('property', 'og:type', 'website'),
      meta('property', 'og:locale', 'pt_BR'),
      meta('property', 'og:site_name', NOME_DO_SITE),
      meta('property', 'og:title', pagina.titulo),
      meta('property', 'og:description', pagina.descricao),
      ...(url ? [meta('property', 'og:url', url)] : []),
      ...(siteUrl
        ? [
            meta('property', 'og:image', urlDoSite(siteUrl, IMAGEM.caminho)),
            meta('property', 'og:image:width', IMAGEM.largura),
            meta('property', 'og:image:height', IMAGEM.altura),
            meta('property', 'og:image:alt', IMAGEM.alt),
          ]
        : []),
      meta('name', 'twitter:card', 'summary_large_image'),
      meta('name', 'twitter:title', pagina.titulo),
      meta('name', 'twitter:description', pagina.descricao),
      ...(siteUrl ? [meta('name', 'twitter:image', urlDoSite(siteUrl, IMAGEM.caminho))] : []),
      ...jsonLd.map((bloco) => `<script type="application/ld+json">${bloco}</script>`),
    );
  }
  if (verificacaoGoogle) linhas.push(meta('name', 'google-site-verification', verificacaoGoogle));
  return linhas.join('\n    ');
}
