import { municipioSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance } from 'fastify';
import { responder } from '../../lib/borda';
import { municipio } from './municipio.service';

export async function rotasDoMunicipio(app: FastifyInstance) {
  // Sem coleta não é erro: a página diz o que falta.
  app.get('/api/municipio', async (_request, reply) => responder(reply, municipioSchema, await municipio()));
}
