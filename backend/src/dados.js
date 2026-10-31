import { pool } from '@orleans-em-dados/db';

export async function anosDisponiveis() {
  const { rows } = await pool.query(
    `SELECT p.ano, bool_and(c.status = 'exemplo') AS exemplo, max(c.finalizado_em) AS atualizado
     FROM publicacoes p JOIN coletas c ON c.id = p.coleta_id
     GROUP BY p.ano ORDER BY p.ano DESC`,
  );
  const { rows: entidades } = await pool.query(
    'SELECT codigo_betha AS codigo, nome, sigla FROM entidades ORDER BY codigo_betha::int = 728 DESC, nome',
  );
  return {
    anos: rows.map((r) => r.ano),
    exemplo: rows.length > 0 && rows.every((r) => r.exemplo),
    atualizadoEm: Object.fromEntries(rows.map((r) => [r.ano, r.atualizado])),
    entidades,
  };
}

// Coleta publicada de uma consulta/ano, com os metadados exibidos no dashboard.
export async function coletaPublicada(chave, ano) {
  const {
    rows: [c],
  } = await pool.query(
    `SELECT c.*, q.id AS consulta_id, q.nome AS consulta_nome, q.url_origem, f.nome AS fonte_nome
     FROM publicacoes p
     JOIN coletas c ON c.id = p.coleta_id
     JOIN consultas q ON q.id = p.consulta_id
     JOIN fontes f ON f.id = q.fonte_id
     WHERE q.chave = $1 AND p.ano = $2`,
    [chave, ano],
  );
  if (!c) return null;

  const { rows: totais } = await pool.query(
    'SELECT campo, titulo, valor_fonte, valor_calculado, diferenca FROM totais_fonte WHERE coleta_id = $1 ORDER BY campo',
    [c.id],
  );

  return {
    coletaId: c.id,
    meta: {
      coletaId: Number(c.id),
      fonte: c.status === 'exemplo' ? 'DADOS FICTÍCIOS — exemplo' : c.fonte_nome,
      consultaId: c.consulta_id,
      consultaNome: c.consulta_nome,
      urlOrigem: c.url_origem,
      ano: c.ano,
      filtro: c.filtro,
      origem: c.origem,
      iniciadoEm: c.iniciado_em,
      coletadoEm: c.finalizado_em,
      totalHits: c.total_hits,
      capturados: c.capturados,
      idsUnicos: c.ids_unicos,
      camposAusentes: c.campos_ausentes,
      status: c.status,
      exemplo: c.status === 'exemplo',
      conferencia: totais.map((t) => ({
        campo: t.campo,
        titulo: t.titulo,
        fonte: t.valor_fonte,
        calculado: t.valor_calculado,
        diferenca: t.diferenca,
      })),
    },
  };
}
