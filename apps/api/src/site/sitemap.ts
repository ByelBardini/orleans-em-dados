// O sitemap.xml: todas as páginas do catálogo, com o endereço absoluto. O `lastmod` só sai onde há data
// de verdade, a da última coleta publicada da Betha, nas páginas de finanças; nas outras, nenhuma data.
import { PAGINAS, type IdDaPagina } from '@orleans-em-dados/contracts';
import { escaparHtml, urlDoSite } from './head';

export type OpcoesDoSitemap = {
  siteUrl: string;
  apoioAtivo: boolean;
  /** A data de cada exercício publicado (`/api/anos`): texto ISO ou `Date`, como vem do pg. */
  atualizadoEm: Record<string, string | Date>;
};

const COM_A_DATA_DA_COLETA: readonly IdDaPagina[] = ['financas', 'receitas', 'despesas'];

/** A data mais recente, em `AAAA-MM-DD`; nula sem nenhuma válida. */
function ultimaData(datas: readonly (string | Date)[]): string | null {
  const tempos = datas.map((d) => new Date(d).getTime()).filter((t) => Number.isFinite(t));
  return tempos.length ? new Date(Math.max(...tempos)).toISOString().slice(0, 10) : null;
}

export function montarSitemap({ siteUrl, apoioAtivo, atualizadoEm }: OpcoesDoSitemap) {
  const lastmod = ultimaData(Object.values(atualizadoEm));
  const urls = PAGINAS.filter((p) => p.id !== 'apoiar' || apoioAtivo).map((p) => {
    const data = lastmod && COM_A_DATA_DA_COLETA.includes(p.id) ? `\n    <lastmod>${lastmod}</lastmod>` : '';
    return `  <url>\n    <loc>${escaparHtml(urlDoSite(siteUrl, p.caminho))}</loc>${data}\n  </url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
