// Grava um snapshot ({ meta, registros }) no banco, numa única transação:
// coleta → totalizadores → registros brutos → tabela normalizada → publicação.
// Coletas rejeitadas são gravadas para análise, mas nunca publicadas.

import { createHash } from 'node:crypto';
import { transacao } from '@orleans-em-dados/db';

// Normalização a partir do JSON bruto, direto em SQL: os valores vão de JSON para
// NUMERIC sem passar por ponto flutuante.
const NORMALIZAR = {
  57153: `
    INSERT INTO receitas (
      coleta_id, id_externo, ano, entidade_codigo, id_rubrica_betha, mes, rubrica, descricao,
      valor_orcado, valor_orcado_deducoes, valor_orcado_atualizado, valor_lancado_mes,
      valor_arrecadado_mes, valor_arrecadado_ate_mes, percentual_realizado)
    SELECT coleta_id, id_externo, $2, split_part(id_externo, ':', 2), split_part(id_externo, '_', 1),
      NULLIF(split_part(id_externo, '_', 2), '')::smallint,
      payload->>'rubricaNatureza', payload->>'descricaoNatureza',
      (payload->>'valorOrcado')::numeric, (payload->>'valorOrcadoDeducoes')::numeric,
      (payload->>'valorOrcadoAtualizado')::numeric, (payload->>'valorLancadoNoMes')::numeric,
      (payload->>'valorArrecadadoNoMes')::numeric, (payload->>'valorArrecadadoAteMes')::numeric,
      (payload->>'percentualRealizado')::numeric
    FROM registros_brutos WHERE coleta_id = $1`,
  57140: `
    INSERT INTO empenhos (
      coleta_id, id_externo, ano, entidade_codigo, numero, data_empenho, orgao, credor, historico,
      valor_empenho, valor_liquidado, valor_pago, saldo_a_pagar)
    SELECT coleta_id, id_externo, $2, split_part(id_externo, ':', 2),
      (payload->>'numeroEmpenho')::integer, (payload->>'dataEmpenho')::date,
      payload->>'descricaoOrgao', payload->'credor'->>'nomeCredor', payload->>'historicoEmpenho',
      (payload->>'valorEmpenho')::numeric, (payload->>'valorLiquidadoEmpenho')::numeric,
      (payload->>'valorPagoEmpenho')::numeric, (payload->>'saldoAPagar')::numeric
    FROM registros_brutos WHERE coleta_id = $1`,
};

export async function gravarColeta({ meta, registros }, origem) {
  const normalizar = NORMALIZAR[meta.consultaId];
  if (!normalizar) throw new Error(`Consulta ${meta.consultaId} sem normalização definida`);

  const hash = createHash('sha256').update(JSON.stringify(registros)).digest('hex');

  return transacao(async (c) => {
    const {
      rows: [{ id: coletaId }],
    } = await c.query(
      `INSERT INTO coletas (consulta_id, ano, filtro, iniciado_em, finalizado_em, origem, status,
         total_hits, capturados, ids_unicos, campos_ausentes, erros, hash_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        meta.consultaId,
        meta.ano,
        meta.filtro,
        meta.iniciadoEm,
        meta.coletadoEm,
        origem,
        meta.status,
        meta.totalHits,
        meta.capturados,
        meta.idsUnicos,
        meta.camposAusentes ?? {},
        JSON.stringify(meta.erros ?? []),
        hash,
      ],
    );

    for (const t of meta.conferencia ?? []) {
      await c.query(
        `INSERT INTO totais_fonte (coleta_id, campo, titulo, descricao, valor_fonte, valor_calculado, diferenca)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [coletaId, t.campo, t.titulo ?? null, t.descricao ?? null, t.fonte, t.calculado, t.diferenca],
      );
    }

    // Um único parâmetro JSON expandido no servidor, em vez de milhares de INSERTs.
    await c.query(
      `INSERT INTO registros_brutos (coleta_id, id_externo, payload)
       SELECT $1, r->>'id', r - 'id' FROM jsonb_array_elements($2::jsonb) AS r`,
      [coletaId, JSON.stringify(registros)],
    );
    await c.query(normalizar, [coletaId, meta.ano]);

    // Exemplo só é publicado se ainda não houver dado real publicado para o ano.
    let publicada = false;
    if (meta.status === 'totalizador_conciliado' || meta.status === 'exemplo') {
      const { rowCount } = await c.query(
        `INSERT INTO publicacoes (consulta_id, ano, coleta_id) VALUES ($1, $2, $3)
         ON CONFLICT (consulta_id, ano) DO UPDATE
           SET coleta_id = EXCLUDED.coleta_id, publicado_em = now()
           WHERE $4 OR (SELECT status FROM coletas WHERE id = publicacoes.coleta_id) = 'exemplo'`,
        [meta.consultaId, meta.ano, coletaId, meta.status !== 'exemplo'],
      );
      publicada = rowCount > 0;
    }

    return { coletaId, publicada };
  });
}
