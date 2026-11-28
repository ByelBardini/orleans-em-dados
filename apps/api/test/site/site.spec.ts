import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { criarApp } from '../../src/app.js';
import { normalizarSiteUrl } from '../../src/site/site.js';
import { lerConfigDoApoio } from '../../src/modules/apoio/config.js';
import { distFalso } from '../support/dist-falso.js';

const CONFIG_DO_APOIO = lerConfigDoApoio({
  PIX_CHAVE: 'contato@exemplo.test',
  PIX_NOME: 'Fulano',
  PIX_CIDADE: 'Orleans',
});

// Os exercícios publicados, sem banco: guarda quantas vezes foi lido e pode estar fora do ar.
class ExerciciosFake {
  leituras = 0;
  constructor(
    private readonly anos: number[],
    private readonly erro: Error | null = null,
    private readonly atualizadoEm: Record<string, string> = {},
  ) {}
  ler = async () => {
    this.leituras += 1;
    if (this.erro) throw this.erro;
    return { anos: this.anos, atualizadoEm: this.atualizadoEm };
  };
}

const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]!));

const abertos: FastifyInstance[] = [];
// Sem banco: quem não passa os exercícios recebe uma lista vazia.
const app = (opcoes: Parameters<typeof criarApp>[0] = {}, doApp: Parameters<typeof criarApp>[1] = {}) => {
  const criado = criarApp(opcoes, { lerExercicios: new ExerciciosFake([]).ler, ...doApp });
  abertos.push(criado);
  return criado;
};
afterEach(async () => {
  while (abertos.length) await abertos.pop()?.close();
});

describe('registrarSite: o painel servido pela API', () => {
  it('a raiz entrega o index.html com o head da capa, sem cache e indexável', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(resposta.body).toContain('<title>Orleans em Dados · Dados públicos de Orleans/SC</title>');
    expect(resposta.body).toContain('<div id="root"></div>');
    expect(resposta.headers['cache-control']).toBe('no-cache');
    expect(resposta.headers['x-robots-tag']).toBeUndefined();
  });

  it('cada página recebe o próprio head no lugar do bloco do index', async () => {
    const site = app({}, { site: distFalso(), siteUrl: 'https://exemplo.test' });

    const resposta = await site.inject({ method: 'GET', url: '/financas/receitas' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toContain('<title>Receitas do município de Orleans/SC · Orleans em Dados</title>');
    expect(resposta.body).toContain('<link rel="canonical" href="https://exemplo.test/financas/receitas" />');
    expect(resposta.body).not.toContain('<title>Orleans em Dados</title>');
    expect(resposta.body).not.toContain('head:inicio');
    expect(resposta.headers['cache-control']).toBe('no-cache');
  });

  it('a query não muda a página nem o canonical', async () => {
    const site = app({}, { site: distFalso(), siteUrl: 'https://exemplo.test' });

    const resposta = await site.inject({ method: 'GET', url: '/educacao/dinheiro?utm_source=whatsapp' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toContain('<link rel="canonical" href="https://exemplo.test/educacao/dinheiro" />');
  });

  it('barra no fim redireciona de vez para o caminho sem ela, com a query', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/financas/receitas/?a=1' });

    expect(resposta.statusCode).toBe(301);
    expect(resposta.headers.location).toBe('/financas/receitas?a=1');
  });

  it('caminho que não é página responde 404 com o index, o head de não encontrada e noindex', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/financas/nao-existe' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(resposta.body).toContain('<title>Página não encontrada · Orleans em Dados</title>');
    expect(resposta.body).toContain('<meta name="robots" content="noindex" />');
    expect(resposta.body).toContain('<div id="root"></div>');
  });

  it('a página Apoiar, sem o Pix configurado, é 404', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/apoiar' });

    expect(resposta.statusCode).toBe(404);
  });

  it('a página Apoiar, com o Pix configurado, abre', async () => {
    const resposta = await app(
      {},
      { site: distFalso(), apoio: CONFIG_DO_APOIO, codificarQr: async () => '<svg/>' },
    ).inject({ method: 'GET', url: '/apoiar' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toContain('<title>Apoie o projeto · Orleans em Dados</title>');
  });

  it('o index.html pelo nome do arquivo não sai sem o head da página', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/index.html' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.body).not.toContain('head:inicio');
  });

  it('o asset com hash vai com cache longo', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/assets/index-abc123.js' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('método que não é GET num caminho do site é 404 em JSON', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'POST', url: '/financas' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'Rota não encontrada' });
  });

  it('sem a pasta do site (desenvolvimento, com o Vite), só a API responde', async () => {
    const resposta = await app().inject({ method: 'GET', url: '/' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'Rota não encontrada' });
  });
});

describe('registrarSite: o contador de acessos', () => {
  const TOKEN = '0123456789abcdef0123456789abcdef';
  // A tag do Cloudflare Web Analytics, como `scriptDoAnalitico` a escreve.
  const TAG =
    '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" ' +
    'data-cf-beacon="{&quot;token&quot;:&quot;0123456789abcdef0123456789abcdef&quot;}"></script>';
  const vezes = (texto: string, trecho: string) => texto.split(trecho).length - 1;

  it('com o token, a página do painel sai com uma tag do contador', async () => {
    const resposta = await app({}, { site: distFalso(), analitico: TOKEN }).inject({
      method: 'GET',
      url: '/financas/receitas',
    });

    expect(resposta.statusCode).toBe(200);
    expect(vezes(resposta.body, TAG)).toBe(1);
  });

  it('com o token, o 404 do site também leva o contador', async () => {
    const resposta = await app({}, { site: distFalso(), analitico: TOKEN }).inject({
      method: 'GET',
      url: '/nao-existe',
    });

    expect(resposta.statusCode).toBe(404);
    expect(vezes(resposta.body, TAG)).toBe(1);
  });

  it.each(['/robots.txt', '/llms.txt', '/api/nao-existe'])('com o token, %s não leva o contador', async (url) => {
    const resposta = await app({}, { site: distFalso(), analitico: TOKEN }).inject({ method: 'GET', url });

    expect(resposta.body).not.toContain('cloudflareinsights');
  });

  it('sem o token, a capa sai sem o contador', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).not.toContain('cloudflareinsights');
  });
});

describe('registrarSite: o JSON-LD no head', () => {
  const SITE = 'https://exemplo.test';

  it('Receitas leva o Dataset com o período dos exercícios publicados', async () => {
    const exercicios = new ExerciciosFake([2025, 2024]);
    const site = app({}, { site: distFalso(), siteUrl: SITE, lerExercicios: exercicios.ler });

    const resposta = await site.inject({ method: 'GET', url: '/financas/receitas' });

    const dataset = jsonLd(resposta.body).find((b) => b['@type'] === 'Dataset');
    expect(dataset?.temporalCoverage).toBe('2024/2025');
  });

  it('com o banco fora do ar, a página abre e o Dataset sai sem período', async () => {
    const exercicios = new ExerciciosFake([], new Error('connect ECONNREFUSED'));
    const site = app({}, { site: distFalso(), siteUrl: SITE, lerExercicios: exercicios.ler });

    const resposta = await site.inject({ method: 'GET', url: '/financas/receitas' });

    expect(resposta.statusCode).toBe(200);
    const dataset = jsonLd(resposta.body).find((b) => b['@type'] === 'Dataset');
    expect(dataset?.license).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(dataset).not.toHaveProperty('temporalCoverage');
  });

  it('os exercícios são lidos uma vez a cada cinco minutos, e não a cada acesso', async () => {
    const exercicios = new ExerciciosFake([2025]);
    let agora = 0;
    const site = app({}, { site: distFalso(), siteUrl: SITE, lerExercicios: exercicios.ler, relogio: () => agora });

    await site.inject({ method: 'GET', url: '/financas/receitas' });
    agora = 4 * 60_000;
    await site.inject({ method: 'GET', url: '/financas/despesas' });
    const antesDeVencer = exercicios.leituras;
    agora = 5 * 60_000 + 1;
    await site.inject({ method: 'GET', url: '/financas/receitas' });

    expect([antesDeVencer, exercicios.leituras]).toEqual([1, 2]);
  });

  it('sem SITE_URL, nada de JSON-LD, porque ele pede URL absoluta', async () => {
    const site = app({}, { site: distFalso(), lerExercicios: new ExerciciosFake([2025]).ler });

    const resposta = await site.inject({ method: 'GET', url: '/financas/receitas' });

    expect(jsonLd(resposta.body)).toEqual([]);
  });

  it('a página não encontrada não leva JSON-LD nem consulta o banco', async () => {
    const exercicios = new ExerciciosFake([2025]);
    const site = app({}, { site: distFalso(), siteUrl: SITE, lerExercicios: exercicios.ler });

    const resposta = await site.inject({ method: 'GET', url: '/nada' });

    expect(jsonLd(resposta.body)).toEqual([]);
    expect(exercicios.leituras).toBe(0);
  });
});

describe('registrarSite: robots.txt, sitemap.xml e llms.txt', () => {
  const SITE = 'https://exemplo.test';

  it('o robots.txt é gerado, fecha só a busca de empenhos e aponta o sitemap', async () => {
    const resposta = await app({}, { site: distFalso(), siteUrl: SITE }).inject({ method: 'GET', url: '/robots.txt' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(resposta.body).toContain('Disallow: /api/despesas/empenhos');
    expect(resposta.body).not.toMatch(/^Disallow: \/api\/$/m);
    expect(resposta.body).toContain('Sitemap: https://exemplo.test/sitemap.xml');
  });

  // Um build antigo ainda pode trazer o robots.txt estático que fechava a API inteira.
  it('um robots.txt antigo no build não ganha do gerado', async () => {
    const pasta = distFalso();
    writeFileSync(path.join(pasta, 'robots.txt'), 'User-agent: *\nDisallow: /api/\n');

    const resposta = await app({}, { site: pasta, siteUrl: SITE }).inject({ method: 'GET', url: '/robots.txt' });

    expect(resposta.body).toContain('Disallow: /api/despesas/empenhos');
    expect(resposta.body).not.toMatch(/^Disallow: \/api\/$/m);
  });

  it('o sitemap.xml sai em XML, com a data da última coleta nas páginas de finanças', async () => {
    const exercicios = new ExerciciosFake([2025], null, { 2025: '2026-03-10T06:00:00.000Z' });
    const site = app({}, { site: distFalso(), siteUrl: SITE, lerExercicios: exercicios.ler });

    const resposta = await site.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toBe('application/xml; charset=utf-8');
    expect(resposta.body).toContain('<loc>https://exemplo.test/financas/receitas</loc>');
    expect(resposta.body).toContain('<lastmod>2026-03-10</lastmod>');
  });

  it('sem SITE_URL, não há sitemap.xml', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/sitemap.xml' });

    expect(resposta.statusCode).toBe(404);
  });

  it('o llms.txt sai em texto, com as páginas do painel', async () => {
    const resposta = await app({}, { site: distFalso(), siteUrl: SITE }).inject({ method: 'GET', url: '/llms.txt' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(resposta.body).toContain('- [Receitas](https://exemplo.test/financas/receitas): ');
  });
});

describe('normalizarSiteUrl', () => {
  it.each([
    ['https://orleansemdados.com.br/', 'https://orleansemdados.com.br'],
    ['  https://orleansemdados.com.br  ', 'https://orleansemdados.com.br'],
    ['https://exemplo.test/painel/', 'https://exemplo.test/painel'],
  ])('%j vira %j, sem barra no fim', (valor, esperado) => {
    expect(normalizarSiteUrl(valor)).toBe(esperado);
  });

  it.each([undefined, '', '   '])('vazia (%j) é ausente', (valor) => {
    expect(normalizarSiteUrl(valor)).toBeUndefined();
  });

  it.each(['orleansemdados.com.br', 'ftp://exemplo.test'])('%j é recusada, citando o valor', (valor) => {
    expect(() => normalizarSiteUrl(valor)).toThrow(`SITE_URL inválida: "${valor}"`);
  });
});
