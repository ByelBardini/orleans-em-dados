import { discrepanciasSchema } from '@orleans-em-dados/contracts';
import { conferirFuncoes, dadosConferidos } from '@orleans-em-dados/db/conferencias';
import type { FastifyInstance } from 'fastify';
import { parametro, responder } from '../../lib/borda';
import { coletaPublicada } from '../coletas/coletas.dao';
import { montarSecao, secaoIndisponivel } from './discrepancias.service';

export async function rotasDeDiscrepancias(app: FastifyInstance) {
  // O que ficou fora do conferido, por tipo. Ano sem coleta é 404; ano sem as duas fontes diz o que falta.
  app.get('/api/discrepancias', async (request, reply) => {
    const pedido = parametro(request, 'ano');
    const ano = Number(pedido);
    const publicado = /^\d{4}$/.test(pedido ?? '') ? await coletaPublicada('receitas', ano) : null;
    if (!publicado) return reply.code(404).send({ erro: `Sem dados de discrepâncias para ${pedido}` });
    const [dados, funcoes] = await Promise.all([dadosConferidos(ano), conferirFuncoes(ano)]);
    return responder(
      reply,
      discrepanciasSchema,
      dados.disponivel ? montarSecao({ ...dados, funcoes }) : secaoIndisponivel(ano, dados.faltando),
    );
  });
}
