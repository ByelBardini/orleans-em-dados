import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const URL_PADRAO = 'postgres://orleans:orleans@localhost:5433/orleans_em_dados';

// NUMERIC é lido como number apenas para exibição/JSON: valores monetários de
// até 2^53 centavos são representados sem perda. Somas e gravação ficam no banco.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? URL_PADRAO, max: 5 });

export const db = drizzle(pool, { schema });

export type ClienteDeTransacao = pg.PoolClient;

export async function transacao<T>(fn: (cliente: ClienteDeTransacao) => Promise<T>): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

export * as tabelas from './schema';
