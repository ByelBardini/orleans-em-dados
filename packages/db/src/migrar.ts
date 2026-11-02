// Aplica as migrações de drizzle/ (geradas por `pnpm --filter @orleans-em-dados/db gerar`).
// Banco criado pelas migrações SQL originais (tabela `migracoes`) recebe a baseline como
// já aplicada: nenhuma DDL roda e nenhum dado muda.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import pg from 'pg';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '../drizzle');
const URL_PADRAO = 'postgres://orleans:orleans@localhost:5433/orleans_em_dados';
const LEGADAS = ['001_inicial.sql', '002_despesas_e_tcesc.sql'];

async function marcarBaselineDeBancoLegado(pool: pg.Pool): Promise<void> {
  const { rows: tabela } = await pool.query(`SELECT to_regclass('public.migracoes') AS existe`);
  if (!tabela[0].existe) return;

  const { rows } = await pool.query('SELECT nome FROM migracoes');
  const aplicadas = new Set(rows.map((r) => r.nome));
  const faltando = LEGADAS.filter((nome) => !aplicadas.has(nome));
  if (faltando.length) {
    throw new Error(
      `Banco antigo sem as migrações ${faltando.join(', ')}; a baseline exige todas as originais aplicadas`,
    );
  }

  await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  const { rows: registradas } = await pool.query('SELECT 1 FROM drizzle.__drizzle_migrations LIMIT 1');
  if (registradas.length) return;

  const baseline = readMigrationFiles({ migrationsFolder: PASTA })[0];
  if (!baseline) throw new Error(`Sem migração baseline em ${PASTA}`);
  await pool.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
    baseline.hash,
    baseline.folderMillis,
  ]);
}

export async function migrar(url: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await marcarBaselineDeBancoLegado(pool);
    await migrate(drizzle(pool), { migrationsFolder: PASTA });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await migrar(process.env.DATABASE_URL ?? URL_PADRAO);
  console.log('banco atualizado');
}
