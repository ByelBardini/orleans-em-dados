import { BETHA, esperarDeVerdade, type TransporteHttp } from './config';
import type { Pagina } from './paginacao';

const MAX_TENTATIVAS = 4;

export interface AutenticadorBetha {
  getToken(): Promise<string>;
  invalidar(): void;
}

export class BethaQueryClient {
  constructor(
    private readonly auth: AutenticadorBetha,
    private readonly transporte: TransporteHttp = fetch,
    private readonly esperar: (ms: number) => Promise<void> = esperarDeVerdade,
  ) {}

  buscar(consultaId: number, filtro: unknown, { offset = 0, limit = 100 } = {}): Promise<Pagina> {
    // Sem ordenação explícita a paginação é instável: em 2026 a 57153 devolveu
    // 1.294 registros com só 1.017 IDs únicos. Ordenar por id resolve.
    const qs = new URLSearchParams({
      sortBy: 'id',
      sortDirection: 'asc',
      offset: String(offset),
      limit: String(limit),
      hiperlink: 'false',
    });
    return this.#post<Pagina>(`/transparencia/api/busca-textual/${consultaId}?${qs}`, filtro);
  }

  totalizadores(consultaId: number, filtro: unknown): Promise<unknown[]> {
    return this.#post<unknown[]>(`/transparencia/api/busca-textual/${consultaId}/totalizadores`, filtro);
  }

  // Em 401 renova o token uma única vez; em 429/5xx tenta novamente com espera exponencial.
  async #post<T>(caminho: string, corpo: unknown): Promise<T> {
    let renovou = false;
    for (let tentativa = 1; ; tentativa++) {
      const token = await this.auth.getToken();
      let r: Response;
      try {
        r = await this.transporte(`${BETHA.api}${caminho}`, {
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
        await this.esperar(1000 * 2 ** tentativa);
        continue;
      }
      if (r.ok) return r.json() as Promise<T>;
      if (r.status === 401 && !renovou) {
        renovou = true;
        this.auth.invalidar();
        continue;
      }
      if ((r.status === 429 || r.status >= 500) && tentativa < MAX_TENTATIVAS) {
        await this.esperar(1000 * 2 ** tentativa);
        continue;
      }
      throw new Error(`Betha: HTTP ${r.status} em ${caminho.split('?')[0]}`);
    }
  }
}
