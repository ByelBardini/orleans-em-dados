import { empenhosBuscaSchema, empenhosResumoSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parametro, responder, responderCsv, texto } from '../../lib/borda';
import { gerarCsv } from '../../lib/csv';
import { coletaOu404 } from '../coletas/coletas.routes';
import { buscarEmpenhos, resumoEmpenhos, todosEmpenhos } from './empenhos.dao';
import { conjuntoDoAno } from './empenhos.service';

const COLUNAS = [
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
  ['empenhadoLiquido', 'Empenhado líquido'],
] as const;

const filtros = (request: FastifyRequest) => ({
  q: texto(request, 'q'),
  entidade: texto(request, 'entidade'),
  orgao: texto(request, 'orgao'),
  situacao: texto(request, 'situacao'),
});

const anoDo = (request: FastifyRequest) => Number(parametro(request, 'ano'));

export async function rotasDeEmpenhos(app: FastifyInstance) {
  app.get('/api/despesas/empenhos/resumo', async (request, reply) => {
    const coleta = await coletaOu404(request, reply, 'empenhos');
    if (!coleta) return reply;
    const { conjunto, conferencia } = await conjuntoDoAno(coleta, anoDo(request));
    const resumo = await resumoEmpenhos(coleta, conjunto, { entidade: texto(request, 'entidade') });
    return responder(reply, empenhosResumoSchema, { ...resumo, conferencia });
  });

  app.get('/api/despesas/empenhos', async (request, reply) => {
    const coleta = await coletaOu404(request, reply, 'empenhos');
    if (!coleta) return reply;
    const { conjunto } = await conjuntoDoAno(coleta, anoDo(request));
    const busca = await buscarEmpenhos(coleta, conjunto, {
      ...filtros(request),
      offset: Math.max(0, Number(parametro(request, 'offset')) || 0),
      limit: Math.min(200, Math.max(1, Number(parametro(request, 'limit')) || 50)),
    });
    return responder(reply, empenhosBuscaSchema, busca);
  });

  app.get('/api/despesas/empenhos.csv', async (request, reply) => {
    const coleta = await coletaOu404(request, reply, 'empenhos');
    if (!coleta) return reply;
    const { conjunto } = await conjuntoDoAno(coleta, anoDo(request));
    const linhas = await todosEmpenhos(coleta, conjunto, filtros(request));
    return responderCsv(reply, `empenhos-${parametro(request, 'ano')}.csv`, gerarCsv(COLUNAS, linhas));
  });
}
