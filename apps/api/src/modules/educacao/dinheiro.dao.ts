// O SQL da aba Dinheiro. Toda soma é do Postgres, em NUMERIC.
import { consultar } from '../../lib/consultas';

export type LinhaDeFinanca = {
  coletaId: number;
  indicador: string;
  recorte: string;
  periodo: string;
  valor: number | null;
  percentual: number | null;
};

export const financasDosLotes = (coletaIds: readonly number[]) =>
  consultar<LinhaDeFinanca>(
    `SELECT coleta_id AS "coletaId", indicador, recorte, periodo, valor, percentual
     FROM educacao_financas_publicadas
     WHERE coleta_id = ANY($1::bigint[]) AND lugar = '4211702'`,
    [coletaIds],
  );

// A mesma chave da conferência do gasto: o número da ação muda entre exercícios, e a ligação é pelo nome.
const CHAVE = (coluna: string) => `regexp_replace(upper(unaccent(${coluna})), '[^A-Z0-9]', '', 'g')`;

export type LinhaDaAcao = {
  ano: number;
  /** Nulos os dois: o total do ano. */
  acao: string | null;
  natureza: 'pessoal' | 'custeio' | 'investimento' | 'outras' | null;
  liquidado: number | null;
};

/** Total, por ação e por natureza de cada exercício, numa consulta só: as três visões saem da mesma soma. */
export const liquidadoDasAcoes = (acoes: readonly string[]) =>
  consultar<LinhaDaAcao>(
    `WITH das_acoes AS (
       SELECT d.ano, n.nome AS acao, d.valor_liquidado,
              CASE left(d.natureza, 2)
                WHEN '31' THEN 'pessoal' WHEN '33' THEN 'custeio' WHEN '44' THEN 'investimento' ELSE 'outras'
              END AS natureza
       FROM despesas_publicadas d
       JOIN unnest($1::text[]) AS n(nome) ON ${CHAVE('d.acao')} = ${CHAVE('n.nome')}
     )
     SELECT ano, acao, natureza, sum(valor_liquidado) AS liquidado
     FROM das_acoes
     GROUP BY GROUPING SETS ((ano), (ano, acao), (ano, natureza))
     ORDER BY ano, liquidado DESC, acao`,
    [acoes],
  );

/** A dedução que o TCE-SC registra para o Fundeb, com o sinal trocado: é a contribuição de cada exercício. */
export const contribuicaoNoTce = () =>
  consultar<{ ano: number; contribuicao: number }>(
    `SELECT r.ano, -sum(r.valor_arrecadado) AS contribuicao
     FROM tcesc_receitas r
     JOIN publicacoes p ON p.coleta_id = r.coleta_id
     JOIN consultas q ON q.id = p.consulta_id AND q.chave = 'tcesc_receitas'
     WHERE r.tipo_deducao = 'FUNDEB'
     GROUP BY r.ano`,
    [],
  );
