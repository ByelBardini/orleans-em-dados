// O painel servido pelo mesmo processo da API: o build do web (`WEB_DIST`), com o head de cada página
// montado aqui a partir do catálogo, 301 para a barra no fim e 404 de verdade para o que não é página.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import { PAGINAS, paginaDoCaminho, type Pagina } from '@orleans-em-dados/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { montarHead } from './head';
import { jsonLdDaPagina, serializarJsonLd } from './jsonld';
import { montarLlms } from './llms';
import { montarRobots } from './robots';
import { montarSitemap } from './sitemap';

/** O que o site lê do banco: os exercícios publicados e quando cada um foi atualizado. */
export type Exercicios = { anos: number[]; atualizadoEm: Record<string, string | Date> };

export type OpcoesDoSite = {
  /** A pasta do build do web, com o `index.html`. */
  pasta: string;
  siteUrl?: string | undefined;
  verificacaoGoogle?: string | undefined;
  /** A página Apoiar só existe com o Pix configurado. */
  apoioAtivo?: boolean | undefined;
  /** Os exercícios publicados (`anosDisponiveis`); o teste troca por um falso. */
  lerExercicios: () => Promise<Exercicios>;
  /** Milissegundos de agora; o teste troca para vencer o cache. */
  relogio?: (() => number) | undefined;
};

// Asset do Vite leva hash no nome: pode ficar em cache para sempre. O index muda a cada deploy.
const CACHE_LONGO = 'public, max-age=31536000, immutable';
const BLOCO_DO_HEAD = /<!--head:inicio-->[\s\S]*?<!--head:fim-->/;
// O head não consulta o banco a cada acesso: os exercícios mudam uma vez por dia, na coleta.
const VALIDADE_DOS_EXERCICIOS = 5 * 60_000;
const SEM_EXERCICIOS: Exercicios = { anos: [], atualizadoEm: {} };

export const ehDaApi = (url: string) => url === '/api' || url.startsWith('/api/') || url.startsWith('/api?');

/** `SITE_URL` sem barra no fim; recusa o que não é `http(s)://`, citando o valor. */
export function normalizarSiteUrl(valor: string | undefined): string | undefined {
  if (!valor?.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(valor.trim());
  } catch {
    throw new Error(`SITE_URL inválida: "${valor}" (esperado https://dominio)`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`SITE_URL inválida: "${valor}" (esperado https://dominio)`);
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/** Os exercícios publicados, lidos de novo só depois da validade. Falha do banco vira lista vazia, sem cache. */
function exerciciosEmCache(ler: () => Promise<Exercicios>, relogio: () => number, aviso: (erro: unknown) => void) {
  let guardado: { em: number; valor: Exercicios } | null = null;
  return async (): Promise<Exercicios> => {
    if (guardado && relogio() - guardado.em <= VALIDADE_DOS_EXERCICIOS) return guardado.valor;
    try {
      guardado = { em: relogio(), valor: await ler() };
      return guardado.valor;
    } catch (erro) {
      aviso(erro);
      return SEM_EXERCICIOS;
    }
  };
}

/** Registra o site no app: os arquivos do build, uma rota por página do catálogo e o 404 do que sobra. */
export function registrarSite(
  app: FastifyInstance,
  { pasta, siteUrl, verificacaoGoogle, apoioAtivo = false, lerExercicios, relogio = Date.now }: OpcoesDoSite,
) {
  // Lido uma vez na subida: o build não muda com o processo de pé.
  const index = readFileSync(path.join(pasta, 'index.html'), 'utf8');
  if (!BLOCO_DO_HEAD.test(index)) app.log.warn('index.html sem <!--head:inicio-->: o head das páginas não entra');
  if (!siteUrl) app.log.warn('SITE_URL ausente: o site sobe sem canonical, sem prévia com imagem e sem sitemap');
  const exercicios = exerciciosEmCache(lerExercicios, relogio, (erro) =>
    app.log.warn({ err: erro }, 'exercícios publicados indisponíveis: o head sai sem o período'),
  );

  const existe = (pagina: Pagina) => pagina.id !== 'apoiar' || apoioAtivo;
  // O JSON-LD pede URL absoluta: sem `SITE_URL`, fica de fora.
  const jsonLd = async (pagina: Pagina | null) => {
    if (!pagina || !siteUrl) return [];
    const { anos } = await exercicios();
    return jsonLdDaPagina(pagina, { siteUrl, anos }).map(serializarJsonLd);
  };
  const enviar = async (reply: FastifyReply, codigo: number, pagina: Pagina | null) => {
    const head = montarHead(pagina, { siteUrl, verificacaoGoogle, jsonLd: await jsonLd(pagina) });
    return reply
      .code(codigo)
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 'no-cache')
      .send(index.replace(BLOCO_DO_HEAD, () => head));
  };

  app.register(fastifyStatic, {
    root: path.resolve(pasta),
    wildcard: false,
    // A raiz e o `index.html` saem só pelas rotas abaixo, com o head da página; robots, sitemap e llms são
    // gerados aqui, e um arquivo antigo com o mesmo nome no build não ganha deles.
    index: false,
    globIgnore: ['index.html', 'robots.txt', 'sitemap.xml', 'llms.txt'],
    setHeaders: (res, caminho) =>
      res.header('Cache-Control', caminho.includes(`${path.sep}assets${path.sep}`) ? CACHE_LONGO : 'no-cache'),
  });

  const texto = (reply: FastifyReply, tipo: string, corpo: string) =>
    reply.header('Content-Type', `${tipo}; charset=utf-8`).header('Cache-Control', 'no-cache').send(corpo);
  app.get('/robots.txt', async (_request, reply) => texto(reply, 'text/plain', montarRobots({ siteUrl })));
  app.get('/llms.txt', async (_request, reply) => texto(reply, 'text/plain', montarLlms({ siteUrl, apoioAtivo })));
  app.get('/sitemap.xml', async (_request, reply) => {
    // O protocolo pede endereço absoluto: sem `SITE_URL`, não há sitemap.
    if (!siteUrl) return enviar(reply, 404, null);
    const { atualizadoEm } = await exercicios();
    return texto(reply, 'application/xml', montarSitemap({ siteUrl, apoioAtivo, atualizadoEm }));
  });

  for (const pagina of PAGINAS) {
    app.get(pagina.caminho, async (_request, reply) =>
      enviar(reply, existe(pagina) ? 200 : 404, existe(pagina) ? pagina : null),
    );
  }

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    if (request.method !== 'GET' || ehDaApi(request.url)) return reply.code(404).send({ erro: 'Rota não encontrada' });
    const [caminho = '/', query] = request.url.split(/\?(.*)/s);
    const achada = paginaDoCaminho(caminho);
    if (achada?.redirecionar && existe(achada.pagina)) {
      return reply.redirect(`${achada.redirecionar}${query ? `?${query}` : ''}`, 301);
    }
    return enviar(reply, 404, null);
  });
}
