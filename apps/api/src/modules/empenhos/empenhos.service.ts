// Qual conjunto de empenhos o ano publica: o casado com o TCE-SC. Coleta de exemplo fica inteira; no
// ano que o TCE-SC não publica, a 57140 inteira é a fonte única. Ano real em que só falta coletar o
// TCE-SC não tem nenhum empenho.
import { foraDaFonte } from '@orleans-em-dados/contracts';
import { empenhosConferidos } from '@orleans-em-dados/db/conferencias';
import type { ColetaPublicada } from '../coletas/coletas.dao';
import { conjuntoConferido, conjuntoDaBetha } from './empenhos.dao';

export async function conjuntoDoAno(coleta: ColetaPublicada, ano: number) {
  const conferidos = await empenhosConferidos(ano);
  if (conferidos.disponivel) {
    const { parcial, dataCorte, empenhos } = conferidos;
    return {
      conjunto: conjuntoConferido(empenhos, ano),
      conferencia: { disponivel: true, parcial, dataCorte, fonteUnica: false },
    };
  }
  const { faltando } = conferidos;
  const fora = foraDaFonte(faltando, ano);
  const fonteUnica = !coleta.meta.exemplo && faltando.length > 0 && faltando.every((c) => fora.includes(c));
  const conferencia = {
    disponivel: false,
    parcial: null,
    dataCorte: null,
    faltando,
    ...(fora.length ? { foraDaFonte: fora } : {}),
    fonteUnica,
  };
  if ((conferidos.exemplo && coleta.meta.exemplo) || fonteUnica) return { conjunto: conjuntoDaBetha(), conferencia };
  return { conjunto: conjuntoConferido([], ano), conferencia };
}
