import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { criarApp } from '../../src/app.js';
import { normalizarSiteUrl } from '../../src/site/site.js';
import { distFalso } from '../support/dist-falso.js';

const abertos: FastifyInstance[] = [];
const app = (...args: Parameters<typeof criarApp>) => {
  const criado = criarApp(...args);
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
    const resposta = await app({}, { site: distFalso(), apoioAtivo: true }).inject({ method: 'GET', url: '/apoiar' });

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

  it('o robots.txt do build é servido', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/robots.txt' });

    expect(resposta.body).toContain('Disallow: /api/');
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
