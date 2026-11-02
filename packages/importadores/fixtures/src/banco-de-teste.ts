// Banco de teste com as cinco coletas fictícias publicadas, pelo mesmo caminho da produção.
import { pool } from '@orleans-em-dados/db';
import { criarImportadorBetha } from '@orleans-em-dados/importador-betha';
import {
  gravarSnapshot,
  RepositorioDeLotesPostgres,
  type Importador,
  type Snapshot,
} from '@orleans-em-dados/importador-nucleo';
import { criarImportadorTcesc } from '@orleans-em-dados/importador-tcesc';
import { despesas, empenhos, receitas, tcescEmpenhos, tcescReceitas } from './snapshots';

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
  ] as const;
  for (const [alvo, snapshot] of lotes) await gravarSnapshot(alvo, snapshot, 'arquivo', repositorio);
}

export const popularBancoDeTeste = () => popularCenario();
