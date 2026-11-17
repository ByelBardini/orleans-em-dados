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
  CONSULTAS_DA_DESPESA,
  CONSULTAS_DA_RECEITA,
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

const faltandoEm = (necessarias: readonly string[], coletas: readonly { chave: string }[]) =>
  necessarias.filter((chave) => !coletas.some((c) => c.chave === chave));

type AreaIndisponivel = { disponivel: false; faltando: string[] };

/**
 * Receita e despesa conferidas cada uma com as próprias coletas: o Farol do TCE-SC tem receitas desde 2018 e
 * empenhos só desde 2023. Área sem as coletas dela diz o que falta, e a outra segue. `discrepancias` é a lista
 * das áreas disponíveis, ordenada e cruzada com as conferências manuais; cada área traz a sua parte.
 */
export async function conferenciaPorArea(ano: number) {
  const coletas = await lerColetas(ano);
  const faltaReceita = faltandoEm(CONSULTAS_DA_RECEITA, coletas);
  const faltaDespesa = faltandoEm(CONSULTAS_DA_DESPESA, coletas);
  const indisponivel = (faltando: string[]): AreaIndisponivel => ({ disponivel: false, faltando });
  // Só importa a quem não tem conferência: a coleta de exemplo mantém os números fictícios.
  const exemplo = faltaReceita.length || faltaDespesa.length ? await temColetaDeExemplo(ano) : false;
  if (faltaReceita.length && faltaDespesa.length) {
    return {
      ano,
      exemplo,
      parcial: null,
      limites: null,
      receita: indisponivel(faltaReceita),
      despesa: indisponivel(faltaDespesa),
      discrepancias: [],
      avisos: [],
    };
  }

  const limites = await lerLimites(ano);
  const parcial = ehParcial(limites);
  const corte = parcial ? limites.dataEmpenho : null;
  const comReceita = !faltaReceita.length;
  const comDespesa = !faltaDespesa.length;
  const [dadosDaReceita, outrosAnos, dadosDaDespesa, empenhosSemPar] = await Promise.all([
    comReceita ? lerReceitaConferida(ano, limites.mesReceita) : null,
    comReceita ? lerDivergenciasEmOutrosAnos(ano) : null,
    comDespesa ? lerDespesaConferida(ano, limites.dataEmpenho) : null,
    comDespesa ? lerEmpenhosParaClassificar(ano, corte) : null,
  ]);
  const daReceita =
    dadosDaReceita && outrosAnos
      ? montarReceitaConferida(ano, limites.mesReceita, { ...dadosDaReceita, outrosAnos })
      : null;
  const daDespesa = dadosDaDespesa ? montarDespesaConferida(parcial, limites, dadosDaDespesa) : null;
  // `avisos` é interno, para quem mantém os registros: não é conteúdo da seção pública.
  const { discrepancias, avisos } = cruzarConferenciasManuais(
    ano,
    ordenarDiscrepancias([
      ...(daReceita?.discrepancias ?? []),
      ...(daDespesa?.discrepancias ?? []),
      ...(empenhosSemPar ? discrepanciasDeEmpenhos(empenhosSemPar, { parcial, corte }) : []),
    ]),
  );
  const daArea = (...areas: string[]) => discrepancias.filter((d) => areas.includes(d.area));
  return {
    ano,
    exemplo,
    parcial,
    limites,
    receita: daReceita
      ? { disponivel: true as const, receita: daReceita.receita, discrepancias: daArea('receita') }
      : indisponivel(faltaReceita),
    despesa: daDespesa
      ? { disponivel: true as const, despesa: daDespesa.despesa, discrepancias: daArea('despesa', 'empenho') }
      : indisponivel(faltaDespesa),
    discrepancias,
    avisos,
  };
}

/** Só o que as duas fontes sustentam, com o que ficou de fora e por quê. A resposta de
 *  `conferencia(ano)` continua sendo a comparação; esta é a base das páginas. Exige as cinco coletas:
 *  para uma área só, `conferenciaPorArea`. */
export async function dadosConferidos(ano: number) {
  const coletas = await lerColetas(ano);
  const faltando = faltandoEm(CONSULTAS_NECESSARIAS, coletas);
  if (faltando.length) {
    return { ano, disponivel: false as const, faltando, exemplo: await temColetaDeExemplo(ano) };
  }
  const { parcial, limites, receita, despesa, discrepancias, avisos } = await conferenciaPorArea(ano);
  if (!receita.disponivel || !despesa.disponivel || !limites || parcial === null) {
    throw new Error(`Conferência de ${ano} sem uma das áreas, com as cinco coletas publicadas`);
  }
  return {
    ano,
    disponivel: true as const,
    parcial,
    limites,
    receita: receita.receita,
    despesa: despesa.despesa,
    discrepancias,
    avisos,
  };
}

/** Os empenhos casados 1:1 com o TCE-SC, com a execução do TCE-SC de cada um. No ano em curso,
 *  só até o corte. É o conjunto que a lista de empenhos publica: `id` é o `id_externo` da Betha. */
export async function empenhosConferidos(ano: number) {
  const coletas = await lerColetas(ano);
  const faltando = faltandoEm(CONSULTAS_DA_DESPESA, coletas);
  if (faltando.length) {
    return { ano, disponivel: false as const, faltando, exemplo: await temColetaDeExemplo(ano) };
  }
  const limites = await lerLimites(ano);
  const parcial = ehParcial(limites);
  const dataCorte = parcial ? limites.dataEmpenho : null;
  return { ano, disponivel: true as const, parcial, dataCorte, empenhos: await lerEmpenhosConferidos(ano, dataCorte) };
}
