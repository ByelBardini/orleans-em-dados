import { esperarDeVerdade, SICONFI, SICONFI_RREO, type TransporteHttp } from './config';
import type { ItemDaDca, ItemDoRreo } from './normalizar';

const MAX_TENTATIVAS = 4;

type PaginaOrds<Item> = { items: Item[]; hasMore: boolean };

export interface ClienteSiconfi {
  anexo(ano: number): Promise<ItemDaDca[]>;
  rreo(ano: number): Promise<ItemDoRreo[]>;
}

export class SiconfiClienteHttp implements ClienteSiconfi {
  constructor(
    private readonly transporte: TransporteHttp = fetch,
    private readonly esperar: (ms: number) => Promise<void> = esperarDeVerdade,
  ) {}

  anexo(ano: number): Promise<ItemDaDca[]> {
    return this.#itens(SICONFI.api, {
      an_exercicio: String(ano),
      no_anexo: SICONFI.anexo,
      id_ente: SICONFI.ente,
    });
  }

  rreo(ano: number): Promise<ItemDoRreo[]> {
    return this.#itens(SICONFI_RREO.api, {
      an_exercicio: String(ano),
      nr_periodo: String(SICONFI_RREO.periodo),
      co_tipo_demonstrativo: SICONFI_RREO.demonstrativo,
      no_anexo: SICONFI_RREO.anexo,
      id_ente: SICONFI.ente,
    });
  }

  // Paginação ORDS: segue `hasMore`, com o offset no que já chegou.
  async #itens<Item>(api: string, parametros: Record<string, string>): Promise<Item[]> {
    const itens: Item[] = [];
    for (;;) {
      const qs = new URLSearchParams({ ...parametros, offset: String(itens.length) });
      const pagina = await this.#get<Item>(`${api}?${qs}`);
      itens.push(...pagina.items);
      if (!pagina.hasMore) return itens;
      if (!pagina.items.length) throw new Error(`SICONFI: página vazia com hasMore no offset ${itens.length}`);
    }
  }

  // Em 429/5xx e erro de rede, tenta novamente com espera exponencial; o resto é definitivo.
  async #get<Item>(url: string): Promise<PaginaOrds<Item>> {
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
      if (r.ok) return r.json() as Promise<PaginaOrds<Item>>;
      if ((r.status === 429 || r.status >= 500) && tentativa < MAX_TENTATIVAS) {
        await this.esperar(1000 * 2 ** tentativa);
        continue;
      }
      throw new Error(`SICONFI: HTTP ${r.status} em ${url.split('?')[0]}`);
    }
  }
}
