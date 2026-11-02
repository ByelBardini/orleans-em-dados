// Fora de banco.ts para o vitest.config.ts importar sem carregar o driver do Postgres.
export const URL_TESTE = process.env.DATABASE_URL_TESTE ?? 'postgres://orleans:orleans@localhost:5434/orleans_teste';
