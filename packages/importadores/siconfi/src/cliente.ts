import { esperarDeVerdade, SICONFI, type TransporteHttp } from './config';
import type { ItemDaDca } from './normalizar';

const MAX_TENTATIVAS = 4;

type PaginaOrds = { items: ItemDaDca[]; hasMore: boolean };

export interface ClienteSiconfi {
  anexo(ano: number): Promise<ItemDaDca[]>;
}

export class SiconfiClienteHttp implements ClienteSiconfi {
  constructor(
    private readonly transporte: TransporteHttp = fetch,
    private readonly esperar: (ms: number) => Promise<void> = esperarDeVerdade,
  ) {}

  // Paginação ORDS: segue `hasMore`, com o offset no que já chegou.
  async anexo(ano: number): Promise<ItemDaDca[]> {
    const itens: ItemDaDca[] = [];
    for (;;) {
      const qs = new URLSearchParams({
        an_exercicio: String(ano),
        no_anexo: SICONFI.anexo,
        id_ente: SICONFI.ente,
        offset: String(itens.length),
      });
      const pagina = await this.#get(`${SICONFI.api}?${qs}`);
      itens.push(...pagina.items);
      if (!pagina.hasMore) return itens;
      if (!pagina.items.length) throw new Error(`SICONFI: página vazia com hasMore no offset ${itens.length}`);
    }
  }

  // Em 429/5xx e erro de rede, tenta novamente com espera exponencial; o resto é definitivo.
  async #get(url: string): Promise<PaginaOrds> {
    for (let tentativa = 1; ; tentativa++) {
      let r: Response;
      try {
        r = await this.transporte(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(60_000),
        });
      } catch (err) {
        if (tentativa >= MAX_TENTATIVAS) throw err;
        await this.esperar(1000 * 2 ** tentativa);
        continue;
      }
      if (r.ok) return r.json() as Promise<PaginaOrds>;
      if ((r.status === 429 || r.status >= 500) && tentativa < MAX_TENTATIVAS) {
        await this.esperar(1000 * 2 ** tentativa);
        continue;
      }
      throw new Error(`SICONFI: HTTP ${r.status} em ${url.split('?')[0]}`);
    }
  }
}
