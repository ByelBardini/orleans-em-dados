// O que o histórico considera feito, lido do banco: publicado, e gravado (inclusive rejeitado).
// Coleta de exemplo não conta: dado fictício não pode impedir a carga do real.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { lerEstadoDoHistorico } from '../../src/historico';

async function coleta(consultaId: number, ano: number, origem: string, status: string, publicar: boolean) {
  const {
    rows: [linha],
  } = await pool.query<{ id: number }>(
    `INSERT INTO coletas (consulta_id, ano, filtro, iniciado_em, finalizado_em, origem, status,
                          total_hits, capturados, ids_unicos, hash_payload)
     VALUES ($1, $2, '{}', now(), now(), $3, $4, 0, 0, 0, md5(random()::text)) RETURNING id`,
    [consultaId, ano, origem, status],
  );
  if (publicar) {
    await pool.query('INSERT INTO publicacoes (consulta_id, ano, coleta_id) VALUES ($1, $2, $3)', [
      consultaId,
      ano,
      linha?.id,
    ]);
  }
}

beforeEach(async () => {
  await pool.query('TRUNCATE coletas RESTART IDENTITY CASCADE');
});

afterAll(() => pool.end());

describe('lerEstadoDoHistorico', () => {
  it('publicado conta como feito nos dois modos; rejeitado só como gravado; exemplo não conta', async () => {
    await coleta(57153, 2020, 'api', 'totalizador_conciliado', true);
    await coleta(57140, 2019, 'api', 'rejeitado', false);
    await coleta(57170, 2018, 'exemplo', 'exemplo', true);

    const { publicados, gravados } = await lerEstadoDoHistorico();

    expect([...publicados].sort()).toEqual(['57153:2020']);
    expect([...gravados].sort()).toEqual(['57140:2019', '57153:2020']);
  });

  it('banco sem coleta não tem nada feito', async () => {
    const { publicados, gravados } = await lerEstadoDoHistorico();

    expect([publicados.size, gravados.size]).toEqual([0, 0]);
  });
});
