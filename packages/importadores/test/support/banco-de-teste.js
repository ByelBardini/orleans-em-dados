// Banco de teste com as cinco coletas fictícias publicadas, pelos mesmos caminhos da produção.
import { pool } from '@orleans-em-dados/db';
import { criarImportadorBetha } from '@orleans-em-dados/importador-betha';
import { gravarSnapshot, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { gravarColeta } from '../../gravar.js';
import { despesas, empenhos, receitas, tcescEmpenhos, tcescReceitas } from './snapshots.js';

// Apaga coletas e tudo que depende delas; o catálogo (fontes, consultas, entidades) fica.
export async function limparColetas() {
  await pool.query('TRUNCATE coletas RESTART IDENTITY CASCADE');
}

export async function popularBancoDeTeste() {
  await limparColetas();
  const repositorio = new RepositorioDeLotesPostgres();
  const betha = criarImportadorBetha({
    cliente: { buscar: async () => ({ totalHits: 0, hits: [] }), totalizadores: async () => [] },
  });
  for (const [chave, montar] of [
    ['receitas', receitas],
    ['empenhos', empenhos],
    ['despesas', despesas],
  ]) {
    await gravarSnapshot(
      betha.consultas.find((c) => c.chave === chave),
      montar(),
      'arquivo',
      repositorio,
    );
  }
  await gravarColeta(tcescReceitas(), 'arquivo');
  await gravarColeta(tcescEmpenhos(), 'arquivo');
}
