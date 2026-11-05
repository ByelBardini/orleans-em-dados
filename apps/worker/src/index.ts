// O worker: agenda os importadores no pg-boss e executa as rodadas.
import { pool } from '@orleans-em-dados/db';
import { RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { PgBoss } from 'pg-boss';
import { montarFilas, nomeDaFila } from './filas';
import { criarImportadores } from './registro';
import { rodarImportador } from './rodada';

const URL_PADRAO = 'postgres://orleans:orleans@localhost:5433/orleans_em_dados';

const boss = new PgBoss(process.env.DATABASE_URL ?? URL_PADRAO);
boss.on('error', (erro) => console.error(`pg-boss: ${erro.message}`));
await boss.start();

const importadores = criarImportadores();
const dependencias = { repositorio: new RepositorioDeLotesPostgres(), relogio: () => new Date() };

await montarFilas(boss, importadores, async (importador) => {
  console.log(`[${importador.id}] rodada iniciada`);
  const resultados = await rodarImportador(importador, dependencias);
  for (const r of resultados) console.log(`[${importador.id}] ${r.ano}: ${r.status}`);
});
console.log(
  `Worker no ar: ${importadores
    .filter((i) => i.agenda)
    .map((i) => `${nomeDaFila(i)} (${i.agenda})`)
    .join(', ')}`,
);

async function encerrar() {
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
