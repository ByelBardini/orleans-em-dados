// Banco de teste com as cinco coletas fictícias publicadas, pelo mesmo caminho da produção.
import { pool } from '@orleans-em-dados/db';
import { criarImportadorBetha } from '@orleans-em-dados/importador-betha';
import { gravarSnapshot, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { criarImportadorTcesc } from '@orleans-em-dados/importador-tcesc';
import { despesas, empenhos, receitas, tcescEmpenhos, tcescReceitas } from './snapshots.js';

// Apaga coletas e tudo que depende delas; o catálogo (fontes, consultas, entidades) fica.
export async function limparColetas() {
  await pool.query('TRUNCATE coletas RESTART IDENTITY CASCADE');
}

const SEM_REDE = {
  betha: criarImportadorBetha({
    cliente: { buscar: async () => ({ totalHits: 0, hits: [] }), totalizadores: async () => [] },
  }),
  tcesc: criarImportadorTcesc({
    abrirSessao: async () => {
      throw new Error('o banco de teste não coleta');
    },
  }),
};

export async function popularBancoDeTeste() {
  await limparColetas();
  const repositorio = new RepositorioDeLotesPostgres();
  for (const [importador, chave, montar] of [
    [SEM_REDE.betha, 'receitas', receitas],
    [SEM_REDE.betha, 'empenhos', empenhos],
    [SEM_REDE.betha, 'despesas', despesas],
    [SEM_REDE.tcesc, 'receitas', tcescReceitas],
    [SEM_REDE.tcesc, 'empenhos', tcescEmpenhos],
  ]) {
    const consulta = importador.consultas.find((c) => c.chave === chave);
    await gravarSnapshot(consulta, montar(), 'arquivo', repositorio);
  }
}
