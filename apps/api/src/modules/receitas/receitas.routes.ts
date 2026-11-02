import { receitasSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance } from 'fastify';
import { parametro, responder, responderCsv, texto } from '../../lib/borda';
import { gerarCsv } from '../../lib/csv';
import { coletaOu404 } from '../coletas/coletas.routes';
import { resumoReceitas } from './receitas.dao';

const COLUNAS = [
  ['rubrica', 'Rubrica'],
  ['descricao', 'Descrição'],
  ['entidade', 'Entidade'],
  ['orcadoAtualizado', 'Orçado atualizado'],
  ['arrecadadoNoMes', 'Arrecadado'],
] as const;

export async function rotasDeReceitas(app: FastifyInstance) {
  app.get('/api/receitas', async (request, reply) => {
    const coleta = await coletaOu404(request, reply, 'receitas');
    if (!coleta) return reply;
    return responder(reply, receitasSchema, await resumoReceitas(coleta, { entidade: texto(request, 'entidade') }));
  });

  app.get('/api/receitas.csv', async (request, reply) => {
    const coleta = await coletaOu404(request, reply, 'receitas');
    if (!coleta) return reply;
    const { naturezas } = await resumoReceitas(coleta, { entidade: texto(request, 'entidade') });
    return responderCsv(reply, `receitas-${parametro(request, 'ano')}.csv`, gerarCsv(COLUNAS, naturezas));
  });
}
