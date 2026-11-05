// O dinheiro da aba: medianas do SIOPE e a remuneração da RAIS, em `educacao_financas`.
import { consultar } from '../../lib/consultas';
import type { LoteDeEducacao } from './educacao.comum';

export type LinhaDeFinancas = {
  indicador: string;
  lugar: string;
  rede: string;
  recorte: string;
  periodo: string;
  valor: number | null;
};

export const financasDosLotes = (lotes: readonly LoteDeEducacao[]) =>
  consultar<LinhaDeFinancas>(
    `SELECT indicador, lugar, rede, recorte, periodo, valor
     FROM educacao_financas_publicadas
     WHERE coleta_id = ANY($1::bigint[])`,
    [lotes.map((l) => l.coletaId)],
  );
