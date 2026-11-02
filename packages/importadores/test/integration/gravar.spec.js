import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '@orleans-em-dados/db';
import { gravarColeta } from '../../gravar.js';
import { limparColetas } from '../support/banco-de-teste.js';
import { empenhos, receitas, snapshot } from '../support/snapshots.js';

const publicada = async (consultaId) =>
  (await pool.query('SELECT coleta_id FROM publicacoes WHERE consulta_id = $1 AND ano = 2025', [consultaId])).rows[0]
    ?.coleta_id;

beforeEach(limparColetas);
afterAll(() => pool.end());

describe('gravarColeta — publicação', () => {
  it('coleta conciliada é gravada e passa a ser a publicada do ano', async () => {
    const { coletaId, publicada: foiPublicada } = await gravarColeta(receitas(), 'arquivo');

    expect(foiPublicada).toBe(true);
    expect(await publicada(57153)).toBe(coletaId);
  });

  it('coleta rejeitada é gravada, mas a publicação anterior continua', async () => {
    const { coletaId: anterior } = await gravarColeta(receitas(), 'arquivo');
    const rejeitada = snapshot(57153, receitas().registros, { status: 'rejeitado', erros: ['totalizador diverge'] });

    const { coletaId, publicada: foiPublicada } = await gravarColeta(rejeitada, 'api');

    expect(foiPublicada).toBe(false);
    expect(await publicada(57153)).toBe(anterior);
    const { rows } = await pool.query('SELECT status, erros FROM coletas WHERE id = $1', [coletaId]);
    expect(rows[0]).toEqual({ status: 'rejeitado', erros: ['totalizador diverge'] });
  });

  it('exemplo não substitui dado real já publicado', async () => {
    const { coletaId: real } = await gravarColeta(receitas(), 'arquivo');

    const { publicada: foiPublicada } = await gravarColeta(
      snapshot(57153, receitas().registros, { status: 'exemplo' }),
      'exemplo',
    );

    expect(foiPublicada).toBe(false);
    expect(await publicada(57153)).toBe(real);
  });

  it('exemplo é publicado quando o ano ainda não tem dado real', async () => {
    const { coletaId, publicada: foiPublicada } = await gravarColeta(
      snapshot(57153, receitas().registros, { status: 'exemplo' }),
      'exemplo',
    );

    expect(foiPublicada).toBe(true);
    expect(await publicada(57153)).toBe(coletaId);
  });

  it('coleta real substitui o exemplo publicado', async () => {
    await gravarColeta(snapshot(57153, receitas().registros, { status: 'exemplo' }), 'exemplo');

    const { coletaId } = await gravarColeta(receitas(), 'arquivo');

    expect(await publicada(57153)).toBe(coletaId);
  });
});

describe('gravarColeta — gravação', () => {
  it('registro com id repetido guarda a primeira ocorrência sem falhar', async () => {
    const [primeiro, segundo] = receitas().registros;
    const repetido = { ...segundo, id: primeiro.id };

    const { coletaId } = await gravarColeta(snapshot(57153, [primeiro, repetido], { status: 'rejeitado' }), 'api');

    const { rows } = await pool.query('SELECT id_externo, payload FROM registros_brutos WHERE coleta_id = $1', [
      coletaId,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.valorArrecadadoNoMes).toBe(300000);
  });

  it('consulta sem normalização definida é recusada citando o id', async () => {
    await expect(gravarColeta(snapshot(12345, []), 'api')).rejects.toThrow('Consulta 12345 sem normalização definida');
  });

  it('receita normalizada guarda mês do sufixo, rubrica em texto e negativo exato', async () => {
    const { coletaId } = await gravarColeta(receitas(), 'arquivo');

    const { rows } = await pool.query(
      `SELECT entidade_codigo, mes, rubrica, valor_arrecadado_mes FROM receitas
       WHERE coleta_id = $1 AND id_externo = '211:728:102_2'`,
      [coletaId],
    );
    expect(rows[0]).toEqual({
      entidade_codigo: '728',
      mes: 2,
      rubrica: '17115101000000',
      valor_arrecadado_mes: -5000.25,
    });
  });

  it('empenho sem liquidação fica com liquidado e pago nulos, não zero', async () => {
    const { coletaId } = await gravarColeta(empenhos(), 'arquivo');

    const { rows } = await pool.query(
      `SELECT valor_liquidado, valor_pago FROM empenhos WHERE coleta_id = $1 AND id_externo = '211:319:2001'`,
      [coletaId],
    );
    expect(rows[0]).toEqual({ valor_liquidado: null, valor_pago: null });
  });
});
