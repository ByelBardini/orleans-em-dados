// Aplica, em ordem, os arquivos de migrations/ ainda não registrados.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, transacao } from './index.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

await pool.query(`CREATE TABLE IF NOT EXISTS migracoes (
  nome TEXT PRIMARY KEY,
  aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
)`);

const aplicadas = new Set((await pool.query('SELECT nome FROM migracoes')).rows.map((r) => r.nome));
const pendentes = (await readdir(DIR)).filter((f) => f.endsWith('.sql') && !aplicadas.has(f)).sort();

for (const nome of pendentes) {
  const sql = await readFile(path.join(DIR, nome), 'utf8');
  await transacao(async (c) => {
    await c.query(sql);
    await c.query('INSERT INTO migracoes (nome) VALUES ($1)', [nome]);
  });
  console.log(`aplicada: ${nome}`);
}
if (!pendentes.length) console.log('banco já está atualizado');
await pool.end();
