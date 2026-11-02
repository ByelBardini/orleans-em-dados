// Empenhos Betha que a conferência aponta como versões antigas de empenhos renumerados
// ou registros repetidos: saem das somas. Cache curto por ano, porque a conferência
// roda várias consultas.
import { empenhosForaDaSoma } from '@orleans-em-dados/db/conferencias';

type EmpenhosSemPar = Parameters<typeof empenhosForaDaSoma>[0];

export type ConferenciaParaExclusoes = { disponivel: boolean; empenhosSemPar?: EmpenhosSemPar };

const CACHE_MS = 5 * 60_000;

export function criarExclusoes(
  conferir: (ano: number) => Promise<ConferenciaParaExclusoes>,
  agora: () => number = Date.now,
): (ano: number) => Promise<string[]> {
  const cache = new Map<number, { em: number; ids: string[] }>();
  return async (ano) => {
    const guardado = cache.get(ano);
    if (guardado && agora() - guardado.em < CACHE_MS) return guardado.ids;
    const conferencia = await conferir(ano);
    const ids = conferencia.disponivel ? empenhosForaDaSoma(conferencia.empenhosSemPar ?? []) : [];
    cache.set(ano, { em: agora(), ids });
    return ids;
  };
}
