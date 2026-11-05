// Conferência Betha × TCE-SC sobre as coletas publicadas de um exercício.
// Usada pela API (/api/conferencias) e pelo script `pnpm conferir`.
import {
  compararFuncoes,
  compararGastoEducacao,
  discrepanciasDeEmpenhos,
  ehParcial,
  montarConferencia,
  montarDespesaConferida,
  montarReceitaConferida,
  ordenarDiscrepancias,
} from './conferencia.bo';
import {
  CONSULTAS_NECESSARIAS,
  lerColetas,
  lerDados,
  lerDespesaConferida,
  lerDivergenciasEmOutrosAnos,
  lerEmpenhosConferidos,
  lerEmpenhosParaClassificar,
  lerGastoEducacaoNaBetha,
  lerGastoEducacaoNaDca,
  lerLimites,
  lerReceitaConferida,
  lerSomasDaDca,
  lerSomasDoTceParaFuncoes,
  temColetaDeExemplo,
} from './conferencia.dao';
import { cruzarConferenciasManuais } from './conferencias-manuais';

export type {
  ComparacaoDaEtapa,
  ComparacaoDeFuncoes,
  ConferenciaDeFuncoes,
  ConferenciaDoGastoEducacao,
  DespesaConferida,
  Discrepancia,
  EmpenhoConferido,
  EtapaDoGasto,
  LinhaNaturezaConferida,
  TipoDiscrepancia,
} from './conferencia.bo';
export { ACOES_DE_EDUCACAO } from './conferencia.bo';
export type { DiscrepanciaConferida, SituacaoDaDiscrepancia } from './conferencias-manuais';

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

/** O total da DCA sem a Legislativa, e a própria Legislativa, contra o TCE-SC. Não confere cada função. */
export async function conferirFuncoes(ano: number) {
  const [dca, tce] = await Promise.all([lerSomasDaDca(ano), lerSomasDoTceParaFuncoes(ano)]);
  return compararFuncoes(ano, dca, tce);
}

/** A função 12 da DCA contra a soma das ações de educação da Betha 57170, nas três etapas. Só esta função tem
 *  par na Betha: não confere as outras, nem cada ação. */
export async function conferirGastoEducacao(ano: number) {
  const [dca, betha] = await Promise.all([lerGastoEducacaoNaDca(ano), lerGastoEducacaoNaBetha(ano)]);
  return compararGastoEducacao(ano, dca, betha);
}

/** Só o que as duas fontes sustentam, com o que ficou de fora e por quê. A resposta de
 *  `conferencia(ano)` continua sendo a comparação; esta é a base das páginas. */
export async function dadosConferidos(ano: number) {
  const coletas = await lerColetas(ano);
  const faltando = CONSULTAS_NECESSARIAS.filter((chave) => !coletas.some((c) => c.chave === chave));
  if (faltando.length) {
    return { ano, disponivel: false as const, faltando, exemplo: await temColetaDeExemplo(ano) };
  }

  const limites = await lerLimites(ano);
  const parcial = ehParcial(limites);
  const corte = parcial ? limites.dataEmpenho : null;
  const [dadosDaReceita, outrosAnos, dadosDaDespesa, empenhosSemPar] = await Promise.all([
    lerReceitaConferida(ano, limites.mesReceita),
    lerDivergenciasEmOutrosAnos(ano),
    lerDespesaConferida(ano, limites.dataEmpenho),
    lerEmpenhosParaClassificar(ano, corte),
  ]);
  const { receita, discrepancias: daReceita } = montarReceitaConferida(ano, limites.mesReceita, {
    ...dadosDaReceita,
    outrosAnos,
  });
  const { despesa, discrepancias: daDespesa } = montarDespesaConferida(parcial, limites, dadosDaDespesa);
  // `avisos` é interno, para quem mantém os registros: não é conteúdo da seção pública.
  const { discrepancias, avisos } = cruzarConferenciasManuais(
    ano,
    ordenarDiscrepancias([...daReceita, ...daDespesa, ...discrepanciasDeEmpenhos(empenhosSemPar, { parcial, corte })]),
  );
  return {
    ano,
    disponivel: true as const,
    parcial,
    limites,
    receita,
    despesa,
    discrepancias,
    avisos,
  };
}

/** Os empenhos casados 1:1 com o TCE-SC, com a execução do TCE-SC de cada um. No ano em curso,
 *  só até o corte. É o conjunto que a lista de empenhos publica: `id` é o `id_externo` da Betha. */
export async function empenhosConferidos(ano: number) {
  const coletas = await lerColetas(ano);
  const faltando = CONSULTAS_NECESSARIAS.filter((chave) => !coletas.some((c) => c.chave === chave));
  if (faltando.length) {
    return { ano, disponivel: false as const, faltando, exemplo: await temColetaDeExemplo(ano) };
  }
  const limites = await lerLimites(ano);
  const parcial = ehParcial(limites);
  const dataCorte = parcial ? limites.dataEmpenho : null;
  return { ano, disponivel: true as const, parcial, dataCorte, empenhos: await lerEmpenhosConferidos(ano, dataCorte) };
}
