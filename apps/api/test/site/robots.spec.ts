import { describe, expect, it } from 'vitest';
import { montarRobots } from '../../src/site/robots.js';

describe('montarRobots', () => {
  // A busca de empenhos traz nome de credor que pode ser pessoa física.
  it('fecha só a busca de empenhos', () => {
    const robots = montarRobots({ siteUrl: 'https://exemplo.test' });

    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Disallow: \/api\/despesas\/empenhos$/m);
  });

  // Bloquear a API inteira impedia o Google de buscar os números ao renderizar as páginas.
  it('não fecha a API inteira', () => {
    const robots = montarRobots({ siteUrl: 'https://exemplo.test' });

    expect(robots.match(/^Disallow:.*$/gm)).toEqual(['Disallow: /api/despesas/empenhos']);
  });

  it('com SITE_URL, aponta o sitemap', () => {
    expect(montarRobots({ siteUrl: 'https://exemplo.test' })).toMatch(
      /^Sitemap: https:\/\/exemplo\.test\/sitemap\.xml$/m,
    );
  });

  it('sem SITE_URL, não aponta sitemap nenhum', () => {
    expect(montarRobots({})).not.toContain('Sitemap:');
  });
});
