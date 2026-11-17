// O que o Coolify chama para saber se o contêiner está bom: o processo responde e o banco também.
// A mensagem do erro do banco não sai: diz endereço e porta da rede interna.
import { saudeSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import type { FastifyInstance } from 'fastify';
import { responder } from '../../lib/borda';

export const checarBancoDeVerdade = async () => {
  await pool.query('SELECT 1');
};

export function rotasDeSaude(checarBanco: () => Promise<void> = checarBancoDeVerdade) {
  return async (app: FastifyInstance) => {
    app.get('/api/saude', async (request, reply) => {
      try {
        await checarBanco();
        return responder(reply, saudeSchema, { ok: true });
      } catch (erro) {
        request.log.error(erro);
        return reply.code(503).send({ ok: false });
      }
    });
  };
}
