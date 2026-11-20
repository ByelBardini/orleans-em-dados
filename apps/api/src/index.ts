import { criarApp } from './app';
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
  },
);
await app.listen({ port: PORTA, host: '0.0.0.0' });
console.log(`API em http://localhost:${PORTA}`);
