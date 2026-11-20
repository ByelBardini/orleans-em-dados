import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.js';

// O build do web, em miniatura: o index e um asset com hash no nome.
function distFalso() {
  const pasta = mkdtempSync(path.join(tmpdir(), 'orleans-dist-'));
  mkdirSync(path.join(pasta, 'assets'));
  writeFileSync(path.join(pasta, 'index.html'), '<!doctype html><title>Orleans em Dados</title>');
  writeFileSync(path.join(pasta, 'assets', 'index-abc123.js'), 'console.log(1)');
  writeFileSync(path.join(pasta, 'robots.txt'), 'User-agent: *\nDisallow: /api/\n');
  return pasta;
}

class BancoFake {
  constructor(private readonly erro: Error | null = null) {}
  checar = async () => {
    if (this.erro) throw this.erro;
  };
}

const abertos: FastifyInstance[] = [];
const app = (...args: Parameters<typeof criarApp>) => {
  const criado = criarApp(...args);
  abertos.push(criado);
  return criado;
};
afterEach(async () => {
  while (abertos.length) await abertos.pop()?.close();
});

describe('criarApp: a API', () => {
  // A busca de empenhos traz nome de credor que pode ser pessoa física: buscador nenhum indexa a API.
  it('toda resposta da API pede para não ser indexada', async () => {
    const resposta = await app().inject({ method: 'GET', url: '/api/nao-existe' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('rota desconhecida da API continua 404 em JSON, mesmo com o site servido', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/api/nao-existe' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'Rota não encontrada' });
  });
});

describe('criarApp: o site', () => {
  it('a raiz entrega o index.html, sem cache e indexável', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toContain('<title>Orleans em Dados</title>');
    expect(resposta.headers['cache-control']).toBe('no-cache');
    expect(resposta.headers['x-robots-tag']).toBeUndefined();
  });

  it('o asset com hash vai com cache longo', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/assets/index-abc123.js' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('caminho que não é arquivo volta para o index.html, porque as abas são da própria página', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/qualquer/coisa' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toContain('<title>Orleans em Dados</title>');
    expect(resposta.headers['cache-control']).toBe('no-cache');
  });

  it('o robots.txt do build é servido', async () => {
    const resposta = await app({}, { site: distFalso() }).inject({ method: 'GET', url: '/robots.txt' });

    expect(resposta.body).toContain('Disallow: /api/');
  });

  it('sem a pasta do site (desenvolvimento, com o Vite), só a API responde', async () => {
    const resposta = await app().inject({ method: 'GET', url: '/' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'Rota não encontrada' });
  });
});

describe('criarApp: /api/saude', () => {
  it('com o banco respondendo, 200 e ok', async () => {
    const resposta = await app({}, { checarBanco: new BancoFake().checar }).inject({
      method: 'GET',
      url: '/api/saude',
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true });
  });

  it('com o banco fora, 503 e não ok, sem a mensagem do erro', async () => {
    const banco = new BancoFake(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

    const resposta = await app({}, { checarBanco: banco.checar }).inject({ method: 'GET', url: '/api/saude' });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({ ok: false });
  });
});
