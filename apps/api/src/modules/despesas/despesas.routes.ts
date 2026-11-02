import { despesasResumoSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance } from 'fastify';
import { parametro, responder, texto } from '../../lib/borda';
import { coletaOu404 } from '../coletas/coletas.routes';
import { despesasDoAno } from './despesas.service';

export async function rotasDeDespesas(app: FastifyInstance) {
  // Despesa conferida por entidade e, à parte, a Câmara pelo TCE-SC.
  app.get('/api/despesas/resumo', async (request, reply) => {
    const coleta = await coletaOu404(request, reply, 'despesas');
    if (!coleta) return reply;
    const corpo = await despesasDoAno(coleta, Number(parametro(request, 'ano')), texto(request, 'entidade'));
    return responder(reply, despesasResumoSchema, corpo);
  });
}
