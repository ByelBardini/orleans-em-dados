// Receitas (57153). Cada visão Betha é agregada separadamente: nada aqui soma com despesas.
// Estas consultas dão a forma bruta (exemplo) e o que só a Betha tem: orçado e quantidade de linhas.
import { consultar, ENTIDADE } from '../../lib/consultas';
import type { ColetaPublicada } from '../coletas/coletas.dao';

// Origem da receita pelos dois primeiros dígitos da natureza (MCASP).
const ORIGENS: Record<string, string> = {
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

export const descricaoDaOrigem = (chave: string) => ORIGENS[chave] ?? `Origem ${chave}`;

/** A forma de antes da conferência: só para a coleta de exemplo, que nunca é conferida. */
export async function resumoReceitas({ coletaId, meta }: ColetaPublicada, { entidade = '' } = {}) {
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
    consultar<{ chave: string }>(
      `SELECT left(rubrica, 2) AS chave, count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado", sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r WHERE ${filtro} GROUP BY 1 ORDER BY "arrecadadoNoMes" DESC`,
      p,
    ),
    consultar(
      `SELECT r.entidade_codigo || '|' || rubrica AS chave, rubrica, 14 AS nivel, min(descricao) AS descricao,
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
    porOrigem: porOrigem.map((o) => ({ ...o, descricao: descricaoDaOrigem(o.chave) })),
    naturezas,
  };
}

export type DoRecorte = { quantidade: number; orcadoAtualizado: number | null };
type Linha<C> = DoRecorte & { chave: C };

/** O que só a Betha tem, por agregado. O orçado é do ano inteiro: não tem mês. A quantidade é das
 *  linhas até o corte do TCE-SC, as mesmas que entraram na conferência. Os valores são da conferência. */
export async function complementosDaReceita(coletaId: number, entidade: string, mesLimite: number | null) {
  const p = [coletaId, entidade, mesLimite];
  const filtro = `coleta_id = $1 AND ($2 = '' OR r.entidade_codigo = $2)`;
  const ate = `(mes IS NULL OR mes <= $3::int)`;
  const somas = `count(*) FILTER (WHERE ${ate})::int AS quantidade, sum(valor_orcado_atualizado) AS "orcadoAtualizado"`;
  const [[totais], porMes, porOrigem, rubricas, naturezas, porEntidade] = await Promise.all([
    consultar<{
      quantidade: number;
      orcadoAtualizado: number | null;
      orcadoDeducoes: number | null;
      negativos: number;
      rubricas: number;
    }>(
      `SELECT ${somas}, sum(valor_orcado_deducoes) AS "orcadoDeducoes",
              count(*) FILTER (WHERE ${ate} AND valor_arrecadado_mes < 0)::int AS negativos,
              (count(DISTINCT rubrica) FILTER (WHERE ${ate}))::int AS rubricas
       FROM receitas r WHERE ${filtro}`,
      p,
    ),
    consultar<Linha<number | null>>(`SELECT mes AS chave, ${somas} FROM receitas r WHERE ${filtro} GROUP BY mes`, p),
    consultar<Linha<string>>(
      `SELECT left(rubrica, 2) AS chave, ${somas} FROM receitas r WHERE ${filtro} GROUP BY 1`,
      p,
    ),
    consultar<Linha<string>>(
      `SELECT r.entidade_codigo || '|' || rubrica AS chave, ${somas} FROM receitas r WHERE ${filtro} GROUP BY 1`,
      p,
    ),
    consultar<Linha<string>>(
      `SELECT r.entidade_codigo || '|' || left(rubrica, 8) AS chave, ${somas} FROM receitas r WHERE ${filtro} GROUP BY 1`,
      p,
    ),
    // Sem o filtro de entidade: serve para comparar as entidades entre si. O catálogo cobre a
    // entidade que só tem linha no TCE-SC.
    consultar<Linha<string> & { entidade: { nome: string | null; sigla: string | null; status: string | null } }>(
      `SELECT coalesce(r.entidade_codigo, en.codigo_betha) AS chave, ${ENTIDADE} AS entidade,
              count(*) FILTER (WHERE r.entidade_codigo IS NOT NULL AND (r.mes IS NULL OR r.mes <= $2::int))::int AS quantidade,
              sum(r.valor_orcado_atualizado) AS "orcadoAtualizado"
       FROM (SELECT * FROM receitas WHERE coleta_id = $1) r
       FULL JOIN entidades en ON en.codigo_betha = r.entidade_codigo
       GROUP BY 1, en.codigo_betha`,
      [coletaId, mesLimite],
    ),
  ]);
  if (!totais) throw new Error(`Consulta de totais da receita sem linha para a coleta ${coletaId}`);
  return { totais, porMes, porOrigem, rubricas, naturezas, porEntidade };
}
