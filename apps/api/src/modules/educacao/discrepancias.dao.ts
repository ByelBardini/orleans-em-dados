// As duas pontas da comparação. A soma da função 12 é do Postgres (NUMERIC exato), só no liquidado, a etapa do Anexo 8.
import { consultar } from '../../lib/consultas';
import { CODIGO_DO_LUGAR, type LoteDeEducacao } from './educacao.comum';

export type LinhaDeFinanca = {
  ano: number;
  indicador: string;
  recorte: string;
  valor: number | null;
  percentual: number | null;
};

export const financasDosLotes = (lotes: readonly LoteDeEducacao[], indicadores: readonly string[]) =>
  consultar<LinhaDeFinanca>(
    `SELECT ano, indicador, recorte, valor, percentual
     FROM educacao_financas_publicadas
     WHERE coleta_id = ANY($1::bigint[]) AND lugar = $2 AND indicador = ANY($3::text[])`,
    [lotes.map((l) => l.coletaId), CODIGO_DO_LUGAR.orleans, indicadores],
  );

export const funcao12Liquidada = () =>
  consultar<{ ano: number; valor: number }>(
    `SELECT ano, sum(valor) AS valor
     FROM siconfi_funcoes_publicadas
     WHERE tipo = 'funcao' AND funcao_codigo = '12' AND etapa = 'liquidado'
     GROUP BY ano
     ORDER BY ano`,
    [],
  );
