// Postgres descartável dos testes de integração: guarda contra o banco de
// desenvolvimento, recriação do esquema e bancos temporários para os specs de migração.
import pg from 'pg';
import { migrar } from '../../src/migrar';
import { URL_TESTE } from './url';

// A porta 5433 é o banco do `pnpm db:subir`, com as coletas reais.
export function garantirBancoDescartavel(url: string | undefined): asserts url is string {
  if (!url) throw new Error('DATABASE_URL não definida: o teste de integração precisa do Postgres descartável');
  if (new URL(url).port === '5433') {
    throw new Error(`DATABASE_URL aponta para o banco de desenvolvimento (${url}); use o descartável (pnpm db:teste)`);
  }
}

export async function conectar(url: string, tentativas = 30): Promise<pg.Client> {
  for (let i = 1; ; i++) {
    const cliente = new pg.Client({ connectionString: url });
    try {
      await cliente.connect();
      return cliente;
    } catch (err) {
      await cliente.end().catch(() => {});
      if (i >= tentativas) {
        throw new Error(`Postgres descartável indisponível em ${url} (pnpm db:teste)`, { cause: err });
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function recriarBanco(url: string = URL_TESTE): Promise<void> {
  garantirBancoDescartavel(url);
  const cliente = await conectar(url);
  try {
    await cliente.query('DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  } finally {
    await cliente.end();
  }
  await migrar(url);
}

// Banco vazio à parte, para spec que precisa comparar ou montar um esquema do zero.
export async function criarBancoTemporario(nome: string): Promise<string> {
  garantirBancoDescartavel(URL_TESTE);
  const cliente = await conectar(URL_TESTE);
  try {
    await cliente.query(`DROP DATABASE IF EXISTS ${nome}`);
    await cliente.query(`CREATE DATABASE ${nome}`);
  } finally {
    await cliente.end();
  }
  const url = new URL(URL_TESTE);
  url.pathname = `/${nome}`;
  return url.toString();
}

// globalSetup do projeto de integração: uma recriação por rodada.
export default async function setup(): Promise<void> {
  await recriarBanco();
}
