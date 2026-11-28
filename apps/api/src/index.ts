import { criarApp } from './app';
import { apoioDaSubida } from './modules/apoio/config';
import { tokenDoAnalitico } from './site/analitico';
import { normalizarSiteUrl } from './site/site';

const PORTA = Number(process.env.PORT ?? 3000);

// Em produção, `WEB_DIST` aponta para o build do web, e o mesmo processo serve o painel e a API.
// `SITE_URL` é o endereço público (canonical, prévia das redes, sitemap); sem ela, nada de URL absoluta.
const app = criarApp(
  { logger: { level: 'warn' } },
  {
    site: process.env.WEB_DIST,
    siteUrl: normalizarSiteUrl(process.env.SITE_URL),
    verificacaoGoogle: process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined,
    // O contador de acessos (Cloudflare Web Analytics, sem cookie): token errado desliga o contador e avisa.
    analitico: tokenDoAnalitico(process.env.CLOUDFLARE_ANALYTICS_TOKEN, (motivo) => console.warn(motivo)),
    // O Pix do apoio (PIX_CHAVE, PIX_NOME, PIX_CIDADE): config errada desliga o apoio, sem derrubar o site.
    apoio: apoioDaSubida(process.env, (motivo) => console.warn(motivo)),
  },
);
await app.listen({ port: PORTA, host: '0.0.0.0' });
console.log(`API em http://localhost:${PORTA}`);
