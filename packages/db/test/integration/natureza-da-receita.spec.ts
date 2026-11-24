// A natureza da receita no formato de 14 dígitos, gerada pelo Postgres a partir da rubrica
// como a Betha publica: até 2019 ela traz 15 dígitos com a classe na frente (4 receita, 9 dedução).
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrar } from '../../src/migrar';
import { conectar, criarBancoTemporario } from '../support/banco';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE = path.resolve(AQUI, '../../drizzle');

async function novaColeta(c: pg.Client): Promise<number> {
  const { rows } = await c.query(
    `INSERT INTO coletas (consulta_id, ano, filtro, iniciado_em, finalizado_em, origem, status,
                          total_hits, capturados, ids_unicos, hash_payload)
     VALUES (57153, 2019, '{}', now(), now(), 'exemplo', 'exemplo', 0, 0, 0, 'x') RETURNING id`,
  );
  return Number(rows[0].id);
}

async function gravarRubrica(c: pg.Client, coleta: number, rubrica: string): Promise<void> {
  await c.query(
    `INSERT INTO receitas (coleta_id, id_externo, ano, entidade_codigo, id_rubrica_betha, mes, rubrica, descricao)
     VALUES ($1, $2, 2019, '728', $2, 1, $2, 'Receita fictícia')`,
    [coleta, rubrica],
  );
}

async function lerNatureza(c: pg.Client, rubrica: string) {
  const { rows } = await c.query('SELECT natureza, deducao FROM receitas WHERE rubrica = $1', [rubrica]);
  return rows[0];
}

// Pasta de migrações só até a 0006: o banco como estava antes das colunas geradas.
function migracoesAte(tag: string): string {
  const pasta = mkdtempSync(path.join(tmpdir(), 'orleans-drizzle-'));
  cpSync(DRIZZLE, pasta, { recursive: true });
  const arquivo = path.join(pasta, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(arquivo, 'utf8'));
  const fim = journal.entries.findIndex((e: { tag: string }) => e.tag === tag);
  journal.entries = journal.entries.slice(0, fim + 1);
  writeFileSync(arquivo, JSON.stringify(journal));
  return pasta;
}

describe('natureza e dedução geradas da rubrica', () => {
  let cliente: pg.Client;
  let coleta: number;

  beforeAll(async () => {
    const url = await criarBancoTemporario('orleans_natureza');
    await migrar(url);
    cliente = await conectar(url);
    coleta = await novaColeta(cliente);
  });

  afterAll(() => cliente.end());

  it('rubrica antiga de receita (classe 4, 15 dígitos) perde a classe e não é dedução', async () => {
    await gravarRubrica(cliente, coleta, '417280111010000');

    expect(await lerNatureza(cliente, '417280111010000')).toEqual({ natureza: '17280111010000', deducao: false });
  });

  it('rubrica antiga de dedução (classe 9, 15 dígitos) perde a classe e é dedução', async () => {
    await gravarRubrica(cliente, coleta, '917280111000000');

    expect(await lerNatureza(cliente, '917280111000000')).toEqual({ natureza: '17280111000000', deducao: true });
  });

  it('rubrica nova de 14 dígitos sai igual na natureza e não é dedução', async () => {
    await gravarRubrica(cliente, coleta, '17215001000000');

    expect(await lerNatureza(cliente, '17215001000000')).toEqual({ natureza: '17215001000000', deducao: false });
  });

  it.each(['92100000000000', '41000000000000'])(
    'rubrica de 14 dígitos que começa com %s não é tratada como classe',
    async (rubrica) => {
      await gravarRubrica(cliente, coleta, rubrica);

      expect(await lerNatureza(cliente, rubrica)).toEqual({ natureza: rubrica, deducao: false });
    },
  );

  it('a coluna gerada recusa escrita direta', async () => {
    await expect(
      cliente.query(
        `INSERT INTO receitas (coleta_id, id_externo, ano, entidade_codigo, id_rubrica_betha, rubrica, descricao, natureza)
         VALUES ($1, 'direta', 2019, '728', 'direta', '17215001000000', 'x', '17215001000000')`,
        [coleta],
      ),
    ).rejects.toThrow(/non-DEFAULT value into column "natureza"/);
  });
});

describe('migração 0007 sobre linha já gravada', () => {
  it('linha gravada antes da migração ganha natureza e dedução depois dela', async () => {
    const url = await criarBancoTemporario('orleans_natureza_antes');
    const pool = new pg.Pool({ connectionString: url, max: 1 });
    try {
      await migrate(drizzle(pool), { migrationsFolder: migracoesAte('0006_ipca') });
    } finally {
      await pool.end();
    }
    const cliente = await conectar(url);
    try {
      const coleta = await novaColeta(cliente);
      await gravarRubrica(cliente, coleta, '917280111000000');

      await migrar(url);

      expect(await lerNatureza(cliente, '917280111000000')).toEqual({ natureza: '17280111000000', deducao: true });
    } finally {
      await cliente.end();
    }
  });
});
