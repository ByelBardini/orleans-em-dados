// Banco de teste com as cinco coletas fictícias publicadas, pelo mesmo caminho da produção.
import { pool } from '@orleans-em-dados/db';
import { criarImportadorBetha } from '@orleans-em-dados/importador-betha';
import { criarImportadoresDeEducacao } from '@orleans-em-dados/importador-educacao';
import { criarImportadorIbge } from '@orleans-em-dados/importador-ibge';
import {
  gravarSnapshot,
  RepositorioDeLotesPostgres,
  type Importador,
  type Snapshot,
} from '@orleans-em-dados/importador-nucleo';
import { criarImportadorSiconfi } from '@orleans-em-dados/importador-siconfi';
import { criarImportadorTcesc } from '@orleans-em-dados/importador-tcesc';
import { EDUCACAO, type CenarioDeEducacao, type ChaveDeEducacao } from './educacao';
import {
  despesas,
  empenhos,
  ibgeCenso,
  ibgeComparacao,
  ibgeEducacaoCenso,
  ibgeEducacaoComparacao,
  ibgePib,
  ibgePopulacao,
  ibgeRedeEscolar,
  receitas,
  siconfiFuncoes,
  siconfiIndices,
  tcescEmpenhos,
  tcescReceitas,
} from './snapshots';

// Apaga coletas e tudo que depende delas; o catálogo (fontes, consultas, entidades) fica.
export async function limparColetas(): Promise<void> {
  await pool.query('TRUNCATE coletas RESTART IDENTITY CASCADE');
}

const betha = criarImportadorBetha({
  cliente: { buscar: async () => ({ totalHits: 0, hits: [] }), totalizadores: async () => [] },
});
const tcesc = criarImportadorTcesc({
  abrirSessao: async () => {
    throw new Error('o banco de teste não coleta');
  },
});
const ibge = criarImportadorIbge({
  cliente: {
    agregado: async () => {
      throw new Error('o banco de teste não coleta');
    },
  },
});
const siconfi = criarImportadorSiconfi({ cliente: { anexo: async () => [], rreo: async () => [] } });

const consulta = (importador: Importador, chave: string) => {
  const achada = importador.consultas.find((c) => c.chave === chave);
  if (!achada) throw new Error(`${importador.id} não tem a consulta ${chave}`);
  return achada;
};

type Lotes = {
  receitas: Snapshot;
  empenhos: Snapshot;
  despesas: Snapshot;
  tcescReceitas: Snapshot;
  tcescEmpenhos: Snapshot;
  /** `null` deixa a fonte sem coleta; a DCA é um lote por exercício. */
  ibgePopulacao: Snapshot | null;
  ibgeCenso: Snapshot | null;
  ibgePib: Snapshot | null;
  ibgeComparacao: Snapshot | null;
  ibgeEducacaoCenso: Snapshot | null;
  ibgeEducacaoComparacao: Snapshot | null;
  ibgeRedeEscolar: Snapshot | null;
  /** Sem lote por padrão: só o cenário que corrige pela inflação pede (`ibgeIpca()`). */
  ibgeIpca: Snapshot | null;
  siconfiFuncoes: Snapshot[];
  /** Um lote por exercício, como a DCA. */
  siconfiIndices: Snapshot[];
  /** Por consulta de educação; `null` deixa aquela fonte sem coleta. */
  educacao: CenarioDeEducacao;
};

/** Banco só com as coletas fictícias; o que o cenário não informar vem do conjunto padrão. */
export async function popularCenario(cenario: Partial<Lotes> = {}): Promise<void> {
  await limparColetas();
  const repositorio = new RepositorioDeLotesPostgres();
  const lotes = [
    [consulta(betha, 'receitas'), cenario.receitas ?? receitas()],
    [consulta(betha, 'empenhos'), cenario.empenhos ?? empenhos()],
    [consulta(betha, 'despesas'), cenario.despesas ?? despesas()],
    [consulta(tcesc, 'receitas'), cenario.tcescReceitas ?? tcescReceitas()],
    [consulta(tcesc, 'empenhos'), cenario.tcescEmpenhos ?? tcescEmpenhos()],
    [consulta(ibge, 'ibge_populacao'), cenario.ibgePopulacao === undefined ? ibgePopulacao() : cenario.ibgePopulacao],
    [consulta(ibge, 'ibge_censo'), cenario.ibgeCenso === undefined ? ibgeCenso() : cenario.ibgeCenso],
    [consulta(ibge, 'ibge_pib'), cenario.ibgePib === undefined ? ibgePib() : cenario.ibgePib],
    ...(cenario.siconfiFuncoes ?? [siconfiFuncoes()]).map((s) => [consulta(siconfi, 'siconfi_funcoes'), s] as const),
    [
      consulta(ibge, 'ibge_comparacao'),
      cenario.ibgeComparacao === undefined ? ibgeComparacao() : cenario.ibgeComparacao,
    ],
    [
      consulta(ibge, 'ibge_educacao_censo'),
      cenario.ibgeEducacaoCenso === undefined ? ibgeEducacaoCenso() : cenario.ibgeEducacaoCenso,
    ],
    [
      consulta(ibge, 'ibge_educacao_comparacao'),
      cenario.ibgeEducacaoComparacao === undefined ? ibgeEducacaoComparacao() : cenario.ibgeEducacaoComparacao,
    ],
    [
      consulta(ibge, 'ibge_rede_escolar'),
      cenario.ibgeRedeEscolar === undefined ? ibgeRedeEscolar() : cenario.ibgeRedeEscolar,
    ],
    // Por último: os ids das coletas anteriores não mudam nas gravações de paridade.
    ...(cenario.siconfiIndices ?? [siconfiIndices()]).map((s) => [consulta(siconfi, 'siconfi_indices'), s] as const),
  ] as const;
  for (const [alvo, snapshot] of lotes) {
    if (snapshot) await gravarSnapshot(alvo, snapshot, 'arquivo', repositorio);
  }
  const consultasDeEducacao = criarImportadoresDeEducacao().flatMap((i) => i.consultas);
  for (const [chave, padrao] of Object.entries(EDUCACAO) as [ChaveDeEducacao, () => Snapshot[]][]) {
    const alvo = consultasDeEducacao.find((c) => c.chave === chave);
    if (!alvo) throw new Error(`Nenhum importador conhece a consulta ${chave}`);
    const trocados = cenario.educacao?.[chave];
    for (const snapshot of trocados === undefined ? padrao() : (trocados ?? [])) {
      await gravarSnapshot(alvo, snapshot, 'arquivo', repositorio);
    }
  }
  // Depois de tudo: os ids das outras coletas não mudam.
  if (cenario.ibgeIpca) await gravarSnapshot(consulta(ibge, 'ibge_ipca'), cenario.ibgeIpca, 'arquivo', repositorio);
}

export const popularBancoDeTeste = () => popularCenario();
