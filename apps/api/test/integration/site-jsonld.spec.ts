// O período do Dataset sai dos exercícios publicados no banco de verdade, não de um valor fixo.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { gravarLote, limparColetas } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { receitas, snapshot } from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';
import { distFalso } from '../support/dist-falso';

const app = criarApp({}, { site: distFalso(), siteUrl: 'https://exemplo.test' });

beforeAll(async () => {
  await limparColetas();
  await gravarLote('betha', 'receitas', snapshot(57153, receitas().registros, { ano: 2024 }));
  await gravarLote('betha', 'receitas', snapshot(57153, receitas().registros, { ano: 2025 }));
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /financas/receitas: o JSON-LD', () => {
  it('com receitas publicadas de 2024 e 2025, o Dataset cobre 2024/2025 e distribui o CSV de 2025', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/financas/receitas' });

    const blocos = [...resposta.body.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) =>
      JSON.parse(m[1]!),
    );
    const dataset = blocos.find((b) => b['@type'] === 'Dataset');
    expect(resposta.statusCode).toBe(200);
    expect(dataset.temporalCoverage).toBe('2024/2025');
    expect(dataset.distribution[0].contentUrl).toBe('https://exemplo.test/api/receitas.csv?ano=2025');
  });
});
