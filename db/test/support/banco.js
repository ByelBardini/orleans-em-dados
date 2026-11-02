// Postgres descartável dos testes de integração: URL fixa, guarda contra o banco
// de desenvolvimento e recriação do esquema pelas migrações do repositório.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const URL_TESTE = process.env.DATABASE_URL_TESTE ?? 'postgres://orleans:orleans@localhost:5434/orleans_teste';

const MIGRACOES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

// A porta 5433 é o banco do `pnpm db:subir`, com as coletas reais.
export function garantirBancoDescartavel(url) {
  if (!url) throw new Error('DATABASE_URL não definida: o teste de integração precisa do Postgres descartável');
  if (new URL(url).port === '5433') {
    throw new Error(`DATABASE_URL aponta para o banco de desenvolvimento (${url}); use o descartável (pnpm db:teste)`);
  }
}

async function conectar(url, tentativas = 30) {
  for (let i = 1; ; i++) {
    const cliente = new pg.Client({ connectionString: url });
    try {
      await cliente.connect();
      return cliente;
    } catch (err) {
      await cliente.end().catch(() => {});
      if (i >= tentativas)
        throw new Error(`Postgres descartável indisponível em ${url} (pnpm db:teste)`, { cause: err });
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function recriarBanco(url = URL_TESTE) {
  garantirBancoDescartavel(url);
  const cliente = await conectar(url);
  try {
    await cliente.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    const arquivos = (await readdir(MIGRACOES)).filter((f) => f.endsWith('.sql')).sort();
    for (const nome of arquivos) await cliente.query(await readFile(path.join(MIGRACOES, nome), 'utf8'));
  } finally {
    await cliente.end();
  }
}

// globalSetup do projeto de integração: uma recriação por rodada.
export default async function setup() {
  await recriarBanco();
}
