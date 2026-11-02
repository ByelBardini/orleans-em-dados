// Receitas (57153). Cada visão Betha é agregada separadamente: nada aqui soma com despesas.
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
