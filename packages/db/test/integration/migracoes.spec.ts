import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { pool, transacao } from '../../src/index';
import { migrar } from '../../src/migrar';
import * as schema from '../../src/schema';
import { conectar, criarBancoTemporario } from '../support/banco';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const LEGADAS = path.resolve(AQUI, '../../migrations');
const MIGRACOES = readMigrationFiles({ migrationsFolder: path.resolve(AQUI, '../../drizzle') }).length;
// Tabelas que nasceram depois das migrações SQL originais.
const NOVAS = "('execucoes', 'ibge_valores', 'siconfi_funcoes')";
const VIEWS_NOVAS = "('ibge_valores_publicados', 'siconfi_funcoes_publicadas')";

async function comCliente<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const cliente = await conectar(url);
  try {
    return await fn(cliente);
  } finally {
    await cliente.end();
  }
}

// O banco como as migrações SQL originais o deixavam, com o registro em `migracoes`.
async function montarLegado(url: string, arquivos = readdirSync(LEGADAS).sort()): Promise<void> {
  await comCliente(url, async (c) => {
    await c.query(`CREATE TABLE migracoes (
      nome TEXT PRIMARY KEY,
      aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    for (const nome of arquivos) {
      await c.query(readFileSync(path.join(LEGADAS, nome), 'utf8'));
      await c.query('INSERT INTO migracoes (nome) VALUES ($1)', [nome]);
    }
  });
}

// O que o catálogo diz do esquema público: tabelas, colunas, restrições e índices.
async function catalogo(url: string, opcoes: { views?: boolean; soOriginais?: boolean } = {}) {
  const fora = opcoes.soOriginais ? NOVAS : "('')";
  const viewsFora = opcoes.soOriginais ? VIEWS_NOVAS : "('')";
  return comCliente(url, async (c) => {
    const colunas = await c.query(`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> 'migracoes' AND table_name NOT IN ${fora}
        AND table_name IN (SELECT table_name FROM information_schema.tables
                           WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
      ORDER BY table_name, column_name`);
    const restricoes = await c.query(`
      SELECT conrelid::regclass::text AS tabela, conname AS nome, pg_get_constraintdef(oid) AS definicao
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> 'migracoes'
        AND conrelid::regclass::text NOT IN ${fora} AND contype <> 'n'
      ORDER BY 1, 2`);
    const indices = await c.query(`
      SELECT tablename, indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename <> 'migracoes' AND tablename NOT IN ${fora} ORDER BY 1, 2`);
    const views = await c.query(`
      SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname NOT IN ${viewsFora} ORDER BY 1`);
    return {
      colunas: colunas.rows,
      restricoes: restricoes.rows,
      indices: indices.rows,
      ...(opcoes.views ? { views: views.rows.map((v) => v.viewname) } : {}),
    };
  });
}

const contagem = (url: string, tabela: string) =>
  comCliente(url, async (c) => (await c.query(`SELECT count(*)::int AS n FROM ${tabela}`)).rows[0].n as number);

afterAll(() => pool.end());

describe('migrar', () => {
  it('nas tabelas originais, banco vazio migrado fica igual ao criado pelos SQLs originais, com views', async () => {
    const novo = await criarBancoTemporario('orleans_mig_novo');
    const legado = await criarBancoTemporario('orleans_mig_legado');
    await montarLegado(legado);

    await migrar(novo);

    const opcoes = { views: true, soOriginais: true };
    expect(await catalogo(novo, opcoes)).toEqual(await catalogo(legado, opcoes));
  });

  it('banco vazio migrado traz o catálogo de fontes, consultas e entidades', async () => {
    const url = await criarBancoTemporario('orleans_mig_catalogo');

    await migrar(url);

    expect(await contagem(url, 'fontes')).toBe(4);
    expect(await contagem(url, 'consultas')).toBe(10);
    expect(await contagem(url, 'entidades')).toBe(4);
    expect(await contagem(url, 'unidades_tce')).toBe(5);
  });

  it('schema.ts descreve exatamente as tabelas do banco migrado', async () => {
    const migrado = await criarBancoTemporario('orleans_mig_migrado');
    const gerado = await criarBancoTemporario('orleans_mig_gerado');
    await migrar(migrado);

    const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
    await comCliente(gerado, async (c) => {
      for (const comando of ddl) await c.query(comando);
    });

    expect(await catalogo(gerado)).toEqual(await catalogo(migrado));
  });

  it('banco que já tem as migrações originais não refaz a baseline e não perde dado', async () => {
    const url = await criarBancoTemporario('orleans_mig_existente');
    await montarLegado(url);
    await comCliente(url, (c) => c.query(`INSERT INTO fontes (id, nome, url) VALUES ('nova', 'Fonte', 'https://x')`));
    const opcoes = { views: true, soOriginais: true };
    const antes = await catalogo(url, opcoes);

    await migrar(url);

    expect(await catalogo(url, opcoes)).toEqual(antes);
    expect(await contagem(url, `fontes WHERE id = 'nova'`)).toBe(1);
    expect(await contagem(url, 'drizzle.__drizzle_migrations')).toBe(MIGRACOES);
  });

  it('migrar duas vezes não faz nada na segunda', async () => {
    const url = await criarBancoTemporario('orleans_mig_duas');
    await migrar(url);
    await comCliente(url, (c) => c.query(`INSERT INTO fontes (id, nome, url) VALUES ('nova', 'Fonte', 'https://x')`));

    await migrar(url);

    expect(await contagem(url, `fontes WHERE id = 'nova'`)).toBe(1);
    expect(await contagem(url, 'drizzle.__drizzle_migrations')).toBe(MIGRACOES);
  });

  it('banco com só parte das migrações originais é recusado citando o que falta', async () => {
    const url = await criarBancoTemporario('orleans_mig_parcial');
    await montarLegado(url, ['001_inicial.sql']);

    await expect(migrar(url)).rejects.toThrow('002_despesas_e_tcesc.sql');
  });
});

describe('transacao', () => {
  it('desfaz tudo quando a função lança', async () => {
    await expect(
      transacao(async (c) => {
        await c.query(`INSERT INTO fontes (id, nome, url) VALUES ('fantasma', 'Fonte', 'https://x')`);
        throw new Error('falhou no meio');
      }),
    ).rejects.toThrow('falhou no meio');

    const { rows } = await pool.query(`SELECT id FROM fontes WHERE id = 'fantasma'`);
    expect(rows).toEqual([]);
  });

  it('confirma o que a função gravou e devolve o resultado dela', async () => {
    const resultado = await transacao(async (c) => {
      await c.query(`INSERT INTO fontes (id, nome, url) VALUES ('confirmada', 'Fonte', 'https://x')`);
      return 42;
    });

    expect(resultado).toBe(42);
    const { rows } = await pool.query(`DELETE FROM fontes WHERE id = 'confirmada' RETURNING id`);
    expect(rows).toEqual([{ id: 'confirmada' }]);
  });
});
