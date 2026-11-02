// Despesa orçamentária (57170). Empenhado, liquidado e pago já líquidos de anulações: é o
// número oficial da execução e o que bate com o TCE-SC. A Câmara não está no portal Betha;
// vem do TCE-SC e é devolvida à parte, nunca somada silenciosamente.
import { consultar, ENTIDADE } from '../../lib/consultas';
import type { ColetaPublicada } from '../coletas/coletas.dao';

export type EntidadeDoCatalogo = { nome: string | null; sigla: string | null; status: string | null };

/** A forma de antes da conferência: só para a coleta de exemplo, que nunca é conferida. */
export async function resumoDespesas(
  { coletaId, meta }: ColetaPublicada,
  { entidade = '', ano }: { entidade?: string; ano: number },
) {
  const [[totais], porEntidade, camara] = await Promise.all([
    consultar(
      `SELECT sum(valor_orcado_atualizado) AS "orcadoAtualizado", sum(valor_empenhado) AS empenhado,
              sum(valor_liquidado) AS liquidado, sum(valor_pago) AS pago
       FROM despesas d WHERE coleta_id = $1 AND ($2 = '' OR d.entidade_codigo = $2)`,
      [coletaId, entidade],
    ),
    consultar(
      `SELECT d.entidade_codigo AS chave, ${ENTIDADE} AS entidade, 'betha' AS fonte, false AS conferida,
              NULL AS "dataCorte", 0 AS "aguardandoTce",
              sum(valor_empenhado) AS empenhado, sum(valor_liquidado) AS liquidado, sum(valor_pago) AS pago
       FROM despesas d LEFT JOIN entidades en ON en.codigo_betha = d.entidade_codigo
       WHERE coleta_id = $1 GROUP BY d.entidade_codigo, en.codigo_betha ORDER BY empenhado DESC`,
      [coletaId],
    ),
    camaraDoAno(ano, true),
  ]);
  return { meta, totais, porEntidade, camara: entidade ? null : camara };
}

/** Só existe no TCE-SC: fonte única, sempre à parte. A coleta de exemplo só vale para exemplo. */
export async function camaraDoAno(ano: number, aceitaExemplo: boolean) {
  const [camara] = await consultar(
    `SELECT u.nome, u.sigla, 'tce' AS fonte, false AS conferida, count(*)::int AS quantidade,
            sum(e.valor_empenhado) AS empenhado, sum(e.valor_liquidado) AS liquidado, sum(e.valor_pago) AS pago,
            to_char(max(e.data_empenho), 'YYYY-MM-DD') AS "ultimoEmpenho", c.finalizado_em AS "coletadoEm",
            q.url_origem AS "urlOrigem"
     FROM publicacoes p
     JOIN consultas q ON q.id = p.consulta_id AND q.chave = 'tcesc_empenhos'
     JOIN coletas c ON c.id = p.coleta_id
     JOIN tcesc_empenhos e ON e.coleta_id = p.coleta_id
     JOIN unidades_tce u ON u.codigo_ug = e.codigo_ug AND u.entidade_betha IS NULL
     WHERE p.ano = $1 AND ($2::boolean OR c.status <> 'exemplo')
     GROUP BY u.nome, u.sigla, c.finalizado_em, q.url_origem`,
    [ano, aceitaExemplo],
  );
  return camara ?? null;
}

/** O orçado existe só na Betha: fonte única, igual em qualquer situação da conferência. */
export async function orcadoDaDespesa(coletaId: number, entidade: string) {
  const [linha] = await consultar<{ orcadoAtualizado: number | null }>(
    `SELECT sum(valor_orcado_atualizado) AS "orcadoAtualizado"
     FROM despesas d WHERE coleta_id = $1 AND ($2 = '' OR d.entidade_codigo = $2)`,
    [coletaId, entidade],
  );
  return linha?.orcadoAtualizado ?? null;
}

export async function catalogoDeEntidades() {
  const linhas = await consultar<{ chave: string; entidade: EntidadeDoCatalogo }>(
    `SELECT en.codigo_betha AS chave, ${ENTIDADE} AS entidade FROM entidades en`,
    [],
  );
  return new Map(linhas.map((l) => [l.chave, l.entidade]));
}
