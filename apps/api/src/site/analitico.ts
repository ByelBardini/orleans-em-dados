// O contador de acessos do site: o Cloudflare Web Analytics, sem cookie e sem identificar quem visita.
// Liga só com `CLOUDFLARE_ANALYTICS_TOKEN`; desligado no desenvolvimento, nos testes e em quem fizer fork.
import { escaparHtml } from './head';

const BEACON = 'https://static.cloudflareinsights.com/beacon.min.js';

/** A tag do Cloudflare Web Analytics, com o token. Conta também a troca de página por `pushState`. */
export function scriptDoAnalitico(token: string): string {
  const config = escaparHtml(JSON.stringify({ token }));
  return `<script defer src="${BEACON}" data-cf-beacon="${config}"></script>`;
}

/** O token do contador, pronto para o head; `undefined` desliga. Valor errado avisa e desliga, sem derrubar o site. */
export function tokenDoAnalitico(valor: string | undefined, avisar: (motivo: string) => void): string | undefined {
  const token = valor?.trim();
  if (!token) return undefined;
  // O token vai para o HTML: só hexadecimal entra, e aspas ou `<` nunca chegam ao head.
  if (/^[0-9a-f]{32}$/i.test(token)) return token.toLowerCase();
  avisar('contador de acessos desligado: CLOUDFLARE_ANALYTICS_TOKEN inválido (esperado 32 caracteres hexadecimais)');
  return undefined;
}
