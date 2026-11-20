// O painel servido pelo mesmo processo da API: o build do web (`WEB_DIST`), com o head de cada página
// montado aqui a partir do catálogo, 301 para a barra no fim e 404 de verdade para o que não é página.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import { PAGINAS, paginaDoCaminho, type Pagina } from '@orleans-em-dados/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { montarHead } from './head';

export type OpcoesDoSite = {
  /** A pasta do build do web, com o `index.html`. */
  pasta: string;
  siteUrl?: string | undefined;
  verificacaoGoogle?: string | undefined;
  /** A página Apoiar só existe com o Pix configurado. */
  apoioAtivo?: boolean;
};

// Asset do Vite leva hash no nome: pode ficar em cache para sempre. O index muda a cada deploy.
const CACHE_LONGO = 'public, max-age=31536000, immutable';
const BLOCO_DO_HEAD = /<!--head:inicio-->[\s\S]*?<!--head:fim-->/;

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

/** Registra o site no app: os arquivos do build, uma rota por página do catálogo e o 404 do que sobra. */
export function registrarSite(
  app: FastifyInstance,
  { pasta, siteUrl, verificacaoGoogle, apoioAtivo = false }: OpcoesDoSite,
) {
  // Lido uma vez na subida: o build não muda com o processo de pé.
  const index = readFileSync(path.join(pasta, 'index.html'), 'utf8');
  if (!BLOCO_DO_HEAD.test(index)) app.log.warn('index.html sem <!--head:inicio-->: o head das páginas não entra');
  if (!siteUrl) app.log.warn('SITE_URL ausente: o site sobe sem canonical, sem prévia com imagem e sem sitemap');

  const existe = (pagina: Pagina) => pagina.id !== 'apoiar' || apoioAtivo;
  const html = (pagina: Pagina | null) =>
    index.replace(BLOCO_DO_HEAD, () => montarHead(pagina, { siteUrl, verificacaoGoogle }));
  const enviar = (reply: FastifyReply, codigo: number, pagina: Pagina | null) =>
    reply
      .code(codigo)
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 'no-cache')
      .send(html(pagina));

  app.register(fastifyStatic, {
    root: path.resolve(pasta),
    wildcard: false,
    // A raiz e o `index.html` saem só pelas rotas abaixo, com o head da página.
    index: false,
    allowedPath: (caminho) => caminho !== '/index.html',
    setHeaders: (res, caminho) =>
      res.header('Cache-Control', caminho.includes(`${path.sep}assets${path.sep}`) ? CACHE_LONGO : 'no-cache'),
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
