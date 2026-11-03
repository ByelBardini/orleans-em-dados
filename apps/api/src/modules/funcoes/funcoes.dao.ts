// A despesa por função publicada. Somas e participação são do Postgres (NUMERIC exato); as colunas
// de restos a pagar ficam de fora, e cada etapa fica na própria coluna, sem nunca somar uma à outra.
import { consultar } from '../../lib/consultas';

export type Etapas = { empenhado: number | null; liquidado: number | null; pago: number | null };
export type LinhaDaFuncao = Etapas & {
  ano: number;
  tipo: 'funcao' | 'subfuncao';
  codigo: string;
  subfuncao: string | null;
  nome: string;
  participacao: Etapas;
};
export type TotalDoAno = Etapas & { ano: number };

const CAMARA = '01';

const COLUNAS = `
  sum(valor) FILTER (WHERE etapa = 'empenhado') AS empenhado,
  sum(valor) FILTER (WHERE etapa = 'liquidado') AS liquidado,
  sum(valor) FILTER (WHERE etapa = 'pago') AS pago`;

const POR_CONTA = `
  SELECT ano, tipo, funcao_codigo AS codigo, subfuncao_codigo AS subfuncao, conta AS nome, ${COLUNAS}
  FROM siconfi_funcoes_publicadas
  WHERE tipo IN ('funcao', 'subfuncao') AND etapa IN ('empenhado', 'liquidado', 'pago')
    AND ($1::int IS NULL OR ano = $1)
  GROUP BY ano, tipo, funcao_codigo, subfuncao_codigo, conta`;

const participacao = (etapa: string) => `round(100 * c.${etapa} / NULLIF(t.${etapa}, 0), 2)`;

/** Com `ano` nulo, todos os exercícios publicados. */
export const linhasDasFuncoes = (ano: number | null) =>
  consultar<LinhaDaFuncao>(
    `WITH contas AS (${POR_CONTA}),
          totais AS (
            SELECT ano, sum(empenhado) AS empenhado, sum(liquidado) AS liquidado, sum(pago) AS pago
            FROM contas WHERE tipo = 'funcao' AND codigo <> '${CAMARA}' GROUP BY ano
          )
     SELECT c.ano, c.tipo, c.codigo, c.subfuncao, c.nome, c.empenhado, c.liquidado, c.pago,
            json_build_object('empenhado', ${participacao('empenhado')}, 'liquidado', ${participacao('liquidado')},
                              'pago', ${participacao('pago')}) AS participacao
     FROM contas c LEFT JOIN totais t ON t.ano = c.ano
     ORDER BY c.ano, c.codigo, c.subfuncao NULLS FIRST`,
    [ano],
  );

/** O total sem a Câmara: é a soma das funções, igual à linha do anexo menos a Legislativa. */
export const totaisDasFuncoes = (ano: number | null) =>
  consultar<TotalDoAno>(
    `SELECT ano, ${COLUNAS}
     FROM siconfi_funcoes_publicadas
     WHERE tipo = 'funcao' AND funcao_codigo <> '${CAMARA}' AND ($1::int IS NULL OR ano = $1)
     GROUP BY ano ORDER BY ano`,
    [ano],
  );
