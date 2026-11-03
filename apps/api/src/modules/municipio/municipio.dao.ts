// O que está publicado do IBGE. O lote traz a série inteira: vale o de maior ano em cada consulta.
import { consultar } from '../../lib/consultas';

export type LoteDoIbge = { chave: string; coletaId: number; coletadoEm: Date; fonte: string; urlOrigem: string };
export type LinhaDoIbge = {
  localidade?: string;
  tabela: string;
  variavel: string;
  periodo: string;
  categoria: string;
  valor: number | null;
};

export const lotesDoIbge = () =>
  consultar<LoteDoIbge>(
    `SELECT DISTINCT ON (q.chave) q.chave, p.coleta_id AS "coletaId", c.finalizado_em AS "coletadoEm",
            f.nome AS fonte, q.url_origem AS "urlOrigem"
     FROM publicacoes p
     JOIN consultas q ON q.id = p.consulta_id AND q.fonte_id = 'ibge'
     JOIN coletas c ON c.id = p.coleta_id
     JOIN fontes f ON f.id = q.fonte_id
     ORDER BY q.chave, p.ano DESC`,
    [],
  );

export const linhasDoIbge = (coletas: readonly number[]) =>
  consultar<LinhaDoIbge>(
    `SELECT localidade, tabela, variavel, periodo, categoria, valor
     FROM ibge_valores WHERE coleta_id = ANY($1::bigint[])`,
    [coletas],
  );
