// Conferência Betha × TCE-SC sobre as coletas publicadas de um exercício.
// Usada pela API (/api/conferencias) e pelo script `pnpm conferir`.
import { ehParcial, montarConferencia } from './conferencia.bo';
import {
  CONSULTAS_NECESSARIAS,
  lerColetas,
  lerDados,
  lerDivergenciasEmOutrosAnos,
  lerLimites,
} from './conferencia.dao';

export { empenhosForaDaSoma } from './conferencia.bo';

export async function conferencia(ano: number, agora = new Date()) {
  const coletas = await lerColetas(ano);
  const faltando = CONSULTAS_NECESSARIAS.filter((chave) => !coletas.some((c) => c.chave === chave));
  if (faltando.length) return { ano, disponivel: false as const, faltando, coletas };

  const limites = await lerLimites(ano);
  // No exercício parcial, compara só até onde o TCE-SC já recebeu dados.
  const dataLimite = ehParcial(limites) ? limites.dataEmpenho : null;
  const [dados, outrosAnos] = await Promise.all([
    lerDados(ano, limites.mesReceita, dataLimite),
    lerDivergenciasEmOutrosAnos(ano),
  ]);
  return montarConferencia(ano, { coletas, limites, ...dados, outrosAnos }, agora);
}
