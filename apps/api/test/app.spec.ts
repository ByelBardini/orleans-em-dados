import { afterAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.js';

// A busca de empenhos traz nome de credor que pode ser pessoa física: buscador nenhum indexa a API.
describe('criarApp', () => {
  const app = criarApp();
  afterAll(() => app.close());

  it('toda resposta pede para não ser indexada', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/nao-existe' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.headers['x-robots-tag']).toBe('noindex, nofollow');
  });
});
