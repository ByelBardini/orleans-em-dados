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

// Alguns textos chegam da Betha sem os caracteres acentuados ("SERVIO", "GUA").
// Removendo tudo que não é A-Z/0-9 das duas grafias, elas viram a mesma chave;
// o nome exibido é a grafia mais frequente do grupo.
const chaveTexto = (coluna) => `regexp_replace(upper(${coluna}), '[^A-Z0-9 ]', '', 'g')`;

// ---------- Receitas (57153) ----------

export async function resumoReceitas({ coletaId, meta }, { entidade = '' } = {}) {
  const p = [coletaId, entidade];
  const filtro = `coleta_id = $1 AND ($2 = '' OR r.entidade_codigo = $2)`;
  const [[totais], porMes, porEntidade, porOrigem, naturezas] = await Promise.all([
    consultar(
      `SELECT count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado",
              sum(valor_orcado_deducoes) AS "orcadoDeducoes",
              sum(valor_arrecadado_mes) AS "arrecadadoNoMes",
              count(*) FILTER (WHERE valor_arrecadado_mes < 0)::int AS negativos,
              count(DISTINCT rubrica)::int AS rubricas
       FROM receitas r WHERE ${filtro}`,
      p,
    ),
    consultar(
      `SELECT mes AS chave, count(*)::int AS quantidade, sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r WHERE ${filtro} GROUP BY mes ORDER BY mes`,
      p,
    ),
    // Sem o filtro de entidade: serve para comparar as entidades entre si.
    consultar(
      `SELECT r.entidade_codigo AS chave, ${ENTIDADE} AS entidade, count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado", sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r LEFT JOIN entidades en ON en.codigo_betha = r.entidade_codigo
       WHERE coleta_id = $1 GROUP BY r.entidade_codigo, en.codigo_betha ORDER BY "arrecadadoNoMes" DESC`,
      [coletaId],
    ),
    consultar(
      `SELECT left(rubrica, 2) AS chave, count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado", sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r WHERE ${filtro} GROUP BY 1 ORDER BY "arrecadadoNoMes" DESC`,
      p,
    ),
    consultar(
      `SELECT r.entidade_codigo || '|' || rubrica AS chave, rubrica, min(descricao) AS descricao,
              coalesce(en.sigla, 'Entidade ' || r.entidade_codigo) AS entidade, count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado", sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r LEFT JOIN entidades en ON en.codigo_betha = r.entidade_codigo
       WHERE ${filtro} GROUP BY r.entidade_codigo, rubrica, en.sigla ORDER BY "arrecadadoNoMes" DESC`,
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

const FILTRO_ENTIDADE = `coleta_id = $1 AND ($2 = '' OR e.entidade_codigo = $2)`;

export async function resumoEmpenhos({ coletaId, meta }, { entidade = '' } = {}) {
  const p = [coletaId, entidade];
  const [[totais], porMes, porEntidade, porOrgao, porCredor, maiores] = await Promise.all([
    consultar(
      `SELECT ${SOMAS_EMPENHO},
              count(*) FILTER (WHERE valor_liquidado IS NULL)::int AS "semValoresDeExecucao",
              coalesce(sum(valor_empenho) FILTER (WHERE valor_liquidado IS NULL), 0) AS "semValoresDeExecucaoValor",
              coalesce(sum(saldo_a_pagar), 0) AS "saldoAPagar",
              count(*) FILTER (WHERE saldo_a_pagar > 0)::int AS "comSaldoAPagar",
              count(DISTINCT ${chaveTexto('credor')})::int AS credores
       FROM empenhos e WHERE ${FILTRO_ENTIDADE}`,
      p,
    ),
    consultar(
      `SELECT extract(month FROM data_empenho)::int AS chave, ${SOMAS_EMPENHO}
       FROM empenhos e WHERE ${FILTRO_ENTIDADE} GROUP BY 1 ORDER BY 1`,
      p,
    ),
    // Sem o filtro de entidade: serve para comparar as entidades entre si.
    consultar(
      `SELECT e.entidade_codigo AS chave, ${ENTIDADE} AS entidade, ${SOMAS_EMPENHO}
       FROM empenhos e LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
       WHERE coleta_id = $1 GROUP BY e.entidade_codigo, en.codigo_betha ORDER BY empenhado DESC`,
      [coletaId],
    ),
    consultar(
      `SELECT ${chaveTexto('orgao')} AS chave, mode() WITHIN GROUP (ORDER BY orgao) AS nome, ${SOMAS_EMPENHO}
       FROM empenhos e WHERE ${FILTRO_ENTIDADE} GROUP BY 1 ORDER BY empenhado DESC`,
      p,
    ),
    consultar(
      `SELECT ${chaveTexto('credor')} AS chave, mode() WITHIN GROUP (ORDER BY credor) AS nome,
              mode() WITHIN GROUP (ORDER BY orgao) AS "orgaoPrincipal", ${SOMAS_EMPENHO}
       FROM empenhos e WHERE ${FILTRO_ENTIDADE} AND credor IS NOT NULL
       GROUP BY 1 ORDER BY empenhado DESC LIMIT 10`,
      p,
    ),
    consultar(
      `SELECT id_externo AS id, coalesce(en.sigla, 'Entidade ' || e.entidade_codigo) AS entidade, numero,
              to_char(data_empenho, 'YYYY-MM-DD') AS data, orgao, credor, historico,
              valor_empenho AS empenhado, valor_pago AS pago
       FROM empenhos e LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
       WHERE ${FILTRO_ENTIDADE} ORDER BY valor_empenho DESC LIMIT 5`,
      p,
    ),
  ]);
  return { meta, totais, porMes, porEntidade, porOrgao, porCredor, maiores };
}

// Situação a partir dos valores publicados. NULL em liquidado/pago é ausência de
// informação na fonte, não zero.
const SITUACOES = {
  pago: 'valor_liquidado IS NOT NULL AND coalesce(saldo_a_pagar, 0) = 0',
  apagar: 'saldo_a_pagar > 0',
  sem: 'valor_liquidado IS NULL',
};

const COLUNAS_EMPENHO = `id_externo AS id, coalesce(en.sigla, 'Entidade ' || e.entidade_codigo) AS entidade, numero,
  to_char(data_empenho, 'YYYY-MM-DD') AS data, orgao, credor, historico,
  valor_empenho AS empenhado, valor_liquidado AS liquidado, valor_pago AS pago,
  saldo_a_pagar AS "saldoAPagar"`;

// Busca sem acento e sem diferenciar maiúsculas em número, credor, histórico e órgão.
function filtroBusca({ q = '', entidade = '', orgao = '', situacao = '' }) {
  const filtro = `coleta_id = $1
    AND ($2 = '' OR e.entidade_codigo = $2)
    AND ($3 = '' OR unaccent(concat_ws(' ', numero::text, credor, historico, orgao)) ILIKE unaccent('%' || $3 || '%'))
    AND ($4 = '' OR ${chaveTexto('orgao')} = $4)
    ${SITUACOES[situacao] ? `AND ${SITUACOES[situacao]}` : ''}`;
  return { filtro, params: [entidade, q.trim(), orgao] };
}

export async function buscarEmpenhos({ coletaId }, { offset = 0, limit = 50, ...opcoes }) {
  const { filtro, params } = filtroBusca(opcoes);
  const p = [coletaId, ...params];

  const [[{ total }], itens] = await Promise.all([
    consultar(`SELECT count(*)::int AS total FROM empenhos e WHERE ${filtro}`, p),
    consultar(
      `SELECT ${COLUNAS_EMPENHO}
       FROM empenhos e LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
       WHERE ${filtro}
       ORDER BY data_empenho DESC NULLS LAST, numero DESC
       OFFSET $5 LIMIT $6`,
      [...p, offset, limit],
    ),
  ]);
  return { total, offset, limit, itens };
}

export async function todosEmpenhos({ coletaId }, opcoes) {
  const { filtro, params } = filtroBusca(opcoes);
  return consultar(
    `SELECT ${COLUNAS_EMPENHO}
     FROM empenhos e LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
     WHERE ${filtro}
     ORDER BY data_empenho DESC NULLS LAST, numero DESC`,
    [coletaId, ...params],
  );
}
