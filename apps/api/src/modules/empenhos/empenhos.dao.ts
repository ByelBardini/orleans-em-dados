// Empenhos (57140): valores originais, que não são a despesa líquida de anulações.
import { chaveTexto, consultar, ENTIDADE } from '../../lib/consultas';
import type { ColetaPublicada } from '../coletas/coletas.dao';
import { filtroBusca, type OpcoesDaBusca } from './empenhos.filtro';

const SOMAS_EMPENHO = `count(*)::int AS quantidade, sum(valor_empenho) AS empenhado,
  sum(valor_liquidado) AS liquidado, sum(valor_pago) AS pago`;

// $3: IDs que a conferência com o TCE-SC aponta como versões antigas de empenhos
// renumerados ou registros repetidos. Ficam na lista (com selo), fora das somas.
const FILTRO_ENTIDADE = `coleta_id = $1 AND ($2 = '' OR e.entidade_codigo = $2) AND NOT (id_externo = ANY($3::text[]))`;

const COLUNAS_EMPENHO = `id_externo AS id, coalesce(en.sigla, 'Entidade ' || e.entidade_codigo) AS entidade, numero,
  to_char(data_empenho, 'YYYY-MM-DD') AS data, orgao, credor, historico,
  valor_empenho AS empenhado, valor_liquidado AS liquidado, valor_pago AS pago,
  saldo_a_pagar AS "saldoAPagar"`;

export async function resumoEmpenhos(
  { coletaId, meta }: ColetaPublicada,
  { entidade = '', excluir = [] }: { entidade?: string; excluir?: string[] },
) {
  const p = [coletaId, entidade, excluir];
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
       WHERE coleta_id = $1 AND NOT (id_externo = ANY($2::text[]))
       GROUP BY e.entidade_codigo, en.codigo_betha ORDER BY empenhado DESC`,
      [coletaId, excluir],
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
  return { meta, totais: { ...totais, excluidos: excluir.length }, porMes, porEntidade, porOrgao, porCredor, maiores };
}

export async function buscarEmpenhos(
  { coletaId }: ColetaPublicada,
  { offset = 0, limit = 50, ...opcoes }: OpcoesDaBusca & { offset?: number; limit?: number },
) {
  const { filtro, params } = filtroBusca(opcoes);
  const p = [coletaId, ...params];

  const [contagem, itens] = await Promise.all([
    consultar<{ total: number }>(`SELECT count(*)::int AS total FROM empenhos e WHERE ${filtro}`, p),
    consultar(
      `SELECT ${COLUNAS_EMPENHO}
       FROM empenhos e LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
       WHERE ${filtro}
       ORDER BY data_empenho DESC NULLS LAST, numero DESC
       OFFSET $5 LIMIT $6`,
      [...p, offset, limit],
    ),
  ]);
  return { total: contagem[0]?.total ?? 0, offset, limit, itens };
}

export async function todosEmpenhos({ coletaId }: ColetaPublicada, opcoes: OpcoesDaBusca) {
  const { filtro, params } = filtroBusca(opcoes);
  return consultar(
    `SELECT ${COLUNAS_EMPENHO}
     FROM empenhos e LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
     WHERE ${filtro}
     ORDER BY data_empenho DESC NULLS LAST, numero DESC`,
    [coletaId, ...params],
  );
}
