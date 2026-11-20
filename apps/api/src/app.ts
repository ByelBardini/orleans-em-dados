// API somente leitura sobre as coletas publicadas no PostgreSQL. Não consulta as fontes a cada acesso.
import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { rotasDeColetas } from './modules/coletas/coletas.routes';
import { rotasDeConferencias } from './modules/conferencias/conferencias.routes';
import { rotasDeDespesas } from './modules/despesas/despesas.routes';
import { rotasDeDiscrepancias } from './modules/discrepancias/discrepancias.routes';
import { rotasDeEducacao } from './modules/educacao/educacao.routes';
import { rotasDeEmpenhos } from './modules/empenhos/empenhos.routes';
import { rotasDeFuncoes } from './modules/funcoes/funcoes.routes';
import { rotasDeImportacoes } from './modules/importacoes/importacoes.routes';
import { rotasDoMunicipio } from './modules/municipio/municipio.routes';
import { rotasDeReceitas } from './modules/receitas/receitas.routes';
import { rotasDeSaude } from './modules/saude/saude.routes';

export type OpcoesDoApp = {
  /** A pasta do build do web (`apps/web/dist`). Sem ela, ou se não existir, só a API responde (o Vite serve o web). */
  site?: string | undefined;
  /** Para o teste: a checagem do banco da `/api/saude`. */
  checarBanco?: () => Promise<void>;
};

const ehDaApi = (url: string) => url === '/api' || url.startsWith('/api/') || url.startsWith('/api?');
// Asset do Vite leva hash no nome: pode ficar em cache para sempre. O index muda a cada deploy.
const CACHE_LONGO = 'public, max-age=31536000, immutable';

export function criarApp(opcoes: FastifyServerOptions = {}, { site, checarBanco }: OpcoesDoApp = {}): FastifyInstance {
  const app = Fastify({ exposeHeadRoutes: false, ...opcoes });

  // A busca de empenhos traz nome de credor que pode ser pessoa física: buscador nenhum indexa a API.
  // O painel continua indexável; o `robots.txt` do web também fecha `/api/`.
  app.addHook('onSend', async (request, reply) => {
    if (ehDaApi(request.url)) reply.header('X-Robots-Tag', 'noindex, nofollow');
  });

  const comSite = Boolean(site && existsSync(path.join(site, 'index.html')));
  if (site && comSite) {
    app.register(fastifyStatic, {
      root: site,
      wildcard: false,
      setHeaders: (res, caminho) =>
        res.header('Cache-Control', caminho.includes(`${path.sep}assets${path.sep}`) ? CACHE_LONGO : 'no-cache'),
    });
  }
  // As abas do painel são da própria página (hash): qualquer caminho fora da API volta para o index.
  app.setNotFoundHandler((request, reply) => {
    if (comSite && request.method === 'GET' && !ehDaApi(request.url)) {
      return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
    }
    return reply.code(404).send({ erro: 'Rota não encontrada' });
  });
  app.setErrorHandler((erro, request, reply) => {
    request.log.error(erro);
    return reply.code(500).send({ erro: 'Erro interno' });
  });

  app.register(rotasDeColetas);
  app.register(rotasDeReceitas);
  app.register(rotasDeDespesas);
  app.register(rotasDeEmpenhos);
  app.register(rotasDeConferencias);
  app.register(rotasDeDiscrepancias);
  app.register(rotasDeImportacoes);
  app.register(rotasDoMunicipio);
  app.register(rotasDeFuncoes);
  app.register(rotasDeEducacao);
  app.register(rotasDeSaude(checarBanco));
  return app;
}
