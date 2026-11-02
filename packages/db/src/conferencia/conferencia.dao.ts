// As consultas da conferência. SQL em texto, com o tipo de cada linha declarado: são
// CTEs e FULL JOINs que reaproveitam os parâmetros, e o Postgres é quem soma em NUMERIC.
import { pool } from '../index';
import type {
  CamaraDaConferencia,
  ColetaDaConferencia,
  DespesaPorEntidade,
  EmpenhoSemPar,
  EmpenhosPorEntidade,
  Limites,
  LinhaNatureza,
  ReceitaIncoerente,
  ReceitaPorEntidade,
  ReceitaPorMes,
  ReceitaRepetida,
} from './conferencia.bo';

const consultar = async <T>(sql: string, params: unknown[]) => (await pool.query(sql, params)).rows as T[];

const coleta = (chave: string) =>
  `(SELECT p.coleta_id FROM publicacoes p JOIN consultas q ON q.id = p.consulta_id WHERE q.chave = '${chave}' AND p.ano = $1)`;

// Natureza da receita no nível comum às duas fontes: 8 dígitos
// (Betha 17135011000000 ↔ TCE 1.7.1.3.50.1.1).
const NAT_BETHA = 'left(rubrica, 8)';
const NAT_TCE = `left(replace(codigo, '.', ''), 8)`;

// $2: último mês que o TCE já recebeu. Meses sem sufixo na Betha entram sempre.
const MES_BETHA = '(mes IS NULL OR mes <= $2)';
// $2: data do último empenho recebido pelo TCE; NULL em exercício completo.
const ATE_DATA = '($2::date IS NULL OR data_empenho <= $2::date)';

// Casamento 1:1 por (entidade, número, data, valor original) e ordem de
// ocorrência: a Betha repete registros com a mesma chave. Entre repetidos, o
// primeiro é o que tem execução e o ID mais recente; as cópias antigas da 57140
// vêm sem os campos de liquidação e com ID menor, e ficam como "só na Betha".
const EMPENHOS_CASADOS = `
    WITH b AS (SELECT entidade_codigo ent, numero, data_empenho, valor_empenho v, valor_liquidado l, valor_pago p, id_externo,
                      row_number() OVER (PARTITION BY entidade_codigo, numero, data_empenho, valor_empenho
                                         ORDER BY saldo_a_pagar IS NULL, split_part(id_externo, ':', 3)::bigint DESC) ocorrencia
               FROM empenhos WHERE coleta_id = ${coleta('empenhos')} AND ${ATE_DATA}),
         t AS (SELECT u.entidade_betha ent, u.sigla, numero, data_empenho, valor_original v, valor_liquidado l, valor_pago p, id_externo,
                      row_number() OVER (PARTITION BY codigo_ug, numero, data_empenho, valor_original ORDER BY id_externo) ocorrencia
               FROM tcesc_empenhos e JOIN unidades_tce u USING (codigo_ug)
               WHERE coleta_id = ${coleta('tcesc_empenhos')} AND u.entidade_betha IS NOT NULL AND ${ATE_DATA}),
         m AS (SELECT ent, coalesce(t.sigla, en.sigla) AS entidade, numero, data_empenho, v, ocorrencia,
                      b.id_externo bid, t.id_externo tid, b.v bv, t.v tv, b.l bl, t.l tl, b.p bp, t.p tp
               FROM b FULL JOIN t USING (ent, numero, data_empenho, v, ocorrencia)
               LEFT JOIN entidades en ON en.codigo_betha = ent)`;

// Para um empenho sem par, procura na outra fonte o mesmo empenho com outro número.
const OUTRO_NUMERO = (fonte: 'tce' | 'betha') =>
  fonte === 'tce'
    ? `(SELECT min(x.numero) FROM tcesc_empenhos x JOIN unidades_tce ux USING (codigo_ug)
        WHERE x.coleta_id = ${coleta('tcesc_empenhos')} AND ux.entidade_betha = m.ent
          AND x.data_empenho = m.data_empenho AND x.valor_original = m.v AND x.numero <> m.numero)`
    : `(SELECT min(x.numero) FROM empenhos x
        WHERE x.coleta_id = ${coleta('empenhos')} AND x.entidade_codigo = m.ent
          AND x.data_empenho = m.data_empenho AND x.valor_empenho = m.v AND x.numero <> m.numero)`;

const CONSULTAS = {
  coletas: `
    SELECT q.chave, q.fonte_id AS fonte, q.nome, c.id AS coleta, c.finalizado_em AS "coletadoEm", c.total_hits AS linhas,
           c.filtro->>'ultimaRecargaApp' AS "recargaTce"
    FROM publicacoes p JOIN consultas q ON q.id = p.consulta_id JOIN coletas c ON c.id = p.coleta_id
    WHERE p.ano = $1 AND c.status <> 'exemplo' ORDER BY q.fonte_id, q.chave`,

  // Betha 57170 × TCE por UG: mesmo conceito (empenhado/liquidado/pago líquidos de anulações).
  // A 57170 não tem data: em exercício incompleto no TCE os totais não são comparáveis.
  despesaPorEntidade: `
    WITH b AS (SELECT entidade_codigo, sum(valor_empenhado) e, sum(valor_liquidado) l, sum(valor_pago) p
               FROM despesas WHERE coleta_id = ${coleta('despesas')} GROUP BY 1),
         t AS (SELECT codigo_ug, sum(valor_empenhado) e, sum(valor_liquidado) l, sum(valor_pago) p
               FROM tcesc_empenhos WHERE coleta_id = ${coleta('tcesc_empenhos')} GROUP BY 1)
    SELECT u.sigla, u.nome, u.poder, u.entidade_betha AS "entidadeBetha",
           b.e AS "bethaEmpenhado", t.e AS "tceEmpenhado", b.e - t.e AS "difEmpenhado",
           b.l AS "bethaLiquidado", t.l AS "tceLiquidado", b.l - t.l AS "difLiquidado",
           b.p AS "bethaPago", t.p AS "tcePago", b.p - t.p AS "difPago"
    FROM unidades_tce u LEFT JOIN b ON b.entidade_codigo = u.entidade_betha LEFT JOIN t ON t.codigo_ug = u.codigo_ug
    WHERE b.e IS NOT NULL OR t.e IS NOT NULL
    ORDER BY u.entidade_betha IS NULL, t.e DESC NULLS LAST`,

  // Betha 57153 (valorArrecadadoNoMes, com sinais) × TCE (valorarrecadado, líquido de deduções).
  receitaPorEntidade: `
    WITH b AS (SELECT entidade_codigo, sum(valor_arrecadado_mes) v FROM receitas
               WHERE coleta_id = ${coleta('receitas')} AND ${MES_BETHA} GROUP BY 1),
         t AS (SELECT unidade, sum(valor_arrecadado) v FROM tcesc_receitas
               WHERE coleta_id = ${coleta('tcesc_receitas')} AND mes <= $2 GROUP BY 1)
    SELECT u.sigla, u.entidade_betha AS "codigoEntidade", b.v AS betha, t.v AS tce, coalesce(b.v, 0) - coalesce(t.v, 0) AS diferenca
    FROM unidades_tce u LEFT JOIN b ON b.entidade_codigo = u.entidade_betha LEFT JOIN t ON t.unidade = u.nome
    WHERE b.v IS NOT NULL OR t.v IS NOT NULL ORDER BY t.v DESC NULLS LAST`,

  // O mês Betha é inferido do sufixo _N do ID; a igualdade mês a mês testa essa inferência.
  receitaPorMes: `
    WITH b AS (SELECT mes, sum(valor_arrecadado_mes) v FROM receitas WHERE coleta_id = ${coleta('receitas')} GROUP BY 1),
         t AS (SELECT mes, sum(valor_arrecadado) v FROM tcesc_receitas WHERE coleta_id = ${coleta('tcesc_receitas')} GROUP BY 1)
    SELECT coalesce(b.mes, t.mes) AS mes, b.v AS betha, t.v AS tce,
           CASE WHEN coalesce(b.mes, t.mes) <= $2 THEN coalesce(b.v, 0) - coalesce(t.v, 0) END AS diferenca
    FROM b FULL JOIN t USING (mes) ORDER BY 1`,

  receitaPorNatureza: `
    WITH b AS (SELECT entidade_codigo ent, ${NAT_BETHA} nat, min(descricao) descricao, sum(valor_arrecadado_mes) v
               FROM receitas WHERE coleta_id = ${coleta('receitas')} AND ${MES_BETHA} GROUP BY 1, 2),
         t AS (SELECT u.entidade_betha ent, ${NAT_TCE} nat, min(natureza) descricao, sum(valor_arrecadado) v
               FROM tcesc_receitas r JOIN unidades_tce u ON u.nome = r.unidade
               WHERE coleta_id = ${coleta('tcesc_receitas')} AND mes <= $2 GROUP BY 1, 2)
    SELECT ent, coalesce(en.sigla, ent) AS entidade, nat AS natureza, coalesce(t.descricao, b.descricao) AS descricao,
           b.v AS betha, t.v AS tce, coalesce(b.v, 0) - coalesce(t.v, 0) AS diferenca
    FROM b FULL JOIN t USING (ent, nat) LEFT JOIN entidades en ON en.codigo_betha = ent
    ORDER BY abs(coalesce(b.v, 0) - coalesce(t.v, 0)) DESC, 2, 3`,

  empenhos: `${EMPENHOS_CASADOS}
    SELECT entidade, ent AS "codigoEntidade",
           count(*) FILTER (WHERE bid IS NOT NULL)::int AS betha,
           count(*) FILTER (WHERE tid IS NOT NULL)::int AS tce,
           count(*) FILTER (WHERE bid IS NOT NULL AND tid IS NOT NULL)::int AS casados,
           count(*) FILTER (WHERE tid IS NULL)::int AS "soBetha", coalesce(sum(bv) FILTER (WHERE tid IS NULL), 0) AS "valorSoBetha",
           count(*) FILTER (WHERE bid IS NULL)::int AS "soTce", coalesce(sum(tv) FILTER (WHERE bid IS NULL), 0) AS "valorSoTce"
    FROM m GROUP BY 1, 2 ORDER BY casados DESC`,

  // Empenhos sem par na outra fonte, com a pista de duplicidade ou renumeração.
  empenhosSemPar: `${EMPENHOS_CASADOS}
    SELECT CASE WHEN tid IS NULL THEN 'betha' ELSE 'tce' END AS fonte, entidade, ent AS "codigoEntidade", numero,
           to_char(data_empenho, 'YYYY-MM-DD') AS data, coalesce(bv, tv) AS valor,
           CASE WHEN tid IS NULL THEN bl ELSE tl END AS liquidado, ocorrencia::int,
           CASE WHEN tid IS NULL THEN ${OUTRO_NUMERO('tce')} ELSE ${OUTRO_NUMERO('betha')} END AS "numeroNaOutra",
           coalesce(bid, tid) AS id
    FROM m WHERE tid IS NULL OR bid IS NULL ORDER BY 2, 3, ocorrencia`,

  // Lançamentos Betha com o mesmo valor, na mesma entidade e mês, em duas
  // rubricas diferentes: pista para diferenças do tipo "só na Betha".
  receitaRepetida: `
    SELECT a.entidade_codigo ent, ${NAT_BETHA.replace('rubrica', 'a.rubrica')} nat,
           ${NAT_BETHA.replace('rubrica', 'o.rubrica')} outra, a.mes, a.valor_arrecadado_mes v
    FROM receitas a JOIN receitas o
      ON o.coleta_id = a.coleta_id AND o.entidade_codigo = a.entidade_codigo AND o.mes = a.mes
     AND o.valor_arrecadado_mes = a.valor_arrecadado_mes AND left(o.rubrica, 8) <> left(a.rubrica, 8)
    WHERE a.coleta_id = ${coleta('receitas')} AND a.valor_arrecadado_mes >= 1000 AND a.mes <= $2`,

  // Coerência interna da 57153: o arrecadado no mês deve ser a variação do acumulado
  // da mesma rubrica. Quando não é, a consulta mantém um lançamento que o próprio
  // acumulado desconsidera (estorno ou redatação não refletidos na coluna mensal).
  receitaIncoerente: `
    WITH r AS (SELECT entidade_codigo ent, ${NAT_BETHA} nat, mes, valor_arrecadado_mes m,
                      valor_arrecadado_ate_mes - coalesce(lag(valor_arrecadado_ate_mes)
                        OVER (PARTITION BY id_rubrica_betha ORDER BY mes), 0) variacao
               FROM receitas WHERE coleta_id = ${coleta('receitas')} AND mes IS NOT NULL)
    SELECT ent, nat, mes, m - variacao AS excesso FROM r
    WHERE m <> variacao AND mes <= $2 ORDER BY ent, nat, mes`,

  // Câmara: só existe no TCE.
  camara: `
    SELECT count(*)::int AS empenhos, sum(valor_empenhado) AS empenhado, sum(valor_liquidado) AS liquidado,
           sum(valor_pago) AS pago, to_char(max(data_empenho), 'YYYY-MM-DD') AS ultimo
    FROM tcesc_empenhos e JOIN unidades_tce u USING (codigo_ug)
    WHERE coleta_id = ${coleta('tcesc_empenhos')} AND u.entidade_betha IS NULL`,
};

// Até onde o TCE já recebeu dados do exercício. Fora da Câmara, que remete à parte.
const LIMITES = `
  SELECT (SELECT max(mes) FROM tcesc_receitas WHERE coleta_id = ${coleta('tcesc_receitas')}) AS "mesReceita",
         (SELECT to_char(max(data_empenho), 'YYYY-MM-DD') FROM tcesc_empenhos e JOIN unidades_tce u USING (codigo_ug)
          WHERE coleta_id = ${coleta('tcesc_empenhos')} AND u.entidade_betha IS NOT NULL) AS "dataEmpenho"`;

export const CONSULTAS_NECESSARIAS = ['receitas', 'empenhos', 'despesas', 'tcesc_receitas', 'tcesc_empenhos'];

export const lerColetas = (ano: number) => consultar<ColetaDaConferencia>(CONSULTAS.coletas, [ano]);

export async function lerLimites(ano: number): Promise<Limites> {
  const [limites] = await consultar<Limites>(LIMITES, [ano]);
  if (!limites) throw new Error(`Consulta de limites sem linha para ${ano}`);
  return limites;
}

export async function lerDados(ano: number, mes: number | null, dataLimite: string | null) {
  const [despesa, receitaEnt, receitaMes, naturezas, repetidas, incoerentes, empenhos, semPar, [camara]] =
    await Promise.all([
      consultar<DespesaPorEntidade>(CONSULTAS.despesaPorEntidade, [ano]),
      consultar<ReceitaPorEntidade>(CONSULTAS.receitaPorEntidade, [ano, mes]),
      consultar<ReceitaPorMes>(CONSULTAS.receitaPorMes, [ano, mes]),
      consultar<LinhaNatureza>(CONSULTAS.receitaPorNatureza, [ano, mes]),
      consultar<ReceitaRepetida>(CONSULTAS.receitaRepetida, [ano, mes]),
      consultar<ReceitaIncoerente>(CONSULTAS.receitaIncoerente, [ano, mes]),
      consultar<EmpenhosPorEntidade>(CONSULTAS.empenhos, [ano, dataLimite]),
      consultar<EmpenhoSemPar>(CONSULTAS.empenhosSemPar, [ano, dataLimite]),
      consultar<CamaraDaConferencia>(CONSULTAS.camara, [ano]),
    ]);
  if (!camara) throw new Error(`Consulta da Câmara sem linha para ${ano}`);
  return { despesa, receitaEnt, receitaMes, naturezas, repetidas, incoerentes, empenhos, semPar, camara };
}
