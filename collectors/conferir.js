// Conferência Betha × TCE-SC sobre as coletas publicadas de um exercício.
// As consultas ficam em db/conferencias.js, compartilhadas com a API.
//
// Uso: npm run conferir -- --ano 2025 [--json]
//
// Com --json, grava o resultado em data/conferencias/<ano>.json.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { pool } from '@orleans-em-dados/db';
import { conferencia } from '@orleans-em-dados/db/conferencias';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.resolve(RAIZ, process.env.DATA_DIR ?? 'data', 'conferencias');

const { values } = parseArgs({
  options: { ano: { type: 'string', default: String(new Date().getFullYear() - 1) }, json: { type: 'boolean', default: false } },
});

const r = await conferencia(Number(values.ano));
await pool.end();

console.log(`\nConferência Betha × TCE-SC — ${r.ano}`);
console.table(r.coletas);
if (!r.disponivel) {
  console.error(`Faltam coletas publicadas: ${r.faltando.join(', ')}`);
  process.exit(1);
}
if (r.parcial) {
  console.log(`Exercício incompleto no TCE: receitas até o mês ${r.limites.mesReceita}, empenhos até ${r.limites.dataEmpenho}.`);
  console.log('As comparações de receita e de empenhos se limitam a esse período; a de despesa total não se aplica.');
}
console.log('Despesa (Betha 57170 × TCE por UG)');
console.table(r.despesaPorEntidade.map(({ sigla, bethaEmpenhado, tceEmpenhado, difEmpenhado, difLiquidado, difPago }) => ({ sigla, bethaEmpenhado, tceEmpenhado, difEmpenhado, difLiquidado, difPago })));
console.log('Receita arrecadada por entidade (Betha 57153 × TCE)');
console.table(r.receitaPorEntidade);
console.log('Receita por mês');
console.table(r.receitaPorMes);
console.log(`Receita por natureza (8 dígitos × entidade): ${r.resumo.naturezasIguais}/${r.resumo.naturezasComparadas} iguais; divergentes:`);
console.table(r.receitaPorNatureza.map(({ descricao, nota, ...x }) => ({ ...x, descricao: descricao?.slice(0, 40), nota: nota.slice(0, 60) })));
console.log('Empenhos (Betha 57140 × TCE, por entidade + número + data + valor original)');
console.table(r.empenhos);
if (r.empenhosSemPar.length) {
  console.log('Empenhos sem par');
  console.table(r.empenhosSemPar.slice(0, 30).map(({ id, ...x }) => x));
}

if (values.json) {
  await mkdir(DATA_DIR, { recursive: true });
  const destino = path.join(DATA_DIR, `${r.ano}.json`);
  await writeFile(destino, JSON.stringify(r, null, 2));
  console.log(`JSON → ${path.relative(RAIZ, destino)}`);
}
