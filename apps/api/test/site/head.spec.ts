import { paginaPeloId } from '@orleans-em-dados/contracts';
import { describe, expect, it } from 'vitest';
import { escaparHtml, montarHead } from '../../src/site/head.js';

const RECEITAS = paginaPeloId('receitas');
const SITE = 'https://exemplo.test';

// O valor de um atributo no head, achado pelo nome ou pela propriedade.
const atributo = (head: string, chave: string, valor = 'content') =>
  head.match(new RegExp(`<[^>]*(?:name|property|rel)="${chave}"[^>]*${valor}="([^"]*)"`))?.[1];

describe('montarHead', () => {
  it('o head de Receitas traz título, descrição, canonical e a prévia das redes, com URL absoluta', () => {
    const head = montarHead(RECEITAS, { siteUrl: SITE });

    expect(head).toContain('<title>Receitas do município de Orleans/SC · Orleans em Dados</title>');
    expect(atributo(head, 'description')).toBe(RECEITAS.descricao);
    expect(atributo(head, 'canonical', 'href')).toBe('https://exemplo.test/financas/receitas');
    expect(atributo(head, 'og:title')).toBe('Receitas do município de Orleans/SC · Orleans em Dados');
    expect(atributo(head, 'og:description')).toBe(RECEITAS.descricao);
    expect(atributo(head, 'og:url')).toBe('https://exemplo.test/financas/receitas');
    expect(atributo(head, 'og:image')).toBe('https://exemplo.test/og.png');
    expect(atributo(head, 'og:locale')).toBe('pt_BR');
    expect(atributo(head, 'og:type')).toBe('website');
    expect(atributo(head, 'og:site_name')).toBe('Orleans em Dados');
    expect(atributo(head, 'twitter:card')).toBe('summary_large_image');
    expect(atributo(head, 'robots')).toBeUndefined();
  });

  it('a capa tem canonical na raiz, com a barra', () => {
    const head = montarHead(paginaPeloId('visao-geral'), { siteUrl: SITE });

    expect(atributo(head, 'canonical', 'href')).toBe('https://exemplo.test/');
  });

  it('título e descrição com aspas, sinal de menor e "e comercial" saem escapados', () => {
    const falsa = { caminho: '/x', titulo: 'A "B" <C> & D', descricao: "Isto <script>alert('x')</script> & aquilo" };

    const head = montarHead(falsa, { siteUrl: SITE });

    expect(head).toContain('<title>A &quot;B&quot; &lt;C&gt; &amp; D</title>');
    expect(atributo(head, 'description')).toBe('Isto &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; aquilo');
    expect(head).not.toContain('<script>alert');
  });

  // Sem o endereço público, URL relativa no canonical ou no og:image confundiria o buscador.
  it('sem SITE_URL, sai sem canonical, sem og:url e sem og:image, e o resto continua', () => {
    const head = montarHead(RECEITAS, {});

    expect(atributo(head, 'canonical', 'href')).toBeUndefined();
    expect(atributo(head, 'og:url')).toBeUndefined();
    expect(atributo(head, 'og:image')).toBeUndefined();
    expect(head).toContain('<title>Receitas do município de Orleans/SC · Orleans em Dados</title>');
    expect(atributo(head, 'og:description')).toBe(RECEITAS.descricao);
  });

  it('com a verificação do Google, a meta dela entra', () => {
    const head = montarHead(RECEITAS, { siteUrl: SITE, verificacaoGoogle: 'abc-123_XYZ' });

    expect(atributo(head, 'google-site-verification')).toBe('abc-123_XYZ');
  });

  it('sem a verificação do Google, nada dela', () => {
    expect(montarHead(RECEITAS, { siteUrl: SITE })).not.toContain('google-site-verification');
  });

  it('página não encontrada leva noindex, sem canonical nem descrição', () => {
    const head = montarHead(null, { siteUrl: SITE });

    expect(head).toContain('<title>Página não encontrada · Orleans em Dados</title>');
    expect(atributo(head, 'robots')).toBe('noindex');
    expect(atributo(head, 'canonical', 'href')).toBeUndefined();
    expect(atributo(head, 'description')).toBeUndefined();
  });
});

describe('escaparHtml', () => {
  it('troca os cinco caracteres que abrem tag ou fecham atributo', () => {
    expect(escaparHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});
