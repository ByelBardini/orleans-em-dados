// Qual conjunto de empenhos o ano publica: o casado com o TCE-SC. Coleta de exemplo fica inteira,
// e ano real sem as coletas do TCE-SC não tem nenhum empenho conferido.
import { foraDaFonte } from '@orleans-em-dados/contracts';
import { empenhosConferidos } from '@orleans-em-dados/db/conferencias';
import type { ColetaPublicada } from '../coletas/coletas.dao';
import { conjuntoConferido, conjuntoDeExemplo } from './empenhos.dao';

export async function conjuntoDoAno(coleta: ColetaPublicada, ano: number) {
  const conferidos = await empenhosConferidos(ano);
  if (conferidos.disponivel) {
    const { parcial, dataCorte, empenhos } = conferidos;
    return { conjunto: conjuntoConferido(empenhos, ano), conferencia: { disponivel: true, parcial, dataCorte } };
  }
  const fora = foraDaFonte(conferidos.faltando, ano);
  const conferencia = {
    disponivel: false,
    parcial: null,
    dataCorte: null,
    faltando: conferidos.faltando,
    ...(fora.length ? { foraDaFonte: fora } : {}),
  };
  if (conferidos.exemplo && coleta.meta.exemplo) return { conjunto: conjuntoDeExemplo(), conferencia };
  return { conjunto: conjuntoConferido([], ano), conferencia };
}
