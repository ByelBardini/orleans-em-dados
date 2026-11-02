import { despesasResumoSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance } from 'fastify';
import { parametro, responder, texto } from '../../lib/borda';
import { coletaOu404 } from '../coletas/coletas.routes';
import { resumoDespesas } from './despesas.dao';

export async function rotasDeDespesas(app: FastifyInstance) {
  // Despesa orçamentária (57170) e, à parte, a Câmara pelo TCE-SC.
  app.get('/api/despesas/resumo', async (request, reply) => {
    const coleta = await coletaOu404(request, reply, 'despesas');
    if (!coleta) return reply;
    const resumo = await resumoDespesas(coleta, {
      entidade: texto(request, 'entidade'),
      ano: Number(parametro(request, 'ano')),
    });
    return responder(reply, despesasResumoSchema, resumo);
  });
}
