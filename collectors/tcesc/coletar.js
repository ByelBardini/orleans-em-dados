// Coleta dos painéis municipais do Farol TCE-SC (Qlik Engine API), com
// conferência do recorte selecionado e da soma das linhas contra o total do motor.
//
// Uso: npm run coletar:tcesc -- --ano 2025 [--consulta receitas|empenhos] [--json]
//
// Mesmo fluxo da Betha: grava a coleta; só publica se todas as checagens passarem.
// Com --json, também salva o snapshot em data/tcesc/.

import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { pool } from '@orleans-em-dados/db';
import { gravarColeta } from '../gravar.js';
import { CONSULTAS, TCESC } from './config.js';
import { QlikSessao } from './qlik-client.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA_DIR = path.resolve(RAIZ, process.env.DATA_DIR ?? 'data', 'tcesc');

// O motor devolve double (ex.: 170915184.25000012). Converte para centavos
// inteiros e rejeita o que não estiver praticamente sobre um centavo inteiro.
function centavos(qNum) {
  if (typeof qNum !== 'number' || !Number.isFinite(qNum)) return null;
  const c = qNum * 100;
  const r = Math.round(c);
  return Math.abs(c - r) < 1e-3 ? r : null;
}
const decimal = (c) => `${c < 0 ? '-' : ''}${Math.trunc(Math.abs(c) / 100)}.${String(Math.abs(c) % 100).padStart(2, '0')}`;
// Nulo no Qlik: qIsNull, ou qText '-' com qNum 'NaN'.
const texto = (cel) => (cel.qIsNull || cel.qText === undefined || cel.qText === '-' ? null : cel.qText);

async function salvarJson(chave, ano, snapshot) {
  await mkdir(DATA_DIR, { recursive: true });
  const base = path.join(DATA_DIR, `${chave}-${ano}`);
  const destino = snapshot.meta.erros.length === 0 ? `${base}.json` : `${base}.rejeitado.json`;
  await writeFile(`${destino}.tmp`, JSON.stringify(snapshot));
  await rename(`${destino}.tmp`, destino);
  return destino;
}

async function lerCubo(consulta, app, ano, erros) {
  const s = await QlikSessao.abrir(app.id);
  try {
    const antes = await s.infoApp();
    await s.limparSelecoes();
    await s.selecionar(consulta.filtroEnte, TCESC.municipio);
    await s.selecionar(consulta.filtroAno, String(ano));

    // Exatamente os dois filtros pedidos, com um valor cada.
    const selecoes = await s.selecoes();
    const esperado = { [consulta.filtroEnte]: [TCESC.municipio], [consulta.filtroAno]: [String(ano)] };
    const ordenar = (o) => JSON.stringify(Object.entries(o).sort());
    if (ordenar(selecoes) !== ordenar(esperado)) erros.push(`seleções inesperadas: ${JSON.stringify(selecoes)}`);

    const cubo = await s.hipercubo({ dimensoes: consulta.dimensoes, medidas: consulta.medidas.map((m) => m.expr) });
    const depois = await s.infoApp();
    if (antes.ultimaRecarga !== depois.ultimaRecarga) {
      erros.push(`app recarregado durante a coleta (${antes.ultimaRecarga} → ${depois.ultimaRecarga})`);
    }
    return { cubo, selecoes, ultimaRecarga: depois.ultimaRecarga };
  } finally {
    s.fechar();
  }
}

async function coletar(chave, ano, { json }) {
  const consulta = CONSULTAS[chave];
  const app = TCESC.apps[consulta.app];
  const iniciadoEm = new Date().toISOString();
  const erros = [];
  console.log(`\n[TCE-SC] ${consulta.nome} — ${ano}`);

  const { cubo, selecoes, ultimaRecarga } = await lerCubo(consulta, app, ano, erros);
  if (cubo.linhas.length !== cubo.linhasTotal) erros.push(`capturadas ${cubo.linhas.length} de ${cubo.linhasTotal} linhas`);

  // Soma em centavos; célula vazia é contada como ausente, não como zero.
  const nd = consulta.dimensoes.length;
  const somas = Object.fromEntries(consulta.medidas.filter((m) => m.soma).map((m) => [m.campo, 0]));
  const ausentes = Object.fromEntries(consulta.medidas.map((m) => [m.campo, 0]));
  const registros = cubo.linhas.map((linha) => {
    const dims = linha.slice(0, nd).map(texto);
    const reg = { id: dims.map((d) => d ?? '').join('|') };
    consulta.dimensoes.forEach((d, i) => (reg[d] = dims[i]));
    consulta.medidas.forEach((m, i) => {
      const cel = linha[nd + i];
      if (!m.soma) {
        reg[m.campo] = texto(cel);
      } else {
        const c = centavos(cel.qNum);
        if (c === null && texto(cel) !== null) erros.push(`valor não monetário em ${m.campo}: ${cel.qText}`);
        if (c !== null) somas[m.campo] += c;
        reg[m.campo] = c === null ? null : decimal(c);
      }
      if (reg[m.campo] === null) ausentes[m.campo]++;
    });
    return reg;
  });

  const ids = new Set(registros.map((r) => r.id));
  if (ids.size !== registros.length) erros.push(`${registros.length - ids.size} chaves repetidas`);

  const conferencia = consulta.medidas.flatMap((m, i) => {
    if (!m.soma) return [];
    const fonte = centavos(cubo.totais[i].qNum);
    if (fonte === null) {
      erros.push(`total do motor ausente para ${m.campo}`);
      return [{ campo: m.campo, titulo: m.expr, calculado: somas[m.campo] / 100, fonte: null, diferenca: null }];
    }
    const diferenca = (somas[m.campo] - fonte) / 100;
    if (diferenca !== 0) erros.push(`${m.campo}: soma das linhas difere do total do motor (${diferenca})`);
    return [{ campo: m.campo, titulo: m.expr, descricao: 'Total geral do hipercubo no motor Qlik', calculado: somas[m.campo] / 100, fonte: fonte / 100, diferenca }];
  });

  const snapshot = {
    meta: {
      fonte: 'Farol TCE-SC — painéis municipais',
      consultaId: consulta.id,
      consultaNome: consulta.nome,
      urlOrigem: app.painel,
      ano: Number(ano),
      filtro: {
        appId: app.id,
        selecoes: { [consulta.filtroEnte]: TCESC.municipio, [consulta.filtroAno]: String(ano) },
        selecoesConfirmadas: selecoes,
        dimensoes: consulta.dimensoes,
        medidas: consulta.medidas.map((m) => m.expr),
        ultimaRecargaApp: ultimaRecarga,
      },
      iniciadoEm,
      coletadoEm: new Date().toISOString(),
      totalHits: cubo.linhasTotal,
      capturados: registros.length,
      idsUnicos: ids.size,
      camposAusentes: ausentes,
      conferencia,
      status: erros.length === 0 ? 'totalizador_conciliado' : 'rejeitado',
      erros,
    },
    registros,
  };

  console.log(`  linhas: ${registros.length}/${cubo.linhasTotal} | recarga do app: ${ultimaRecarga}`);
  for (const c of conferencia) console.log(`  ${c.campo}: soma ${c.calculado} | motor ${c.fonte} | dif ${c.diferenca}`);

  const { coletaId, publicada } = await gravarColeta(snapshot, 'api');
  if (json) console.log(`  JSON → ${path.relative(RAIZ, await salvarJson(chave, ano, snapshot))}`);
  if (erros.length) console.error(`  REJEITADO (coleta ${coletaId} gravada, não publicada): ${erros.join('; ')}`);
  else console.log(`  OK → coleta ${coletaId} gravada${publicada ? ' e publicada' : ''}`);
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

let ok = true;
for (const c of chaves) {
  try {
    ok = (await coletar(c, values.ano, { json: values.json })) && ok;
  } catch (err) {
    ok = false;
    console.error(`  FALHA: ${err.message}`);
  }
}
await pool.end();
process.exit(ok ? 0 : 1);
