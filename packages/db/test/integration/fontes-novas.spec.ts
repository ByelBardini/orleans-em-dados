import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/index';

const POPULACAO = 900101;
const DCA = 900201;

async function novaColeta(consultaId: number, ano: number): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO coletas (consulta_id, ano, filtro, iniciado_em, finalizado_em, origem, status,
                          total_hits, capturados, ids_unicos, hash_payload)
     VALUES ($1, $2, '{}', now(), now(), 'api', 'totalizador_conciliado', 1, 1, 1, 'hash')
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

function inserirIbge(
  coletaId: number,
  { periodo = '2025', valor = '24686' as string | null, simbolo = null as string | null } = {},
) {
  return pool.query(
    `INSERT INTO ibge_valores (coleta_id, id_externo, ano, localidade, tabela, variavel, periodo, categoria, valor, unidade, simbolo)
     VALUES ($1, $2, 2026, '4211702', '6579', '9324', $3, '', $4, 'Pessoas', $5)`,
    [coletaId, `6579:9324:${periodo}:`, periodo, valor, simbolo],
  );
}

function inserirFuncao(
  coletaId: number,
  { funcaoCodigo = '10' as string | null, etapa = 'empenhado', valor = '44499944.22' } = {},
) {
  return pool.query(
    `INSERT INTO siconfi_funcoes (coleta_id, id_externo, ano, etapa, tipo, funcao_codigo, subfuncao_codigo, conta, valor)
     VALUES ($1, $2, 2025, $3, 'funcao', $4, NULL, 'Conta da fixture', $5)`,
    [coletaId, `${etapa}:${funcaoCodigo}`, etapa, funcaoCodigo, valor],
  );
}

beforeEach(async () => {
  await pool.query(`TRUNCATE publicacoes, coletas CASCADE`);
});

afterAll(() => pool.end());

describe('catálogo das fontes novas', () => {
  it('fonte e consultas do IBGE e do SICONFI usam o id do importador', async () => {
    const { rows } = await pool.query(
      `SELECT id, fonte_id, chave FROM consultas WHERE fonte_id IN ('ibge', 'siconfi') ORDER BY id`,
    );

    expect(rows).toEqual([
      { id: 900101, fonte_id: 'ibge', chave: 'ibge_populacao' },
      { id: 900102, fonte_id: 'ibge', chave: 'ibge_censo' },
      { id: 900103, fonte_id: 'ibge', chave: 'ibge_pib' },
      { id: 900104, fonte_id: 'ibge', chave: 'ibge_comparacao' },
      { id: 900201, fonte_id: 'siconfi', chave: 'siconfi_funcoes' },
    ]);
  });
});

describe('ibge_valores', () => {
  it('com dois lotes, a view devolve só as linhas do publicado', async () => {
    const antiga = await novaColeta(POPULACAO, 2026);
    await inserirIbge(antiga, { valor: '1' });
    const nova = await novaColeta(POPULACAO, 2026);
    await inserirIbge(nova, { valor: '24686' });
    await publicar(POPULACAO, 2026, nova);

    const { rows } = await pool.query(`SELECT coleta_id, valor FROM ibge_valores_publicados`);

    expect(rows).toEqual([{ coleta_id: nova, valor: 24686 }]);
  });

  it('valor nulo com símbolo `...` é aceito e continua nulo, sem virar zero', async () => {
    const coleta = await novaColeta(POPULACAO, 2026);
    await inserirIbge(coleta, { valor: null, simbolo: '...' });
    await publicar(POPULACAO, 2026, coleta);

    const { rows } = await pool.query(`SELECT valor, simbolo FROM ibge_valores_publicados`);

    expect(rows).toEqual([{ valor: null, simbolo: '...' }]);
  });

  it('valor mantém as três casas decimais da tabela do IBGE', async () => {
    const coleta = await novaColeta(POPULACAO, 2026);
    await inserirIbge(coleta, { valor: '549.859' });
    await publicar(POPULACAO, 2026, coleta);

    const { rows } = await pool.query(`SELECT valor::text AS valor FROM ibge_valores_publicados`);

    expect(rows).toEqual([{ valor: '549.859' }]);
  });
});

describe('siconfi_funcoes', () => {
  it('com dois lotes, a view devolve só as linhas do publicado', async () => {
    const antiga = await novaColeta(DCA, 2025);
    await inserirFuncao(antiga, { valor: '1.00' });
    const nova = await novaColeta(DCA, 2025);
    await inserirFuncao(nova);
    await publicar(DCA, 2025, nova);

    const { rows } = await pool.query(`SELECT coleta_id FROM siconfi_funcoes_publicadas`);

    expect(rows).toEqual([{ coleta_id: nova }]);
  });

  it('funcao_codigo `01` volta como texto, com o zero à esquerda', async () => {
    const coleta = await novaColeta(DCA, 2025);
    await inserirFuncao(coleta, { funcaoCodigo: '01' });
    await publicar(DCA, 2025, coleta);

    const { rows } = await pool.query(`SELECT funcao_codigo FROM siconfi_funcoes_publicadas`);

    expect(rows).toEqual([{ funcao_codigo: '01' }]);
  });

  it('R$ 44.499.944,22 volta sem perder centavo', async () => {
    const coleta = await novaColeta(DCA, 2025);
    await inserirFuncao(coleta);
    await publicar(DCA, 2025, coleta);

    const { rows } = await pool.query(`SELECT valor::text AS valor FROM siconfi_funcoes_publicadas`);

    expect(rows).toEqual([{ valor: '44499944.22' }]);
  });

  it.each([['empenhado'], ['liquidado'], ['pago'], ['rp_nao_processados'], ['rp_processados']])(
    'etapa %s é aceita',
    async (etapa) => {
      const coleta = await novaColeta(DCA, 2025);
      await inserirFuncao(coleta, { etapa });

      const { rows } = await pool.query(`SELECT etapa FROM siconfi_funcoes WHERE coleta_id = $1`, [coleta]);

      expect(rows).toEqual([{ etapa }]);
    },
  );

  it('etapa fora da lista é recusada pela restrição', async () => {
    const coleta = await novaColeta(DCA, 2025);

    await expect(inserirFuncao(coleta, { etapa: 'orcado' })).rejects.toThrow('siconfi_funcoes_etapa_check');
  });
});
