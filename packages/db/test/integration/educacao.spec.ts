import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/index';

const RENDIMENTO = 900301;
const ANEXO_8 = 900402;

async function novaColeta(consultaId: number, ano: number): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO coletas (consulta_id, ano, filtro, iniciado_em, finalizado_em, origem, status,
                          total_hits, capturados, ids_unicos, hash_payload)
     VALUES ($1, $2, '{}', now(), now(), 'arquivo', 'totalizador_conciliado', 1, 1, 1, 'hash')
     RETURNING id`,
    [consultaId, ano],
  );
  return rows[0].id;
}

const publicar = (consultaId: number, ano: number, coletaId: number) =>
  pool.query(
    `INSERT INTO publicacoes (consulta_id, ano, coleta_id) VALUES ($1, $2, $3)
     ON CONFLICT (consulta_id, ano) DO UPDATE SET coleta_id = EXCLUDED.coleta_id`,
    [consultaId, ano, coletaId],
  );

function inserirValor(
  coletaId: number,
  { rede = 'publica', valor = '6.1' as string | null, texto = null as string | null } = {},
) {
  return pool.query(
    `INSERT INTO educacao_valores (coleta_id, id_externo, ano, periodo, indicador, lugar, rede, etapa, recorte, valor, texto, unidade)
     VALUES ($1, 'abandono:medio', 2025, '2025', 'abandono', '4211702', $2, 'medio', '', $3, $4, '%')`,
    [coletaId, rede, valor, texto],
  );
}

function inserirFinanca(coletaId: number, { valor = '1234.56' as string | null, rede = 'municipal' } = {}) {
  return pool.query(
    `INSERT INTO educacao_financas (coleta_id, id_externo, ano, periodo, indicador, lugar, rede, recorte, valor, percentual)
     VALUES ($1, 'indice_educacao', 2025, '2025', 'indice_educacao', '4211702', $2, '', $3, 25.5)`,
    [coletaId, rede, valor],
  );
}

beforeEach(async () => {
  await pool.query(`TRUNCATE publicacoes, coletas CASCADE`);
});

afterAll(() => pool.end());

describe('catálogo das fontes de educação', () => {
  it('INEP, SIOPE e MEC usam o id do importador como id da fonte', async () => {
    const { rows } = await pool.query(`SELECT id FROM fontes WHERE id IN ('inep', 'siope', 'mec') ORDER BY id`);

    expect(rows.map((f) => f.id)).toEqual(['inep', 'mec', 'siope']);
  });

  it.each([
    [900105, 'ibge', 'ibge_educacao_censo'],
    [900106, 'ibge', 'ibge_educacao_comparacao'],
    [900107, 'ibge', 'ibge_rede_escolar'],
    [900202, 'siconfi', 'siconfi_indices'],
    [900301, 'inep', 'inep_rendimento'],
    [900302, 'inep', 'inep_transicao'],
    [900303, 'inep', 'inep_distorcao'],
    [900304, 'inep', 'inep_turmas'],
    [900305, 'inep', 'inep_horas'],
    [900306, 'inep', 'inep_docentes_superior'],
    [900307, 'inep', 'inep_adequacao'],
    [900308, 'inep', 'inep_regularidade'],
    [900309, 'inep', 'inep_esforco'],
    [900310, 'inep', 'inep_remuneracao'],
    [900311, 'inep', 'inep_inse'],
    [900312, 'inep', 'inep_alfabetizacao'],
    [900313, 'inep', 'inep_ideb'],
    [900314, 'inep', 'inep_enem'],
    [900315, 'inep', 'inep_superior'],
    [900401, 'siope', 'siope_indicadores'],
    [900402, 'siope', 'siope_anexo8'],
    [900403, 'siope', 'siope_remuneracao'],
    [900404, 'siope', 'siope_indicadores_valores'],
    [900405, 'siope', 'siope_remuneracao_carga'],
    [900501, 'mec', 'mec_retrato'],
  ])('a consulta %i é de %s, com a chave %s', async (id, fonte, chave) => {
    const { rows } = await pool.query(`SELECT fonte_id, chave FROM consultas WHERE id = $1`, [id]);

    expect(rows).toEqual([{ fonte_id: fonte, chave }]);
  });
});

describe('educacao_valores', () => {
  it('com dois lotes, a view devolve só as linhas do publicado', async () => {
    const antiga = await novaColeta(RENDIMENTO, 2025);
    const nova = await novaColeta(RENDIMENTO, 2025);
    await inserirValor(antiga, { valor: '9.9' });
    await inserirValor(nova, { valor: '6.1' });
    await publicar(RENDIMENTO, 2025, nova);

    const { rows } = await pool.query(`SELECT coleta_id, valor FROM educacao_valores_publicados`);

    expect(rows).toEqual([{ coleta_id: nova, valor: 6.1 }]);
  });

  it('sem número, guarda o texto da fonte e deixa o valor nulo', async () => {
    const coleta = await novaColeta(RENDIMENTO, 2025);
    await inserirValor(coleta, { valor: null, texto: 'menos de 5' });

    const { rows } = await pool.query(`SELECT valor, texto FROM educacao_valores WHERE coleta_id = $1`, [coleta]);

    expect(rows).toEqual([{ valor: null, texto: 'menos de 5' }]);
  });

  it('rede fora da lista é recusada', async () => {
    const coleta = await novaColeta(RENDIMENTO, 2025);

    await expect(inserirValor(coleta, { rede: 'particular' })).rejects.toThrow(/educacao_valores_rede_check/);
  });

  it('apagar a coleta apaga as linhas dela', async () => {
    const coleta = await novaColeta(RENDIMENTO, 2025);
    await inserirValor(coleta);

    await pool.query(`DELETE FROM coletas WHERE id = $1`, [coleta]);

    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM educacao_valores`);
    expect(rows[0].n).toBe(0);
  });
});

describe('educacao_financas', () => {
  it('guarda dinheiro exato, com duas casas', async () => {
    const coleta = await novaColeta(ANEXO_8, 2025);
    await inserirFinanca(coleta, { valor: '1234.56' });

    const { rows } = await pool.query(
      `SELECT valor::text AS valor, percentual::text AS percentual FROM educacao_financas WHERE coleta_id = $1`,
      [coleta],
    );

    expect(rows).toEqual([{ valor: '1234.56', percentual: '25.50' }]);
  });

  it('com dois lotes, a view devolve só as linhas do publicado', async () => {
    const antiga = await novaColeta(ANEXO_8, 2025);
    const nova = await novaColeta(ANEXO_8, 2025);
    await inserirFinanca(antiga, { valor: '1.00' });
    await inserirFinanca(nova, { valor: '2.00' });
    await publicar(ANEXO_8, 2025, nova);

    const { rows } = await pool.query(`SELECT valor FROM educacao_financas_publicadas`);

    expect(rows).toEqual([{ valor: 2 }]);
  });

  it('rede fora da lista é recusada', async () => {
    const coleta = await novaColeta(ANEXO_8, 2025);

    await expect(inserirFinanca(coleta, { rede: 'particular' })).rejects.toThrow(/educacao_financas_rede_check/);
  });
});
