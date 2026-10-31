import { BETHA } from './config.js';

const MAX_TENTATIVAS = 4;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export class BethaQueryClient {
  constructor(auth) {
    this.auth = auth;
  }

  buscar(consultaId, filtro, { offset = 0, limit = 100 } = {}) {
    const qs = new URLSearchParams({
      sortBy: 'null',
      sortDirection: 'null',
      offset: String(offset),
      limit: String(limit),
      hiperlink: 'false',
    });
    return this.#post(`/transparencia/api/busca-textual/${consultaId}?${qs}`, filtro);
  }

  totalizadores(consultaId, filtro) {
    return this.#post(`/transparencia/api/busca-textual/${consultaId}/totalizadores`, filtro);
  }

  // Em 401 renova o token uma única vez; em 429/5xx tenta novamente com espera exponencial.
  async #post(caminho, corpo) {
    let renovou = false;
    for (let tentativa = 1; ; tentativa++) {
      const token = await this.auth.getToken();
      let r;
      try {
        r = await fetch(`${BETHA.api}${caminho}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'app-context': BETHA.appContext,
            'Content-Type': 'application/json;charset=UTF-8',
            Accept: 'application/json',
          },
          body: JSON.stringify(corpo),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        if (tentativa >= MAX_TENTATIVAS) throw err;
        await esperar(1000 * 2 ** tentativa);
        continue;
      }

      if (r.ok) return r.json();

      if (r.status === 401 && !renovou) {
        renovou = true;
        this.auth.invalidar();
        continue;
      }
      if ((r.status === 429 || r.status >= 500) && tentativa < MAX_TENTATIVAS) {
        await esperar(1000 * 2 ** tentativa);
        continue;
      }
      throw new Error(`Betha: HTTP ${r.status} em ${caminho.split('?')[0]}`);
    }
  }
}
