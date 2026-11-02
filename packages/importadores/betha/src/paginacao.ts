// Leitura paginada de uma consulta. No exercício corrente o índice muda entre
// requisições e a paginação por offset pode repetir ou pular registros: repete a
// leitura inteira algumas vezes antes de entregar uma coleta inconsistente.
export type Hit = { id: string; sourceAsMap: Record<string, unknown> };
export type Pagina = { totalHits: number; hits: Hit[] };
export type Leitura = Pagina & { erros: string[] };

export interface ClienteDePaginacao {
  buscar(consulta: number, filtro: unknown, pagina: { offset: number; limit: number }): Promise<Pagina>;
}

type Opcoes = { limite: number; pausaMs: number; esperar: (ms: number) => Promise<void> };

const TENTATIVAS = 3;

async function lerPaginas(cliente: ClienteDePaginacao, consulta: number, filtro: unknown, opcoes: Opcoes) {
  const primeira = await cliente.buscar(consulta, filtro, { offset: 0, limit: opcoes.limite });
  const totalHits = primeira.totalHits;
  const hits = [...primeira.hits];
  const erros: string[] = [];

  while (hits.length < totalHits) {
    await opcoes.esperar(opcoes.pausaMs);
    const pagina = await cliente.buscar(consulta, filtro, { offset: hits.length, limit: opcoes.limite });
    if (pagina.totalHits !== totalHits) {
      erros.push(`totalHits mudou durante a coleta (${totalHits} → ${pagina.totalHits})`);
      break;
    }
    if (pagina.hits.length === 0) break;
    hits.push(...pagina.hits);
  }
  return { totalHits, hits, erros };
}

const consistente = ({ totalHits, hits, erros }: Leitura) =>
  erros.length === 0 && hits.length === totalHits && new Set(hits.map((h) => h.id)).size === totalHits;

export async function paginar(
  cliente: ClienteDePaginacao,
  consulta: number,
  filtro: unknown,
  opcoes: Opcoes,
): Promise<Leitura> {
  let leitura = await lerPaginas(cliente, consulta, filtro, opcoes);
  for (let tentativa = 1; tentativa < TENTATIVAS && !consistente(leitura); tentativa++) {
    await opcoes.esperar(2000 * tentativa);
    leitura = await lerPaginas(cliente, consulta, filtro, opcoes);
  }
  return leitura;
}
