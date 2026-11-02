// API somente leitura sobre as coletas publicadas no PostgreSQL. Não consulta as fontes a cada acesso.
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { rotasDeColetas } from './modules/coletas/coletas.routes';
import { rotasDeConferencias } from './modules/conferencias/conferencias.routes';
import { rotasDeDespesas } from './modules/despesas/despesas.routes';
import { rotasDeEmpenhos } from './modules/empenhos/empenhos.routes';
import { rotasDeImportacoes } from './modules/importacoes/importacoes.routes';
import { rotasDeReceitas } from './modules/receitas/receitas.routes';

export function criarApp(opcoes: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify({ exposeHeadRoutes: false, ...opcoes });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ erro: 'Rota não encontrada' }));
  app.setErrorHandler((erro, request, reply) => {
    request.log.error(erro);
    return reply.code(500).send({ erro: 'Erro interno' });
  });

  app.register(rotasDeColetas);
  app.register(rotasDeReceitas);
  app.register(rotasDeDespesas);
  app.register(rotasDeEmpenhos);
  app.register(rotasDeConferencias);
  app.register(rotasDeImportacoes);
  return app;
}
