// Agregações feitas no PostgreSQL (NUMERIC exato) sobre a coleta publicada.
// Cada visão Betha é agregada separadamente: nada aqui soma receitas com
// despesas nem empenhos (57140) com despesa orçamentária (57170).

import { pool } from '@orleans-em-dados/db';

// Origem da receita pelos dois primeiros dígitos da natureza (MCASP).
const ORIGENS = {
  11: 'Impostos, taxas e contribuições de melhoria',
  12: 'Contribuições',
  13: 'Receita patrimonial',
  14: 'Receita agropecuária',
  15: 'Receita industrial',
  16: 'Receita de serviços',
  17: 'Transferências correntes',
  19: 'Outras receitas correntes',
  21: 'Operações de crédito',
  22: 'Alienação de bens',
  23: 'Amortização de empréstimos',
  24: 'Transferências de capital',
  29: 'Outras receitas de capital',
};

const consultar = async (sql, params) => (await pool.query(sql, params)).rows;

const ENTIDADE = `json_build_object('nome', en.nome, 'sigla', en.sigla, 'status', en.status_mapeamento)`;

// ---------- Receitas (57153) ----------

export async function resumoReceitas({ coletaId, meta }) {
  const p = [coletaId];
  const [[totais], porMes, porEntidade, porOrigem, naturezas] = await Promise.all([
    consultar(
      `SELECT count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado",
              sum(valor_arrecadado_mes) AS "arrecadadoNoMes",
              count(*) FILTER (WHERE valor_arrecadado_mes < 0)::int AS negativos
       FROM receitas WHERE coleta_id = $1`,
      p,
    ),
    consultar(
      `SELECT mes AS chave, count(*)::int AS quantidade, sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas WHERE coleta_id = $1 GROUP BY mes ORDER BY mes`,
      p,
    ),
    consultar(
      `SELECT r.entidade_codigo AS chave, ${ENTIDADE} AS entidade, count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado", sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r LEFT JOIN entidades en ON en.codigo_betha = r.entidade_codigo
       WHERE coleta_id = $1 GROUP BY r.entidade_codigo, en.codigo_betha ORDER BY "arrecadadoNoMes" DESC`,
      p,
    ),
    consultar(
      `SELECT left(rubrica, 2) AS chave, count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado", sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas WHERE coleta_id = $1 GROUP BY 1 ORDER BY "arrecadadoNoMes" DESC`,
      p,
    ),
    consultar(
      `SELECT r.entidade_codigo || '|' || rubrica AS chave, rubrica, min(descricao) AS descricao,
              coalesce(en.sigla, 'Entidade ' || r.entidade_codigo) AS entidade, count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado", sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r LEFT JOIN entidades en ON en.codigo_betha = r.entidade_codigo
       WHERE coleta_id = $1 GROUP BY r.entidade_codigo, rubrica, en.sigla ORDER BY "arrecadadoNoMes" DESC`,
      p,
    ),
  ]);

  return {
    meta,
    totais,
    porMes,
    porEntidade,
    porOrigem: porOrigem.map((o) => ({ ...o, descricao: ORIGENS[o.chave] ?? `Origem ${o.chave}` })),
    naturezas,
  };
}

// ---------- Empenhos (57140) ----------

const SOMAS_EMPENHO = `count(*)::int AS quantidade, sum(valor_empenho) AS empenhado,
  sum(valor_liquidado) AS liquidado, sum(valor_pago) AS pago`;

export async function resumoEmpenhos({ coletaId, meta }) {
  const p = [coletaId];
  const [[totais], porMes, porEntidade, porOrgao] = await Promise.all([
    consultar(
      `SELECT ${SOMAS_EMPENHO}, count(*) FILTER (WHERE valor_liquidado IS NULL)::int AS "semValoresDeExecucao"
       FROM empenhos WHERE coleta_id = $1`,
      p,
    ),
    consultar(
      `SELECT extract(month FROM data_empenho)::int AS chave, ${SOMAS_EMPENHO}
       FROM empenhos WHERE coleta_id = $1 GROUP BY 1 ORDER BY 1`,
      p,
    ),
    consultar(
      `SELECT e.entidade_codigo AS chave, ${ENTIDADE} AS entidade, ${SOMAS_EMPENHO}
       FROM empenhos e LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
       WHERE coleta_id = $1 GROUP BY e.entidade_codigo, en.codigo_betha ORDER BY empenhado DESC`,
      p,
    ),
    consultar(
      `SELECT orgao AS chave, ${SOMAS_EMPENHO}
       FROM empenhos WHERE coleta_id = $1 GROUP BY orgao ORDER BY empenhado DESC`,
      p,
    ),
  ]);
  return { meta, totais, porMes, porEntidade, porOrgao };
}

// Busca sem acento e sem diferenciar maiúsculas em número, credor, histórico e órgão.
export async function buscarEmpenhos({ coletaId }, { q = '', entidade = '', offset = 0, limit = 50 }) {
  const termo = q.trim();
  const filtro = `coleta_id = $1
    AND ($2 = '' OR e.entidade_codigo = $2)
    AND ($3 = '' OR unaccent(concat_ws(' ', numero::text, credor, historico, orgao)) ILIKE unaccent('%' || $3 || '%'))`;
  const params = [coletaId, entidade, termo];

  const [[{ total }], itens] = await Promise.all([
    consultar(`SELECT count(*)::int AS total FROM empenhos e WHERE ${filtro}`, params),
    consultar(
      `SELECT id_externo AS id, coalesce(en.sigla, 'Entidade ' || e.entidade_codigo) AS entidade, numero,
              to_char(data_empenho, 'YYYY-MM-DD') AS data, orgao, credor, historico,
              valor_empenho AS empenhado, valor_liquidado AS liquidado, valor_pago AS pago,
              saldo_a_pagar AS "saldoAPagar"
       FROM empenhos e LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
       WHERE ${filtro}
       ORDER BY data_empenho DESC NULLS LAST, numero DESC
       OFFSET $4 LIMIT $5`,
      [...params, offset, limit],
    ),
  ]);
  return { total, offset, limit, itens };
}
