import { conferenciaSchema } from '@orleans-em-dados/contracts';
import { conferencia } from '@orleans-em-dados/db/conferencias';
import type { FastifyInstance } from 'fastify';
import { parametro, responder } from '../../lib/borda';

export async function rotasDeConferencias(app: FastifyInstance) {
  // Betha × TCE-SC sobre as coletas publicadas; 404 se faltar alguma das fontes.
  app.get('/api/conferencias', async (request, reply) => {
    const pedido = parametro(request, 'ano');
    const ano = Number(pedido);
    const resultado = Number.isInteger(ano) ? await conferencia(ano) : null;
    if (!resultado?.disponivel) {
      return reply
        .code(404)
        .send({ erro: `Sem as duas fontes publicadas para ${pedido}`, faltando: resultado?.faltando });
    }
    return responder(reply, conferenciaSchema, resultado);
  });
}
