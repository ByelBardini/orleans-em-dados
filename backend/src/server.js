// API somente leitura sobre as coletas publicadas no PostgreSQL.
// Não consulta a Betha a cada acesso.

import { createServer } from 'node:http';
import { conferencia } from '@orleans-em-dados/db/conferencias';
import { anosDisponiveis, coletaPublicada } from './dados.js';
import { buscarEmpenhos, resumoDespesas, resumoEmpenhos, resumoReceitas, todosEmpenhos } from './indicadores.js';

const PORT = Number(process.env.PORT ?? 3000);

const json = (res, status, corpo) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
};

// CSV no formato que o Excel em português abre direto: BOM, `;` e vírgula decimal.
const csv = (res, nome, colunas, linhas) => {
  const celula = (v) => {
    if (v === null || v === undefined) return '';
    const t = typeof v === 'number' || /^-?\d+\.\d+$/.test(v) ? String(v).replace('.', ',') : String(v);
    return /[";\n\r]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
  };
  const corpo = [colunas.map(([, titulo]) => titulo), ...linhas.map((l) => colunas.map(([campo]) => l[campo]))]
    .map((l) => l.map(celula).join(';'))
    .join('\r\n');
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${nome}"`,
  });
  res.end(`﻿${corpo}\r\n`);
};

async function snapshotOu404(res, consulta, ano) {
  const s = Number.isInteger(Number(ano)) ? await coletaPublicada(consulta, Number(ano)) : null;
  if (!s) json(res, 404, { erro: `Sem dados de ${consulta} para ${ano}` });
  return s;
}

// Empenhos Betha que a conferência aponta como versões antigas de empenhos
// renumerados ou registros repetidos: saem das somas. Cache curto por ano,
// porque a conferência roda várias consultas.
const CACHE_MS = 5 * 60_000;
const cacheExcluir = new Map();
async function empenhosExcluidos(ano) {
  const c = cacheExcluir.get(ano);
  if (c && Date.now() - c.em < CACHE_MS) return c.ids;
  const conf = await conferencia(ano);
  const ids = conf?.disponivel
    ? conf.empenhosSemPar.filter((e) => e.fonte === 'betha' && (e.ocorrencia > 1 || e.numeroNaOutra)).map((e) => e.id)
    : [];
  cacheExcluir.set(ano, { em: Date.now(), ids });
  return ids;
}

const filtrosEmpenho = (q) => ({
  q: q.get('q') ?? '',
  entidade: q.get('entidade') ?? '',
  orgao: q.get('orgao') ?? '',
  situacao: q.get('situacao') ?? '',
});

const rotas = {
  '/api/anos': async (_q, res) => json(res, 200, await anosDisponiveis()),

  // Betha × TCE-SC sobre as coletas publicadas; 404 se faltar alguma das fontes.
  '/api/conferencias': async (q, res) => {
    const ano = Number(q.get('ano'));
    const c = Number.isInteger(ano) ? await conferencia(ano) : null;
    if (!c?.disponivel) return json(res, 404, { erro: `Sem as duas fontes publicadas para ${q.get('ano')}`, faltando: c?.faltando });
    json(res, 200, c);
  },

  '/api/receitas': async (q, res) => {
    const s = await snapshotOu404(res, 'receitas', q.get('ano'));
    if (s) json(res, 200, await resumoReceitas(s, { entidade: q.get('entidade') ?? '' }));
  },

  '/api/receitas.csv': async (q, res) => {
    const s = await snapshotOu404(res, 'receitas', q.get('ano'));
    if (!s) return;
    const { naturezas } = await resumoReceitas(s, { entidade: q.get('entidade') ?? '' });
    csv(
      res,
      `receitas-${q.get('ano')}.csv`,
      [
        ['rubrica', 'Rubrica'],
        ['descricao', 'Descrição'],
        ['entidade', 'Entidade'],
        ['orcadoAtualizado', 'Orçado atualizado'],
        ['arrecadadoNoMes', 'Arrecadado'],
      ],
      naturezas,
    );
  },

  // Despesa orçamentária (57170) e, à parte, a Câmara pelo TCE-SC.
  '/api/despesas/resumo': async (q, res) => {
    const s = await snapshotOu404(res, 'despesas', q.get('ano'));
    if (s) json(res, 200, await resumoDespesas(s, { entidade: q.get('entidade') ?? '', ano: Number(q.get('ano')) }));
  },

  '/api/despesas/empenhos/resumo': async (q, res) => {
    const s = await snapshotOu404(res, 'empenhos', q.get('ano'));
    if (!s) return;
    const excluir = await empenhosExcluidos(Number(q.get('ano')));
    json(res, 200, await resumoEmpenhos(s, { entidade: q.get('entidade') ?? '', excluir }));
  },

  '/api/despesas/empenhos': async (q, res) => {
    const s = await snapshotOu404(res, 'empenhos', q.get('ano'));
    if (!s) return;
    json(
      res,
      200,
      await buscarEmpenhos(s, {
        ...filtrosEmpenho(q),
        offset: Math.max(0, Number(q.get('offset')) || 0),
        limit: Math.min(200, Math.max(1, Number(q.get('limit')) || 50)),
      }),
    );
  },

  '/api/despesas/empenhos.csv': async (q, res) => {
    const s = await snapshotOu404(res, 'empenhos', q.get('ano'));
    if (!s) return;
    csv(
      res,
      `empenhos-${q.get('ano')}.csv`,
      [
        ['numero', 'Número'],
        ['data', 'Data'],
        ['entidade', 'Entidade'],
        ['orgao', 'Órgão'],
        ['credor', 'Credor'],
        ['historico', 'Histórico'],
        ['empenhado', 'Empenhado'],
        ['liquidado', 'Liquidado'],
        ['pago', 'Pago'],
        ['saldoAPagar', 'Saldo a pagar'],
      ],
      await todosEmpenhos(s, filtrosEmpenho(q)),
    );
  },
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rota = req.method === 'GET' && rotas[url.pathname];
  if (!rota) return json(res, 404, { erro: 'Rota não encontrada' });
  try {
    await rota(url.searchParams, res);
  } catch (err) {
    console.error(err);
    json(res, 500, { erro: 'Erro interno' });
  }
}).listen(PORT, () => console.log(`API em http://localhost:${PORT}`));
