// O worker: agenda os importadores no pg-boss e executa as rodadas.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '@orleans-em-dados/db';
import { anosDeHistorico, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { PgBoss } from 'pg-boss';
import { importarPasta } from './comandos';
import { FILA_DO_HISTORICO, montarFilas, montarHistorico, nomeDaFila } from './filas';
import { completarHistorico, lerEstadoDoHistorico } from './historico';
import { criarImportadores } from './registro';
import { rodarImportador } from './rodada';

const URL_PADRAO = 'postgres://orleans:orleans@localhost:5433/orleans_em_dados';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
// Os snapshots de Educação versionados (INEP, SIOPE, MEC): a fonte não tem API, e o deploy os carrega.
const PASTA_DE_SNAPSHOTS = path.join(RAIZ, 'docs', 'educacao', 'snapshots');
const JANELA = anosDeHistorico(process.env.ANOS_DE_HISTORICO);
// Pausa entre um exercício e o seguinte na carga do histórico, para não pesar nas fontes.
const PAUSA_DO_HISTORICO_MS = Number(process.env.HISTORICO_PAUSA_MS ?? 5000);

const boss = new PgBoss(process.env.DATABASE_URL ?? URL_PADRAO);
boss.on('error', (erro) => console.error(`pg-boss: ${erro.message}`));
await boss.start();

const importadores = criarImportadores();
const dependencias = { repositorio: new RepositorioDeLotesPostgres(), relogio: () => new Date() };

// Hash igual vira `sem mudança`: carregar a pasta a cada subida não duplica nada.
const snapshots = await importarPasta(PASTA_DE_SNAPSHOTS, importadores, dependencias.repositorio);
for (const r of snapshots.filter((s) => s.erro)) console.error(`[snapshots] ${path.basename(r.arquivo)}: ${r.erro}`);
console.log(`[snapshots] ${snapshots.filter((s) => !s.erro).length} de ${snapshots.length} carregados`);

await montarFilas(boss, importadores, async (importador) => {
  console.log(`[${importador.id}] rodada iniciada`);
  const resultados = await rodarImportador(importador, dependencias);
  for (const r of resultados) console.log(`[${importador.id}] ${r.ano}: ${r.status}`);
});
await montarHistorico(boss, async (modo) => {
  console.log(`[historico] ${modo}: janela de ${JANELA} exercícios`);
  const resultados = await completarHistorico(
    importadores,
    {
      ...dependencias,
      esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
      lerEstado: lerEstadoDoHistorico,
    },
    { modo, janela: JANELA, pausaMs: PAUSA_DO_HISTORICO_MS },
  );
  for (const r of resultados) console.log(`[historico] ${r.importador} ${r.ano}: ${r.status}`);
});
await boss.send(FILA_DO_HISTORICO, { modo: 'subida' });

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
