import { importacoesSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance } from 'fastify';
import { responder } from '../../lib/borda';
import { situacaoDosImportadores } from './importacoes.dao';

export async function rotasDeImportacoes(app: FastifyInstance) {
  app.get('/api/importacoes', async (_request, reply) =>
    responder(reply, importacoesSchema, await situacaoDosImportadores()),
  );
}
