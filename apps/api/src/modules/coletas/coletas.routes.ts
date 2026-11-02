import { anosSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { parametro, responder } from '../../lib/borda';
import { anosDisponiveis, coletaPublicada, type ColetaPublicada } from './coletas.dao';

/** A coleta publicada pedida na query, ou nulo com o 404 já respondido. */
export async function coletaOu404(
  request: FastifyRequest,
  reply: FastifyReply,
  chave: string,
): Promise<ColetaPublicada | null> {
  const ano = parametro(request, 'ano');
  const coleta = Number.isInteger(Number(ano)) ? await coletaPublicada(chave, Number(ano)) : null;
  if (!coleta) await reply.code(404).send({ erro: `Sem dados de ${chave} para ${ano}` });
  return coleta;
}

export async function rotasDeColetas(app: FastifyInstance) {
  app.get('/api/anos', async (_request, reply) => responder(reply, anosSchema, await anosDisponiveis()));
}
