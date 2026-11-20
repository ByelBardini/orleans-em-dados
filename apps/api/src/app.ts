// API somente leitura sobre as coletas publicadas no PostgreSQL. Não consulta as fontes a cada acesso.
import { existsSync } from 'node:fs';
import path from 'node:path';
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
import { anosDisponiveis } from './modules/coletas/coletas.dao';
import { ehDaApi, registrarSite, type Exercicios } from './site/site';

export type OpcoesDoApp = {
  /** A pasta do build do web (`apps/web/dist`). Sem ela, ou se não existir, só a API responde (o Vite serve o web). */
  site?: string | undefined;
  /** O endereço público (`SITE_URL`, já sem barra no fim): canonical, prévia das redes, sitemap. */
  siteUrl?: string | undefined;
  /** O código da meta `google-site-verification` (`GOOGLE_SITE_VERIFICATION`). */
  verificacaoGoogle?: string | undefined;
  /** O Pix do apoio está configurado: a página Apoiar existe. */
  apoioAtivo?: boolean;
  /** Para o teste: os exercícios publicados que o site lê (padrão: `anosDisponiveis`), e o relógio do cache. */
  lerExercicios?: () => Promise<Exercicios>;
  relogio?: () => number;
  /** Para o teste: a checagem do banco da `/api/saude`. */
  checarBanco?: () => Promise<void>;
};

export function criarApp(
  opcoes: FastifyServerOptions = {},
  {
    site,
    siteUrl,
    verificacaoGoogle,
    apoioAtivo,
    checarBanco,
    lerExercicios = anosDisponiveis,
    relogio,
  }: OpcoesDoApp = {},
): FastifyInstance {
  const app = Fastify({ exposeHeadRoutes: false, ...opcoes });

  // A busca de empenhos traz nome de credor que pode ser pessoa física: buscador nenhum indexa a API.
  // O painel continua indexável.
  app.addHook('onSend', async (request, reply) => {
    if (ehDaApi(request.url)) reply.header('X-Robots-Tag', 'noindex, nofollow');
  });

  if (site && existsSync(path.join(site, 'index.html'))) {
    registrarSite(app, { pasta: site, siteUrl, verificacaoGoogle, apoioAtivo, lerExercicios, relogio });
  } else {
    app.setNotFoundHandler((_request, reply) => reply.code(404).send({ erro: 'Rota não encontrada' }));
  }
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
