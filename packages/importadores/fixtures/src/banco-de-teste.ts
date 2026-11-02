// Banco de teste com as cinco coletas fictícias publicadas, pelo mesmo caminho da produção.
import { pool } from '@orleans-em-dados/db';
import { criarImportadorBetha } from '@orleans-em-dados/importador-betha';
import { gravarSnapshot, RepositorioDeLotesPostgres, type Importador } from '@orleans-em-dados/importador-nucleo';
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

export async function popularBancoDeTeste(): Promise<void> {
  await limparColetas();
  const repositorio = new RepositorioDeLotesPostgres();
  const lotes = [
    [consulta(betha, 'receitas'), receitas()],
    [consulta(betha, 'empenhos'), empenhos()],
    [consulta(betha, 'despesas'), despesas()],
    [consulta(tcesc, 'receitas'), tcescReceitas()],
    [consulta(tcesc, 'empenhos'), tcescEmpenhos()],
  ] as const;
  for (const [alvo, snapshot] of lotes) await gravarSnapshot(alvo, snapshot, 'arquivo', repositorio);
}
