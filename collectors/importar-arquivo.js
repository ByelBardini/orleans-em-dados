// Importa no banco snapshots JSON já existentes (coletas antigas em data/ ou os exemplos fictícios).
//
// Uso: npm run importar -- data/betha/receitas-2025.json [outros.json...]
//      npm run importar -- --exemplos

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { pool } from '@orleans-em-dados/db';
import { gravarColeta } from './gravar.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values, positionals } = parseArgs({
  options: { exemplos: { type: 'boolean', default: false } },
  allowPositionals: true,
});

let arquivos = positionals.map((p) => path.resolve(process.env.INIT_CWD ?? process.cwd(), p));
if (values.exemplos) {
  const dir = path.join(RAIZ, 'examples', 'betha');
  arquivos = (await readdir(dir)).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));
}
if (!arquivos.length) {
  console.error('Informe os arquivos .json ou use --exemplos');
  process.exit(1);
}

let ok = true;
for (const arquivo of arquivos) {
  try {
    const snapshot = JSON.parse(await readFile(arquivo, 'utf8'));
    const origem = snapshot.meta.status === 'exemplo' ? 'exemplo' : 'arquivo';
    const { coletaId, publicada } = await gravarColeta(snapshot, origem);
    console.log(
      `${path.relative(RAIZ, arquivo)} → coleta ${coletaId} (${snapshot.registros.length} registros, ${snapshot.meta.status})` +
        (publicada ? ', publicada' : ', não publicada'),
    );
  } catch (err) {
    ok = false;
    console.error(`${arquivo}: ${err.message}`);
  }
}
await pool.end();
process.exit(ok ? 0 : 1);
