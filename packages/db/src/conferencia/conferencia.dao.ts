// As consultas da conferência. SQL em texto, com o tipo de cada linha declarado: são
// CTEs e FULL JOINs que reaproveitam os parâmetros, e o Postgres é quem soma em NUMERIC.
import { pool } from '../index';
import type {
  CamaraDaConferencia,
  ColetaDaConferencia,
  CruzamentoReceita,
  DespesaCasada,
  DespesaPorEntidade,
  DivergenciaEmOutroAno,
  EmpenhoConferido,
  EmpenhoParaClassificar,
  EmpenhoSemPar,
  EmpenhosAguardando,
  EmpenhosPorEntidade,
  Limites,
  LinhaDeReceita,
  LinhaNatureza,
  Modalidade71,
  ParcelaDoMes,
  ReceitaIncoerente,
  ReceitaPorEntidade,
  ReceitaPorMes,
  ReceitaRepetida,
  ReceitaRepetidaMeses,
  RubricaDaReceita,
  SomaDaEtapa,
  TotaisDasFontes,
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
    WITH b AS (SELECT entidade_codigo ent, numero, data_empenho, valor_empenho v, valor_liquidado l, valor_pago p, saldo_a_pagar s,
                      credor, historico, id_externo,
                      row_number() OVER (PARTITION BY entidade_codigo, numero, data_empenho, valor_empenho
                                         ORDER BY saldo_a_pagar IS NULL, split_part(id_externo, ':', 3)::bigint DESC) ocorrencia
               FROM empenhos WHERE coleta_id = ${coleta('empenhos')} AND ${ATE_DATA}),
         t AS (SELECT u.entidade_betha ent, u.sigla, numero, data_empenho, valor_original v, valor_empenhado e, valor_liquidado l, valor_pago p,
                      credor, historico, id_externo,
                      row_number() OVER (PARTITION BY codigo_ug, numero, data_empenho, valor_original ORDER BY id_externo) ocorrencia
               FROM tcesc_empenhos e JOIN unidades_tce u USING (codigo_ug)
               WHERE coleta_id = ${coleta('tcesc_empenhos')} AND u.entidade_betha IS NOT NULL AND ${ATE_DATA}),
         m AS (SELECT ent, coalesce(t.sigla, en.sigla) AS entidade, numero, data_empenho, v, ocorrencia,
                      b.id_externo bid, t.id_externo tid, b.v bv, t.v tv, t.e te, b.l bl, t.l tl, b.p bp, t.p tp, b.s bs,
                      coalesce(b.credor, t.credor) AS credor, coalesce(b.historico, t.historico) AS historico
               FROM b FULL JOIN t USING (ent, numero, data_empenho, v, ocorrencia)
               LEFT JOIN entidades en ON en.codigo_betha = ent)`;

// As fontes escrevem o mesmo nome de formas diferentes (acento, pontuação, espaços). Vazio não confirma nada.
const CHAVE_DE_TEXTO = (coluna: string) =>
  `nullif(regexp_replace(upper(unaccent(${coluna})), '[^A-Z0-9]', '', 'g'), '')`;
const MESMO_CREDOR_OU_HISTORICO = `(${CHAVE_DE_TEXTO('x.credor')} = ${CHAVE_DE_TEXTO('m.credor')}
          OR ${CHAVE_DE_TEXTO('x.historico')} = ${CHAVE_DE_TEXTO('m.historico')})`;

// Para um empenho sem par, procura na outra fonte o mesmo empenho com outro número. Data e valor
// sozinhos não bastam: dois empenhos no mesmo dia e valor, de credores diferentes, não são o mesmo.
const OUTRO_NUMERO = (fonte: 'tce' | 'betha') =>
  fonte === 'tce'
    ? `(SELECT min(x.numero) FROM tcesc_empenhos x JOIN unidades_tce ux USING (codigo_ug)
        WHERE x.coleta_id = ${coleta('tcesc_empenhos')} AND ux.entidade_betha = m.ent
          AND x.data_empenho = m.data_empenho AND x.valor_original = m.v AND x.numero <> m.numero
          AND ${MESMO_CREDOR_OU_HISTORICO})`
    : `(SELECT min(x.numero) FROM empenhos x
        WHERE x.coleta_id = ${coleta('empenhos')} AND x.entidade_codigo = m.ent
          AND x.data_empenho = m.data_empenho AND x.valor_empenho = m.v AND x.numero <> m.numero
          AND ${MESMO_CREDOR_OU_HISTORICO})`;

// O mesmo número na outra fonte, em qualquer data ou valor.
const NUMERO_NA_OUTRA = (fonte: 'tce' | 'betha') =>
  fonte === 'tce'
    ? `EXISTS (SELECT 1 FROM tcesc_empenhos x JOIN unidades_tce ux USING (codigo_ug)
               WHERE x.coleta_id = ${coleta('tcesc_empenhos')} AND ux.entidade_betha = m.ent AND x.numero = m.numero)`
    : `EXISTS (SELECT 1 FROM empenhos x
               WHERE x.coleta_id = ${coleta('empenhos')} AND x.entidade_codigo = m.ent AND x.numero = m.numero)`;

const CONSULTAS = {
  coletas: `
    SELECT q.chave, q.fonte_id AS fonte, q.nome, c.id AS coleta, c.finalizado_em AS "coletadoEm", c.total_hits AS linhas,
           c.filtro->>'ultimaRecargaApp' AS "recargaTce"
    FROM publicacoes p JOIN consultas q ON q.id = p.consulta_id JOIN coletas c ON c.id = p.coleta_id
    WHERE p.ano = $1 AND c.status <> 'exemplo' AND q.fonte_id IN ('betha', 'tcesc') ORDER BY q.fonte_id, q.chave`,

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

  // Os mesmos empenhos sem par, para a classificação da seção pública: nunca selecione credor nem histórico.
  empenhosParaClassificar: `${EMPENHOS_CASADOS}
    SELECT CASE WHEN tid IS NULL THEN 'betha' ELSE 'tce' END AS fonte, entidade, ent AS "codigoEntidade", numero,
           to_char(data_empenho, 'YYYY-MM-DD') AS data, coalesce(bv, tv) AS valor, ocorrencia::int,
           CASE WHEN tid IS NULL THEN ${OUTRO_NUMERO('tce')} ELSE ${OUTRO_NUMERO('betha')} END AS "numeroNaOutra",
           CASE WHEN tid IS NULL THEN ${NUMERO_NA_OUTRA('tce')} ELSE ${NUMERO_NA_OUTRA('betha')} END AS "numeroExisteNaOutra",
           (tid IS NULL AND bl IS NULL AND bp IS NULL AND bs IS NULL) AS "semExecucao",
           coalesce(bid, tid) AS id
    FROM m WHERE tid IS NULL OR bid IS NULL ORDER BY 2, 3, ocorrencia`,

  // O conjunto casado 1:1, com a execução do TCE-SC de cada empenho.
  empenhosConferidos: `${EMPENHOS_CASADOS}
    SELECT bid AS id, tid AS "idTce", ent AS "codigoEntidade", te AS empenhado, tl AS liquidado, tp AS pago
    FROM m WHERE bid IS NOT NULL AND tid IS NOT NULL ORDER BY ent, numero, ocorrencia`,

  // Diferença de cada mês decomposta por rubrica: o total do mês nunca é a causa,
  // só a soma destas parcelas (inclusive rubricas que batem no ano e mudam de mês).
  receitaMesPorRubrica: `
    WITH b AS (SELECT entidade_codigo ent, ${NAT_BETHA} nat, mes, sum(valor_arrecadado_mes) v
               FROM receitas WHERE coleta_id = ${coleta('receitas')} AND mes <= $2 GROUP BY 1, 2, 3),
         t AS (SELECT u.entidade_betha ent, ${NAT_TCE} nat, mes, sum(valor_arrecadado) v
               FROM tcesc_receitas r JOIN unidades_tce u ON u.nome = r.unidade
               WHERE coleta_id = ${coleta('tcesc_receitas')} AND mes <= $2 GROUP BY 1, 2, 3)
    SELECT mes, ent, coalesce(en.sigla, ent) AS entidade, nat AS natureza, coalesce(b.v, 0) - coalesce(t.v, 0) AS diferenca
    FROM b FULL JOIN t USING (ent, nat, mes) LEFT JOIN entidades en ON en.codigo_betha = ent
    WHERE coalesce(b.v, 0) <> coalesce(t.v, 0)
    ORDER BY mes, abs(coalesce(b.v, 0) - coalesce(t.v, 0)) DESC`,

  // Lançamentos Betha com o mesmo valor, na mesma entidade e mês, em duas
  // rubricas diferentes: pista para diferenças do tipo "só na Betha".
  receitaRepetida: `
    SELECT a.entidade_codigo ent, ${NAT_BETHA.replace('rubrica', 'a.rubrica')} nat,
           ${NAT_BETHA.replace('rubrica', 'o.rubrica')} outra, a.mes, a.valor_arrecadado_mes v
    FROM receitas a JOIN receitas o
      ON o.coleta_id = a.coleta_id AND o.entidade_codigo = a.entidade_codigo AND o.mes = a.mes
     AND o.valor_arrecadado_mes = a.valor_arrecadado_mes AND left(o.rubrica, 8) <> left(a.rubrica, 8)
    WHERE a.coleta_id = ${coleta('receitas')} AND a.valor_arrecadado_mes >= 1000 AND a.mes <= $2`,

  // As linhas da 57153 com o mesmo valor em outra natureza do mês e da entidade, de R$ 1,00 para cima:
  // há repetições pequenas reais, e centavos coincidem por acaso. O casamento 1:1 é da regra.
  receitaLinhasRepetidas: `
    SELECT a.id_externo AS id, a.entidade_codigo ent, ${NAT_BETHA.replace('rubrica', 'a.rubrica')} nat, a.mes, a.valor_arrecadado_mes v
    FROM receitas a
    WHERE a.coleta_id = ${coleta('receitas')} AND a.valor_arrecadado_mes >= 1 AND a.mes <= $2
      AND EXISTS (SELECT 1 FROM receitas o
                  WHERE o.coleta_id = a.coleta_id AND o.entidade_codigo = a.entidade_codigo AND o.mes = a.mes
                    AND o.valor_arrecadado_mes = a.valor_arrecadado_mes AND left(o.rubrica, 8) <> left(a.rubrica, 8))`,

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

  // Mesma rubrica com o mesmo valor em dois meses diferentes na Betha.
  receitaRepetidaMeses: `
    SELECT a.entidade_codigo ent, ${NAT_BETHA.replace('rubrica', 'a.rubrica')} nat, a.mes, o.mes AS "outroMes", a.valor_arrecadado_mes v
    FROM receitas a JOIN receitas o
      ON o.coleta_id = a.coleta_id AND o.entidade_codigo = a.entidade_codigo AND o.mes > a.mes
     AND o.valor_arrecadado_mes = a.valor_arrecadado_mes AND left(o.rubrica, 8) = left(a.rubrica, 8)
    WHERE a.coleta_id = ${coleta('receitas')} AND a.valor_arrecadado_mes >= 1000 AND o.mes <= $2`,

  // A separação da receita: entidade × natureza de 8 dígitos × mês, em todos os meses da Betha.
  // A Câmara fica de fora: é fonte única, sem par para conferir.
  receitaCruzamentos: `
    WITH b AS (SELECT entidade_codigo ent, ${NAT_BETHA} nat, mes, min(descricao) descricao, sum(valor_arrecadado_mes) v
               FROM receitas WHERE coleta_id = ${coleta('receitas')} GROUP BY 1, 2, 3),
         t AS (SELECT u.entidade_betha ent, ${NAT_TCE} nat, mes, min(natureza) descricao, sum(valor_arrecadado) v
               FROM tcesc_receitas r JOIN unidades_tce u ON u.nome = r.unidade
               WHERE coleta_id = ${coleta('tcesc_receitas')} AND u.entidade_betha IS NOT NULL GROUP BY 1, 2, 3)
    SELECT ent, coalesce(en.sigla, ent) AS entidade, nat AS natureza, coalesce(t.descricao, b.descricao) AS descricao,
           mes, b.v AS betha, t.v AS tce
    FROM b FULL JOIN t USING (ent, nat, mes) LEFT JOIN entidades en ON en.codigo_betha = ent
    ORDER BY ent, nat, mes`,

  // As rubricas de 14 dígitos da Betha até o corte, para a natureza em que todos os meses batem.
  receitaRubricas: `
    SELECT entidade_codigo ent, rubrica, min(descricao) descricao, sum(valor_arrecadado_mes) valor
    FROM receitas WHERE coleta_id = ${coleta('receitas')} AND ${MES_BETHA} GROUP BY 1, 2`,

  // O total de cada fonte, somado à parte: é com ele que a conta da separação é conferida.
  receitaTotais: `
    SELECT (SELECT sum(valor_arrecadado_mes) FROM receitas WHERE coleta_id = ${coleta('receitas')}) AS "totalBetha",
           (SELECT sum(valor_arrecadado) FROM tcesc_receitas r JOIN unidades_tce u ON u.nome = r.unidade
            WHERE coleta_id = ${coleta('tcesc_receitas')} AND u.entidade_betha IS NOT NULL) AS "totalTce"`,

  // Modalidade de aplicação 71: dígitos 3-4 da natureza da despesa (33713300000000).
  modalidade71: `
    SELECT entidade_codigo ent, count(*)::int linhas, sum(valor_empenhado) empenhado, sum(valor_liquidado) liquidado,
           sum(valor_pago) pago
    FROM despesas WHERE coleta_id = ${coleta('despesas')} AND substring(natureza FROM 3 FOR 2) = '71' GROUP BY 1`,

  // Ano em curso: líquido do TCE-SC nos empenhos casados até o corte.
  despesaCasada: `${EMPENHOS_CASADOS}
    SELECT ent, count(*)::int casados, sum(te) empenhado, sum(tl) liquidado, sum(tp) pago
    FROM m WHERE bid IS NOT NULL AND tid IS NOT NULL GROUP BY 1`,

  // Empenhos da Betha depois do corte: pendência. $2 NULL: o TCE-SC não recebeu nenhum.
  empenhosAguardando: `
    SELECT entidade_codigo ent, count(*)::int quantidade, sum(valor_empenho) valor
    FROM empenhos WHERE coleta_id = ${coleta('empenhos')} AND ($2::date IS NULL OR data_empenho > $2::date) GROUP BY 1`,

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
  const [
    despesa,
    receitaEnt,
    receitaMes,
    naturezas,
    repetidas,
    incoerentes,
    repetidasMeses,
    mesPorRubrica,
    empenhos,
    semPar,
    [camara],
  ] = await Promise.all([
    consultar<DespesaPorEntidade>(CONSULTAS.despesaPorEntidade, [ano]),
    consultar<ReceitaPorEntidade>(CONSULTAS.receitaPorEntidade, [ano, mes]),
    consultar<ReceitaPorMes>(CONSULTAS.receitaPorMes, [ano, mes]),
    consultar<LinhaNatureza>(CONSULTAS.receitaPorNatureza, [ano, mes]),
    consultar<ReceitaRepetida>(CONSULTAS.receitaRepetida, [ano, mes]),
    consultar<ReceitaIncoerente>(CONSULTAS.receitaIncoerente, [ano, mes]),
    consultar<ReceitaRepetidaMeses>(CONSULTAS.receitaRepetidaMeses, [ano, mes]),
    consultar<ParcelaDoMes>(CONSULTAS.receitaMesPorRubrica, [ano, mes]),
    consultar<EmpenhosPorEntidade>(CONSULTAS.empenhos, [ano, dataLimite]),
    consultar<EmpenhoSemPar>(CONSULTAS.empenhosSemPar, [ano, dataLimite]),
    consultar<CamaraDaConferencia>(CONSULTAS.camara, [ano]),
  ]);
  if (!camara) throw new Error(`Consulta da Câmara sem linha para ${ano}`);
  return {
    despesa,
    receitaEnt,
    receitaMes,
    naturezas,
    repetidas,
    incoerentes,
    repetidasMeses,
    mesPorRubrica,
    empenhos,
    semPar,
    camara,
  };
}

export async function lerReceitaConferida(ano: number, mes: number | null) {
  const [cruzamentos, rubricas, [totais], linhasRepetidas, incoerentes, repetidasMeses] = await Promise.all([
    consultar<CruzamentoReceita>(CONSULTAS.receitaCruzamentos, [ano]),
    consultar<RubricaDaReceita>(CONSULTAS.receitaRubricas, [ano, mes]),
    consultar<TotaisDasFontes>(CONSULTAS.receitaTotais, [ano]),
    consultar<LinhaDeReceita>(CONSULTAS.receitaLinhasRepetidas, [ano, mes]),
    consultar<ReceitaIncoerente>(CONSULTAS.receitaIncoerente, [ano, mes]),
    consultar<ReceitaRepetidaMeses>(CONSULTAS.receitaRepetidaMeses, [ano, mes]),
  ]);
  if (!totais) throw new Error(`Consulta de totais da receita sem linha para ${ano}`);
  return { cruzamentos, rubricas, totais, pistas: { linhasRepetidas, incoerentes, repetidasMeses } };
}

export async function lerDespesaConferida(ano: number, dataCorte: string | null) {
  const [despesa, modalidade71, casadas, aguardando, [camara]] = await Promise.all([
    consultar<DespesaPorEntidade>(CONSULTAS.despesaPorEntidade, [ano]),
    consultar<Modalidade71>(CONSULTAS.modalidade71, [ano]),
    consultar<DespesaCasada>(CONSULTAS.despesaCasada, [ano, dataCorte]),
    consultar<EmpenhosAguardando>(CONSULTAS.empenhosAguardando, [ano, dataCorte]),
    consultar<CamaraDaConferencia>(CONSULTAS.camara, [ano]),
  ]);
  if (!camara) throw new Error(`Consulta da Câmara sem linha para ${ano}`);
  return { despesa, modalidade71, casadas, aguardando, camara };
}

/** `dataCorte` NULL: exercício encerrado, sem corte. */
export const lerEmpenhosParaClassificar = (ano: number, dataCorte: string | null) =>
  consultar<EmpenhoParaClassificar>(CONSULTAS.empenhosParaClassificar, [ano, dataCorte]);

export const lerEmpenhosConferidos = (ano: number, dataCorte: string | null) =>
  consultar<EmpenhoConferido>(CONSULTAS.empenhosConferidos, [ano, dataCorte]);

// A publicação de exemplo nunca é conferida, mas continua dita como exemplo.
export async function temColetaDeExemplo(ano: number) {
  const [linha] = await consultar<{ exemplo: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM publicacoes p JOIN coletas c ON c.id = p.coleta_id
                    WHERE p.ano = $1 AND c.status = 'exemplo') AS exemplo`,
    [ano],
  );
  return linha?.exemplo ?? false;
}

// Exercícios em que as duas fontes de receita estão publicadas, com o último mês recebido pelo TCE.
const ANOS_COMPARAVEIS = `
  SELECT p.ano, (SELECT max(mes) FROM tcesc_receitas r WHERE r.coleta_id = p.coleta_id) AS mes
  FROM publicacoes p JOIN consultas q ON q.id = p.consulta_id JOIN coletas c ON c.id = p.coleta_id
  WHERE q.chave = 'tcesc_receitas' AND c.status <> 'exemplo'
    AND EXISTS (SELECT 1 FROM publicacoes p2 JOIN consultas q2 ON q2.id = p2.consulta_id
                WHERE q2.chave = 'receitas' AND p2.ano = p.ano)
  ORDER BY p.ano`;

// Rubricas que divergem em outros exercícios, por "entidade|natureza": base para dizer
// se uma diferença já é conhecida.
export async function lerDivergenciasEmOutrosAnos(ano: number) {
  const anos = (await consultar<{ ano: number; mes: number }>(ANOS_COMPARAVEIS, [])).filter((a) => a.ano !== ano);
  const porRubrica = new Map<string, DivergenciaEmOutroAno[]>();
  for (const { ano: outro, mes } of anos) {
    for (const r of await consultar<LinhaNatureza>(CONSULTAS.receitaPorNatureza, [outro, mes])) {
      if (r.diferenca === 0) continue;
      const chave = `${r.ent}|${r.natureza}`;
      porRubrica.set(chave, [
        ...(porRubrica.get(chave) ?? []),
        { ano: outro, diferenca: r.diferenca, parcial: mes < 12 },
      ]);
    }
  }
  return porRubrica;
}

// As três etapas nunca se somam. A view só tem o lote publicado.
const SOMAS_DA_DCA = `
  SELECT etapa,
         coalesce(sum(valor) FILTER (WHERE tipo = 'total'), 0)::float8 AS total,
         coalesce(sum(valor) FILTER (WHERE tipo = 'funcao' AND funcao_codigo = '01'), 0)::float8 AS legislativa
  FROM siconfi_funcoes_publicadas
  WHERE ano = $1 AND etapa IN ('empenhado', 'liquidado', 'pago')
  GROUP BY etapa`;

// A Câmara é a unidade do Legislativo em `unidades_tce`. Coleta de exemplo não confere nada.
const SOMAS_DO_TCE_PARA_FUNCOES = `
  SELECT x.etapa,
         coalesce(sum(x.valor) FILTER (WHERE u.poder IS DISTINCT FROM 'Legislativo'), 0)::float8 AS total,
         coalesce(sum(x.valor) FILTER (WHERE u.poder = 'Legislativo'), 0)::float8 AS legislativa
  FROM tcesc_empenhos t
  JOIN coletas c ON c.id = t.coleta_id AND c.status <> 'exemplo'
  LEFT JOIN unidades_tce u ON u.codigo_ug = t.codigo_ug
  CROSS JOIN LATERAL (VALUES ('empenhado', t.valor_empenhado), ('liquidado', t.valor_liquidado), ('pago', t.valor_pago))
    AS x(etapa, valor)
  WHERE t.coleta_id = ${coleta('tcesc_empenhos')}
  GROUP BY x.etapa`;

export const lerSomasDaDca = (ano: number) => consultar<SomaDaEtapa>(SOMAS_DA_DCA, [ano]);
export const lerSomasDoTceParaFuncoes = (ano: number) => consultar<SomaDaEtapa>(SOMAS_DO_TCE_PARA_FUNCOES, [ano]);
