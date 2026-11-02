// Situação pública dos importadores. A mensagem de erro da execução não sai daqui:
// fica no banco, para quem mantém as coletas.
import { INDICADORES } from '@orleans-em-dados/contracts';
import { consultar } from '../../lib/consultas';

export async function situacaoDosImportadores() {
  const ids = [...new Set(INDICADORES.map((i) => i.importador))].sort();

  const [execucoes, exercicios] = await Promise.all([
    consultar<{ importador: string }>(
      `SELECT DISTINCT ON (importador) importador, ano, status, iniciado_em AS "iniciadoEm",
              finalizado_em AS "finalizadoEm", linhas_lidas AS "linhasLidas", linhas_gravadas AS "linhasGravadas"
       FROM execucoes ORDER BY importador, iniciado_em DESC, id DESC`,
      [],
    ),
    // A data do conjunto é a da consulta mais antiga: é o quanto ele inteiro está atualizado.
    consultar<{ fonte: string; ano: number; atualizadoEm: Date }>(
      `SELECT q.fonte_id AS fonte, p.ano, min(c.finalizado_em) AS "atualizadoEm"
       FROM publicacoes p
       JOIN consultas q ON q.id = p.consulta_id
       JOIN coletas c ON c.id = p.coleta_id
       WHERE c.status <> 'exemplo'
       GROUP BY q.fonte_id, p.ano ORDER BY p.ano DESC`,
      [],
    ),
  ]);

  return {
    importadores: ids.map((id) => {
      const execucao = execucoes.find((e) => e.importador === id);
      const { importador: _id, ...ultimaExecucao } = execucao ?? { importador: id };
      return {
        id,
        ultimaExecucao: execucao ? ultimaExecucao : null,
        exercicios: exercicios.filter((e) => e.fonte === id).map(({ ano, atualizadoEm }) => ({ ano, atualizadoEm })),
      };
    }),
  };
}
