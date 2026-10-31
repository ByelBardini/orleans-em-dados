// API somente leitura sobre as coletas publicadas no PostgreSQL.
// Não consulta a Betha a cada acesso.

import { createServer } from 'node:http';
import { anosDisponiveis, coletaPublicada } from './dados.js';
import { buscarEmpenhos, resumoEmpenhos, resumoReceitas } from './indicadores.js';

const PORT = Number(process.env.PORT ?? 3000);

const json = (res, status, corpo) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
};

async function snapshotOu404(res, consulta, ano) {
  const s = Number.isInteger(Number(ano)) ? await coletaPublicada(consulta, Number(ano)) : null;
  if (!s) json(res, 404, { erro: `Sem dados de ${consulta} para ${ano}` });
  return s;
}

const rotas = {
  '/api/anos': async (_q, res) => json(res, 200, await anosDisponiveis()),

  '/api/receitas': async (q, res) => {
    const s = await snapshotOu404(res, 'receitas', q.get('ano'));
    if (s) json(res, 200, await resumoReceitas(s));
  },

  '/api/despesas/empenhos/resumo': async (q, res) => {
    const s = await snapshotOu404(res, 'empenhos', q.get('ano'));
    if (s) json(res, 200, await resumoEmpenhos(s));
  },

  '/api/despesas/empenhos': async (q, res) => {
    const s = await snapshotOu404(res, 'empenhos', q.get('ano'));
    if (!s) return;
    json(
      res,
      200,
      await buscarEmpenhos(s, {
        q: q.get('q') ?? '',
        entidade: q.get('entidade') ?? '',
        offset: Math.max(0, Number(q.get('offset')) || 0),
        limit: Math.min(200, Math.max(1, Number(q.get('limit')) || 50)),
      }),
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
