// A saúde contra o Postgres de verdade: é o que o healthcheck do Coolify chama.
import { afterAll, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { criarApp } from '../../src/app';

const app = criarApp();

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/saude', () => {
  it('com o banco de pé, responde 200 e ok', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/saude' });

    expect([resposta.statusCode, resposta.json()]).toEqual([200, { ok: true }]);
  });
});
