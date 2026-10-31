// Coleta paginada de uma consulta Betha, com validação de integridade e
// conferência dos somatórios contra os totalizadores da própria consulta.
//
// Uso: npm run coletar -- --ano 2025 [--consulta receitas|empenhos] [--json]
//
// Grava a coleta no banco. Só a publica (dashboard) se todas as checagens
// passarem; uma coleta rejeitada fica registrada e a publicação anterior é mantida.
// Com --json, também salva o snapshot em data/betha/.

import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { pool } from '@orleans-em-dados/db';
import { gravarColeta } from '../gravar.js';
import { BethaAuthClient } from './auth.js';
import { BethaQueryClient } from './client.js';
import { CONSULTAS, urlConsulta } from './config.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA_DIR = path.resolve(RAIZ, process.env.DATA_DIR ?? 'data', 'betha');
const PAGE_SIZE = Number(process.env.BETHA_PAGE_SIZE ?? 100);
const PAUSA_MS = Number(process.env.BETHA_PAUSA_MS ?? 300);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const centavos = (v) => Math.round(Number(v) * 100);

async function salvarJson(chave, ano, snapshot) {
  await mkdir(DATA_DIR, { recursive: true });
  const base = path.join(DATA_DIR, `${chave}-${ano}`);
  const destino = snapshot.meta.erros.length === 0 ? `${base}.json` : `${base}.rejeitado.json`;
  await writeFile(`${destino}.tmp`, JSON.stringify(snapshot));
  await rename(`${destino}.tmp`, destino);
  return destino;
}

async function coletar(client, chave, ano, { json }) {
  const consulta = CONSULTAS[chave];
  const filtro = consulta.filtro(ano);
  const iniciadoEm = new Date().toISOString();
  console.log(`\n[${consulta.id}] ${consulta.nome} — ${ano}`);

  const primeira = await client.buscar(consulta.id, filtro, { offset: 0, limit: PAGE_SIZE });
  const totalHits = primeira.totalHits;
  const hits = [...primeira.hits];
  const erros = [];

  while (hits.length < totalHits) {
    await esperar(PAUSA_MS);
    const pagina = await client.buscar(consulta.id, filtro, { offset: hits.length, limit: PAGE_SIZE });
    if (pagina.totalHits !== totalHits) {
      erros.push(`totalHits mudou durante a coleta (${totalHits} → ${pagina.totalHits})`);
      break;
    }
    if (pagina.hits.length === 0) break;
    hits.push(...pagina.hits);
    process.stdout.write(`\r  ${hits.length}/${totalHits}`);
  }
  process.stdout.write('\n');

  const ids = new Set(hits.map((h) => h.id));
  if (hits.length !== totalHits) erros.push(`capturados ${hits.length} de ${totalHits}`);
  if (ids.size !== hits.length) erros.push(`${hits.length - ids.size} IDs repetidos`);

  // Soma em centavos; ausência de campo é contada, não tratada como zero.
  const somas = Object.fromEntries(consulta.camposSoma.map((c) => [c, 0]));
  const ausentes = Object.fromEntries(consulta.camposSoma.map((c) => [c, 0]));
  for (const h of hits) {
    for (const c of consulta.camposSoma) {
      const v = h.sourceAsMap?.[c];
      if (v === null || v === undefined) ausentes[c]++;
      else somas[c] += centavos(v);
    }
  }

  const totais = await client.totalizadores(consulta.id, filtro);
  const conferencia = consulta.camposSoma.map((campo) => {
    const t = totais.find((x) => x.campo === campo);
    const calculado = somas[campo] / 100;
    if (!t) {
      erros.push(`totalizador ausente para ${campo}`);
      return { campo, calculado, fonte: null, diferenca: null };
    }
    const diferenca = (somas[campo] - centavos(t.valor)) / 100;
    if (diferenca !== 0) erros.push(`${campo}: diferença de ${diferenca} em relação ao totalizador`);
    return { campo, titulo: t.titulo, descricao: t.descricao, calculado, fonte: Number(t.valor), diferenca };
  });

  const snapshot = {
    meta: {
      fonte: 'Portal da Transparência Betha — Orleans/SC',
      consultaId: consulta.id,
      consultaNome: consulta.nome,
      urlOrigem: urlConsulta(consulta.id),
      ano: Number(ano),
      filtro,
      iniciadoEm,
      coletadoEm: new Date().toISOString(),
      totalHits,
      capturados: hits.length,
      idsUnicos: ids.size,
      camposAusentes: ausentes,
      conferencia,
      status: erros.length === 0 ? 'totalizador_conciliado' : 'rejeitado',
      erros,
    },
    registros: hits.map((h) => ({ id: h.id, ...h.sourceAsMap })),
  };

  for (const c of conferencia) {
    console.log(`  ${c.campo}: calculado ${c.calculado} | totalizador ${c.fonte} | dif ${c.diferenca}`);
  }

  const { coletaId, publicada } = await gravarColeta(snapshot, 'api');
  if (json) console.log(`  JSON → ${path.relative(RAIZ, await salvarJson(chave, ano, snapshot))}`);

  if (erros.length) {
    console.error(`  REJEITADO (coleta ${coletaId} gravada, não publicada): ${erros.join('; ')}`);
  } else {
    console.log(`  OK → coleta ${coletaId} gravada${publicada ? ' e publicada' : ''}`);
  }
  return erros.length === 0;
}

const { values } = parseArgs({
  options: {
    ano: { type: 'string', default: String(new Date().getFullYear()) },
    consulta: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
});

const chaves = values.consulta ? [values.consulta] : Object.keys(CONSULTAS);
for (const c of chaves) {
  if (!CONSULTAS[c]) {
    console.error(`Consulta desconhecida: ${c}. Opções: ${Object.keys(CONSULTAS).join(', ')}`);
    process.exit(1);
  }
}

const client = new BethaQueryClient(new BethaAuthClient());
let ok = true;
for (const c of chaves) {
  try {
    ok = (await coletar(client, c, values.ano, { json: values.json })) && ok;
  } catch (err) {
    ok = false;
    console.error(`  FALHA: ${err.message}`);
  }
}
await pool.end();
process.exit(ok ? 0 : 1);
