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

/** A receita só com a Betha: a coleta de exemplo, que nunca é conferida, e a fonte única do ano que o
 *  TCE-SC não publica. Origem e natureza saem da `natureza` (sem a classe que a Betha publica até 2019),
 *  e a linha de dedução da Betha (zerada) não conta como linha; o orçado da dedução, sim. */
export async function resumoReceitas({ coletaId, meta }: ColetaPublicada, { entidade = '' } = {}) {
  const p = [coletaId, entidade];
  const filtro = `coleta_id = $1 AND ($2 = '' OR r.entidade_codigo = $2)`;
  const [[resumo], porMes, porEntidade, porOrigem, naturezas] = await Promise.all([
    consultar<{
      quantidade: number;
      orcadoAtualizado: number | null;
      orcadoDeducoes: number | null;
      arrecadadoNoMes: number | null;
      negativos: number;
      rubricas: number;
      receitaBruta: boolean;
    }>(
      `SELECT count(*) FILTER (WHERE NOT deducao)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado",
              sum(valor_orcado_deducoes) AS "orcadoDeducoes",
              sum(valor_arrecadado_mes) FILTER (WHERE NOT deducao) AS "arrecadadoNoMes",
              count(*) FILTER (WHERE NOT deducao AND valor_arrecadado_mes < 0)::int AS negativos,
              count(DISTINCT natureza) FILTER (WHERE NOT deducao)::int AS rubricas,
              coalesce(bool_or(deducao), false) AS "receitaBruta"
       FROM receitas r WHERE ${filtro}`,
      p,
    ),
    consultar(
      `SELECT mes AS chave, count(*)::int AS quantidade, sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r WHERE ${filtro} AND NOT deducao GROUP BY mes ORDER BY mes`,
      p,
    ),
    // Sem o filtro de entidade: serve para comparar as entidades entre si.
    consultar(
      `SELECT r.entidade_codigo AS chave, ${ENTIDADE} AS entidade, count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado", sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r LEFT JOIN entidades en ON en.codigo_betha = r.entidade_codigo
       WHERE coleta_id = $1 AND NOT deducao GROUP BY r.entidade_codigo, en.codigo_betha ORDER BY "arrecadadoNoMes" DESC`,
      [coletaId],
    ),
    consultar<{ chave: string }>(
      `SELECT left(natureza, 2) AS chave, count(*)::int AS quantidade,
              sum(valor_orcado_atualizado) AS "orcadoAtualizado", sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r WHERE ${filtro} AND NOT deducao GROUP BY 1 ORDER BY "arrecadadoNoMes" DESC`,
      p,
    ),
    consultar(
      `SELECT r.entidade_codigo || '|' || natureza AS chave, min(rubrica) AS rubrica, natureza, 14 AS nivel,
              min(descricao) AS descricao, coalesce(en.sigla, 'Entidade ' || r.entidade_codigo) AS entidade,
              count(*)::int AS quantidade, sum(valor_orcado_atualizado) AS "orcadoAtualizado",
              sum(valor_arrecadado_mes) AS "arrecadadoNoMes"
       FROM receitas r LEFT JOIN entidades en ON en.codigo_betha = r.entidade_codigo
       WHERE ${filtro} AND NOT deducao GROUP BY r.entidade_codigo, natureza, en.sigla ORDER BY "arrecadadoNoMes" DESC`,
      p,
    ),
  ]);
  if (!resumo) throw new Error(`Consulta de totais da receita sem linha para a coleta ${coletaId}`);
  const { receitaBruta, ...totais } = resumo;

  return {
    meta,
    receitaBruta,
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
  // A linha de dedução da Betha (até 2019, zerada) não entra na conferência, nem na quantidade.
  const somas = `count(*) FILTER (WHERE ${ate} AND NOT deducao)::int AS quantidade, sum(valor_orcado_atualizado) AS "orcadoAtualizado"`;
  const [[totais], porMes, porOrigem, rubricas, naturezas, porEntidade] = await Promise.all([
    consultar<{
      quantidade: number;
      orcadoAtualizado: number | null;
      orcadoDeducoes: number | null;
      negativos: number;
      rubricas: number;
    }>(
      `SELECT ${somas}, sum(valor_orcado_deducoes) AS "orcadoDeducoes",
              count(*) FILTER (WHERE ${ate} AND NOT deducao AND valor_arrecadado_mes < 0)::int AS negativos,
              (count(DISTINCT natureza) FILTER (WHERE ${ate} AND NOT deducao))::int AS rubricas
       FROM receitas r WHERE ${filtro}`,
      p,
    ),
    consultar<Linha<number | null>>(`SELECT mes AS chave, ${somas} FROM receitas r WHERE ${filtro} GROUP BY mes`, p),
    consultar<Linha<string>>(
      `SELECT left(natureza, 2) AS chave, ${somas} FROM receitas r WHERE ${filtro} GROUP BY 1`,
      p,
    ),
    // A rubrica como a Betha publica, para a tabela e o CSV; a natureza é a chave.
    consultar<Linha<string> & { publicada: string | null }>(
      `SELECT r.entidade_codigo || '|' || natureza AS chave, min(rubrica) FILTER (WHERE NOT deducao) AS publicada, ${somas}
       FROM receitas r WHERE ${filtro} GROUP BY 1`,
      p,
    ),
    consultar<Linha<string>>(
      `SELECT r.entidade_codigo || '|' || left(natureza, 8) AS chave, ${somas} FROM receitas r WHERE ${filtro} GROUP BY 1`,
      p,
    ),
    // Sem o filtro de entidade: serve para comparar as entidades entre si. O catálogo cobre a
    // entidade que só tem linha no TCE-SC.
    consultar<Linha<string> & { entidade: { nome: string | null; sigla: string | null; status: string | null } }>(
      `SELECT coalesce(r.entidade_codigo, en.codigo_betha) AS chave, ${ENTIDADE} AS entidade,
              count(*) FILTER (WHERE r.entidade_codigo IS NOT NULL AND NOT r.deducao
                                 AND (r.mes IS NULL OR r.mes <= $2::int))::int AS quantidade,
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
