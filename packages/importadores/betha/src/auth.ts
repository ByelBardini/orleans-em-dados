import { BETHA, type TransporteHttp } from './config';

const MARGEM_MS = 60_000;

// Obtém o token anônimo que o próprio portal usa (fluxo implícito, HTTP 303).
// O token fica só em memória e nunca é registrado em log.
export class BethaAuthClient {
  #token: string | null = null;
  #expiraEm = 0;

  constructor(
    private readonly transporte: TransporteHttp = fetch,
    private readonly agora: () => number = Date.now,
  ) {}

  async getToken(): Promise<string> {
    if (!this.#token || this.agora() > this.#expiraEm - MARGEM_MS) {
      return this.#renovar();
    }
    return this.#token;
  }

  invalidar(): void {
    this.#token = null;
    this.#expiraEm = 0;
  }

  async #renovar(): Promise<string> {
    const { authorizeUrl, clientId, redirectUri, scope } = BETHA.oauth;
    const u = new URL(authorizeUrl);
    u.search = new URLSearchParams({
      response_type: 'token',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      bth_ignore_origin: 'true',
      access_mode: 'anonymous',
    }).toString();

    const r = await this.transporte(u, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    if (r.status !== 303) throw new Error(`OAuth: HTTP ${r.status}`);

    const loc = r.headers.get('location');
    if (!loc) throw new Error('OAuth: resposta sem Location');
    const destino = new URL(loc);
    const esperado = new URL(redirectUri);
    if (destino.origin !== esperado.origin || destino.pathname !== esperado.pathname) {
      throw new Error('OAuth: destino de redirecionamento inesperado');
    }

    const hash = new URLSearchParams(destino.hash.slice(1));
    const token = hash.get('access_token');
    const expiresIn = Number(hash.get('expires_in'));
    if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new Error('OAuth: credencial inválida na resposta');
    }

    this.#token = token;
    this.#expiraEm = this.agora() + expiresIn * 1000;
    return token;
  }
}
