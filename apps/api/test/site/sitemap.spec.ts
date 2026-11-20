import { describe, expect, it } from 'vitest';
import { montarSitemap } from '../../src/site/sitemap.js';

const SITE = 'https://exemplo.test';
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
// O lastmod do `<url>` de um endereço, se houver.
const lastmodDe = (xml: string, loc: string) =>
  xml
    .split('<url>')
    .find((bloco) => bloco.includes(`<loc>${loc}</loc>`))
    ?.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1];

describe('montarSitemap', () => {
  it('lista as quinze páginas sem a Apoiar, com endereço absoluto e sem #', () => {
    const xml = montarSitemap({ siteUrl: SITE, apoioAtivo: false, atualizadoEm: {} });

    expect(locs(xml)).toHaveLength(15);
    expect(locs(xml)).toContain('https://exemplo.test/');
    expect(locs(xml)).toContain('https://exemplo.test/educacao/cidade-e-ensino-superior');
    expect(locs(xml)).not.toContain('https://exemplo.test/apoiar');
    expect(xml).not.toContain('#');
  });

  it('com o apoio ativo, a página Apoiar entra', () => {
    const xml = montarSitemap({ siteUrl: SITE, apoioAtivo: true, atualizadoEm: {} });

    expect(locs(xml)).toHaveLength(16);
    expect(locs(xml)).toContain('https://exemplo.test/apoiar');
  });

  it('é um urlset do protocolo de sitemaps, com a declaração XML', () => {
    const xml = montarSitemap({ siteUrl: SITE, apoioAtivo: false, atualizadoEm: {} });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  });

  it('as páginas de finanças levam a data da última coleta publicada, em AAAA-MM-DD', () => {
    const atualizadoEm = { 2024: '2025-02-01T09:00:00.000Z', 2025: '2026-03-10T06:00:00.000Z' };

    const xml = montarSitemap({ siteUrl: SITE, apoioAtivo: false, atualizadoEm });

    expect(lastmodDe(xml, 'https://exemplo.test/financas/receitas')).toBe('2026-03-10');
    expect(lastmodDe(xml, 'https://exemplo.test/financas/despesas')).toBe('2026-03-10');
    expect(lastmodDe(xml, 'https://exemplo.test/financas')).toBe('2026-03-10');
  });

  it('a data da coleta chega também como Date, do pg', () => {
    const xml = montarSitemap({
      siteUrl: SITE,
      apoioAtivo: false,
      atualizadoEm: { 2025: new Date('2026-03-10T06:00:00.000Z') },
    });

    expect(lastmodDe(xml, 'https://exemplo.test/financas/receitas')).toBe('2026-03-10');
  });

  // Só a coleta da Betha tem data no banco: nas outras páginas, data nenhuma, em vez de uma inventada.
  it('nenhuma página fora de finanças ganha lastmod', () => {
    const xml = montarSitemap({ siteUrl: SITE, apoioAtivo: false, atualizadoEm: { 2025: '2026-03-10T06:00:00.000Z' } });

    expect(xml.match(/<lastmod>/g)).toHaveLength(3);
    expect(lastmodDe(xml, 'https://exemplo.test/educacao')).toBeUndefined();
  });

  it('sem coleta publicada, nenhum lastmod', () => {
    expect(montarSitemap({ siteUrl: SITE, apoioAtivo: false, atualizadoEm: {} })).not.toContain('<lastmod>');
  });

  it('"e comercial" no endereço sai escapado', () => {
    const xml = montarSitemap({ siteUrl: 'https://exemplo.test/a&b', apoioAtivo: false, atualizadoEm: {} });

    expect(xml).toContain('<loc>https://exemplo.test/a&amp;b/financas</loc>');
    expect(xml).not.toMatch(/&(?!amp;)/);
  });
});
