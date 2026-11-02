// Banco de teste com as cinco coletas fictícias publicadas, pela mesma
// gravarColeta que os coletores usam.
import { pool } from '@orleans-em-dados/db';
import { gravarColeta } from '../../gravar.js';
import { TODOS } from './snapshots.js';

// Apaga coletas e tudo que depende delas; o catálogo (fontes, consultas, entidades) fica.
export async function limparColetas() {
  await pool.query('TRUNCATE coletas RESTART IDENTITY CASCADE');
}

export async function popularBancoDeTeste() {
  await limparColetas();
  for (const montar of TODOS) await gravarColeta(montar(), 'arquivo');
}
