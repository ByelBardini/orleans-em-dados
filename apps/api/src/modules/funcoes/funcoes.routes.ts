import { funcoesSchema, funcoesSerieSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance } from 'fastify';
import { parametro, responder } from '../../lib/borda';
import { coletaPublicada } from '../coletas/coletas.dao';
import { funcoesDoAno, serieDasFuncoes } from './funcoes.service';

export async function rotasDeFuncoes(app: FastifyInstance) {
  app.get('/api/funcoes', async (request, reply) => {
    const pedido = parametro(request, 'ano');
    const ano = Number(pedido);
    const publicada = /^\d{4}$/.test(pedido ?? '') ? await coletaPublicada('siconfi_funcoes', ano) : null;
    if (!publicada) return reply.code(404).send({ erro: `Sem despesa por função para ${pedido}` });
    return responder(reply, funcoesSchema, await funcoesDoAno(publicada, ano));
  });

  app.get('/api/funcoes/serie', async (_request, reply) =>
    responder(reply, funcoesSerieSchema, await serieDasFuncoes()),
  );
}
