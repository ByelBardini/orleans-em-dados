import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.js';
import { distFalso } from './support/dist-falso.js';

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
