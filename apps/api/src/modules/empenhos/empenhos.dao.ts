// A lista de empenhos: identificação e órgão da Betha (57140), execução do TCE-SC. `empenhado` é o
// valor original da Betha, que não é a despesa líquida de anulações. As somas são do Postgres, em NUMERIC.
import { chaveTexto, consultar, ENTIDADE } from '../../lib/consultas';
import type { ColetaPublicada } from '../coletas/coletas.dao';
import { filtroBusca, type OpcoesDaBusca } from './empenhos.filtro';

/** A relação `e` de todas as consultas, com as mesmas colunas, e os parâmetros que ela usa. */
export type ConjuntoDeEmpenhos = { relacao: string; params: unknown[] };

const COLUNAS_DA_BETHA = `b.id_externo, b.entidade_codigo, b.numero, b.data_empenho, b.orgao, b.credor, b.historico,
  b.valor_empenho AS empenhado`;

/** Só os pares casados com o TCE-SC, com os valores do próprio TCE-SC. Lista vazia: conjunto vazio. */
export const conjuntoConferido = (
  pares: readonly { id: string; idTce: string }[],
  ano: number,
): ConjuntoDeEmpenhos => ({
  relacao: `(SELECT ${COLUNAS_DA_BETHA}, t.valor_empenhado AS empenhado_liquido, t.valor_liquidado AS liquidado,
                    t.valor_pago AS pago, t.valor_liquidado - t.valor_pago AS saldo
             FROM empenhos b
             JOIN unnest($2::text[], $3::text[]) AS par(id, id_tce) ON par.id = b.id_externo
             JOIN tcesc_empenhos t ON t.id_externo = par.id_tce
              AND t.coleta_id = (SELECT p.coleta_id FROM publicacoes p JOIN consultas q ON q.id = p.consulta_id
                                 WHERE q.chave = 'tcesc_empenhos' AND p.ano = $4)
             WHERE b.coleta_id = $1) e`,
  params: [pares.map((p) => p.id), pares.map((p) => p.idTce), ano],
});

/** A coleta de exemplo nunca é conferida: fica com os valores da própria 57140. */
export const conjuntoDeExemplo = (): ConjuntoDeEmpenhos => ({
  relacao: `(SELECT ${COLUNAS_DA_BETHA}, NULL::numeric AS empenhado_liquido, b.valor_liquidado AS liquidado,
                    b.valor_pago AS pago, b.saldo_a_pagar AS saldo
             FROM empenhos b WHERE b.coleta_id = $1) e`,
  params: [],
});

const SOMAS_EMPENHO = `count(*)::int AS quantidade, sum(empenhado) AS empenhado, sum(empenhado_liquido) AS "empenhadoLiquido",
  sum(liquidado) AS liquidado, sum(pago) AS pago`;

const COLUNAS_DA_LISTA = `id_externo AS id, coalesce(en.sigla, 'Entidade ' || e.entidade_codigo) AS entidade, numero,
  to_char(data_empenho, 'YYYY-MM-DD') AS data, orgao, credor, historico,
  empenhado, empenhado_liquido AS "empenhadoLiquido", liquidado, pago, saldo AS "saldoAPagar"`;

// Data igual e número igual acontecem entre entidades: o id deixa a paginação estável.
const ORDEM_DA_LISTA = 'ORDER BY data_empenho DESC NULLS LAST, numero DESC, id_externo';

export async function resumoEmpenhos(
  { coletaId, meta }: ColetaPublicada,
  { relacao, params }: ConjuntoDeEmpenhos,
  { entidade = '' }: { entidade?: string },
) {
  const doConjunto = [coletaId, ...params];
  const p = [...doConjunto, entidade];
  const n = `$${p.length}`;
  const filtro = `(${n} = '' OR e.entidade_codigo = ${n})`;
  const [[totais], [registros], porMes, porEntidade, porOrgao, porCredor, maiores] = await Promise.all([
    consultar<{ quantidade: number }>(
      `SELECT ${SOMAS_EMPENHO},
              count(*) FILTER (WHERE liquidado IS NULL)::int AS "semValoresDeExecucao",
              coalesce(sum(empenhado) FILTER (WHERE liquidado IS NULL), 0) AS "semValoresDeExecucaoValor",
              coalesce(sum(saldo), 0) AS "saldoAPagar",
              count(*) FILTER (WHERE saldo > 0)::int AS "comSaldoAPagar",
              count(DISTINCT ${chaveTexto('credor')})::int AS credores
       FROM ${relacao} WHERE ${filtro}`,
      p,
    ),
    consultar<{ total: number }>(
      `SELECT count(*)::int AS total FROM empenhos WHERE coleta_id = $1 AND ($2 = '' OR entidade_codigo = $2)`,
      [coletaId, entidade],
    ),
    consultar(
      `SELECT extract(month FROM data_empenho)::int AS chave, ${SOMAS_EMPENHO}
       FROM ${relacao} WHERE ${filtro} GROUP BY 1 ORDER BY 1`,
      p,
    ),
    // Sem o filtro de entidade: serve para comparar as entidades entre si.
    consultar(
      `SELECT e.entidade_codigo AS chave, ${ENTIDADE} AS entidade, ${SOMAS_EMPENHO}
       FROM ${relacao} LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
       GROUP BY e.entidade_codigo, en.codigo_betha ORDER BY empenhado DESC`,
      doConjunto,
    ),
    consultar(
      `SELECT ${chaveTexto('orgao')} AS chave, mode() WITHIN GROUP (ORDER BY orgao) AS nome, ${SOMAS_EMPENHO}
       FROM ${relacao} WHERE ${filtro} GROUP BY 1 ORDER BY empenhado DESC`,
      p,
    ),
    consultar(
      `SELECT ${chaveTexto('credor')} AS chave, mode() WITHIN GROUP (ORDER BY credor) AS nome,
              mode() WITHIN GROUP (ORDER BY orgao) AS "orgaoPrincipal", ${SOMAS_EMPENHO}
       FROM ${relacao} WHERE ${filtro} AND credor IS NOT NULL
       GROUP BY 1 ORDER BY empenhado DESC LIMIT 10`,
      p,
    ),
    consultar(
      `SELECT id_externo AS id, coalesce(en.sigla, 'Entidade ' || e.entidade_codigo) AS entidade, numero,
              to_char(data_empenho, 'YYYY-MM-DD') AS data, orgao, credor, historico,
              empenhado, empenhado_liquido AS "empenhadoLiquido", pago
       FROM ${relacao} LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
       WHERE ${filtro} ORDER BY empenhado DESC LIMIT 5`,
      p,
    ),
  ]);
  const excluidos = (registros?.total ?? 0) - (totais?.quantidade ?? 0);
  return { meta, totais: { ...totais, excluidos }, porMes, porEntidade, porOrgao, porCredor, maiores };
}

export async function buscarEmpenhos(
  { coletaId }: ColetaPublicada,
  { relacao, params: doConjunto }: ConjuntoDeEmpenhos,
  { offset = 0, limit = 50, ...opcoes }: OpcoesDaBusca & { offset?: number; limit?: number },
) {
  const inicio = doConjunto.length + 2;
  const { filtro, params } = filtroBusca(opcoes, inicio);
  const p = [coletaId, ...doConjunto, ...params];

  const [contagem, itens] = await Promise.all([
    consultar<{ total: number }>(`SELECT count(*)::int AS total FROM ${relacao} WHERE ${filtro}`, p),
    consultar(
      `SELECT ${COLUNAS_DA_LISTA}
       FROM ${relacao} LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
       WHERE ${filtro}
       ${ORDEM_DA_LISTA}
       OFFSET $${inicio + 3} LIMIT $${inicio + 4}`,
      [...p, offset, limit],
    ),
  ]);
  return { total: contagem[0]?.total ?? 0, offset, limit, itens };
}

export async function todosEmpenhos(
  { coletaId }: ColetaPublicada,
  { relacao, params: doConjunto }: ConjuntoDeEmpenhos,
  opcoes: OpcoesDaBusca,
) {
  const { filtro, params } = filtroBusca(opcoes, doConjunto.length + 2);
  return consultar(
    `SELECT ${COLUNAS_DA_LISTA}
     FROM ${relacao} LEFT JOIN entidades en ON en.codigo_betha = e.entidade_codigo
     WHERE ${filtro}
     ${ORDEM_DA_LISTA}`,
    [coletaId, ...doConjunto, ...params],
  );
}
