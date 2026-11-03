import { pool } from '@orleans-em-dados/db';
import { executar, RepositorioDeLotesPostgres } from '@orleans-em-dados/importador-nucleo';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { criarImportadorSiconfi } from '../../src/importador';
import type { ItemDaDca } from '../../src/normalizar';
import { anexoCoerente, ClienteSiconfiFake } from '../support/dca';

const rodar = (itens: ItemDaDca[]) =>
  executar(criarImportadorSiconfi({ cliente: new ClienteSiconfiFake(itens) }), 2025, {
    repositorio: new RepositorioDeLotesPostgres(),
    relogio: () => new Date('2026-11-02T06:00:00.000Z'),
  });

const valorDaSaude = () =>
  pool.query(
    `SELECT valor FROM siconfi_funcoes_publicadas
     WHERE etapa = 'empenhado' AND tipo = 'funcao' AND funcao_codigo = '10'`,
  );

beforeEach(() => pool.query('TRUNCATE coletas, execucoes RESTART IDENTITY CASCADE'));
afterAll(() => pool.end());

describe('importador do SICONFI sobre o Postgres', () => {
  it('lote aprovado aparece na view, com o exercício e as cinco etapas', async () => {
    const resultado = await rodar(anexoCoerente());

    expect(resultado.status).toBe('sucesso');
    expect((await valorDaSaude()).rows).toEqual([{ valor: 200.25 }]);
    const { rows } = await pool.query(`SELECT DISTINCT ano, etapa FROM siconfi_funcoes_publicadas ORDER BY etapa`);
    expect(rows.map((r) => r.etapa)).toEqual([
      'empenhado',
      'liquidado',
      'pago',
      'rp_nao_processados',
      'rp_processados',
    ]);
    expect(rows[0].ano).toBe(2025);
  });

  it('soma diferente do total rejeita o lote e mantém a publicação anterior', async () => {
    await rodar(anexoCoerente());

    const resultado = await rodar(anexoCoerente({ total: 301 }));

    expect(resultado.status).toBe('rejeitada');
    expect((await valorDaSaude()).rows).toEqual([{ valor: 200.25 }]);
  });

  it('resposta vazia rejeita o lote e mantém a publicação anterior', async () => {
    await rodar(anexoCoerente());

    const resultado = await rodar([]);

    expect(resultado.status).toBe('rejeitada');
    expect((await valorDaSaude()).rows).toEqual([{ valor: 200.25 }]);
  });

  it('mesmo conteúdo em nova rodada fica sem_mudanca', async () => {
    await rodar(anexoCoerente());

    const resultado = await rodar(anexoCoerente());

    expect(resultado.consultas.map((c) => c.status)).toEqual(['sem_mudanca']);
  });
});
