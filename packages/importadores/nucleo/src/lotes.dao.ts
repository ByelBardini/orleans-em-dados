// Os lotes no Postgres. Gravar é uma transação (coleta, totalizadores, bruto, linhas);
// publicar é só trocar o ponteiro em `publicacoes`.
import { db, tabelas } from '@orleans-em-dados/db';
import { and, eq, sql } from 'drizzle-orm';
import type { Lote, RepositorioDeLotes, ResultadoDaExecucao } from './importador';

// O Postgres aceita até 65.535 parâmetros por comando; a tabela mais larga tem 15 colunas.
const LINHAS_POR_INSERT = 1000;

function resumoDosErros(resultado: ResultadoDaExecucao): string | null {
  const erros = resultado.consultas.flatMap((c) => c.erros.map((erro) => `${c.chave}: ${erro}`));
  return erros.length ? erros.join('; ') : null;
}

export class RepositorioDeLotesPostgres implements RepositorioDeLotes {
  async abrirExecucao(importador: string, ano: number, inicio: Date): Promise<number> {
    const [execucao] = await db
      .insert(tabelas.execucoes)
      .values({ importador, ano, iniciadoEm: inicio })
      .returning({ id: tabelas.execucoes.id });
    if (!execucao) throw new Error(`Execução de ${importador} (${ano}) não foi registrada`);
    return execucao.id;
  }

  async fecharExecucao(id: number, resultado: ResultadoDaExecucao, fim: Date): Promise<void> {
    await db
      .update(tabelas.execucoes)
      .set({
        finalizadoEm: fim,
        status: resultado.status,
        linhasLidas: resultado.consultas.reduce((soma, c) => soma + c.linhasLidas, 0),
        linhasGravadas: resultado.consultas.reduce((soma, c) => soma + c.linhasGravadas, 0),
        erro: resumoDosErros(resultado),
        detalhes: resultado.consultas,
      })
      .where(eq(tabelas.execucoes.id, id));
  }

  async publicada(consultaId: number, ano: number) {
    const [atual] = await db
      .select({ coletaId: tabelas.publicacoes.coletaId, hash: tabelas.coletas.hashPayload })
      .from(tabelas.publicacoes)
      .innerJoin(tabelas.coletas, eq(tabelas.coletas.id, tabelas.publicacoes.coletaId))
      .where(and(eq(tabelas.publicacoes.consultaId, consultaId), eq(tabelas.publicacoes.ano, ano)));
    return atual ?? null;
  }

  async reconfirmar(coletaId: number, coletadoEm: Date): Promise<void> {
    await db.update(tabelas.coletas).set({ finalizadoEm: coletadoEm }).where(eq(tabelas.coletas.id, coletaId));
  }

  async gravar(lote: Lote): Promise<number> {
    return db.transaction(async (tx) => {
      const [coleta] = await tx
        .insert(tabelas.coletas)
        .values({
          consultaId: lote.consultaId,
          ano: lote.ano,
          filtro: lote.filtro,
          iniciadoEm: lote.iniciadoEm,
          finalizadoEm: lote.coletadoEm,
          origem: lote.origem,
          status: lote.status,
          totalHits: lote.totalHits,
          capturados: lote.capturados,
          idsUnicos: lote.idsUnicos,
          camposAusentes: lote.camposAusentes,
          erros: lote.erros,
          hashPayload: lote.hash,
        })
        .returning({ id: tabelas.coletas.id });
      if (!coleta) throw new Error(`Coleta da consulta ${lote.consultaId} não foi registrada`);
      const coletaId = coleta.id;

      if (lote.conferencia.length) {
        await tx.insert(tabelas.totaisFonte).values(
          lote.conferencia.map((item) => ({
            coletaId,
            campo: item.campo,
            titulo: item.titulo ?? null,
            descricao: item.descricao ?? null,
            valorFonte: item.fonte,
            valorCalculado: item.calculado,
            diferenca: item.diferenca,
          })),
        );
      }

      // Um único parâmetro JSON expandido no servidor, em vez de milhares de INSERTs.
      // IDs repetidos só ocorrem em lote rejeitado; fica a primeira ocorrência.
      await tx.execute(sql`
        INSERT INTO registros_brutos (coleta_id, id_externo, payload)
        SELECT ${coletaId}::bigint, r->>'id', r - 'id' FROM jsonb_array_elements(${JSON.stringify(lote.registros)}::jsonb) AS r
        ON CONFLICT (coleta_id, id_externo) DO NOTHING`);

      for (let i = 0; i < lote.linhas.length; i += LINHAS_POR_INSERT) {
        const bloco = lote.linhas.slice(i, i + LINHAS_POR_INSERT).map((l) => ({ ...l, coletaId, ano: lote.ano }));
        await tx.insert(lote.tabela).values(bloco as never);
      }
      return coletaId;
    });
  }

  // Exemplo só é publicado se ainda não houver dado real publicado para o ano.
  async publicar(lote: Lote, coletaId: number): Promise<boolean> {
    const real = lote.status !== 'exemplo';
    const resultado = await db.execute(sql`
      INSERT INTO publicacoes (consulta_id, ano, coleta_id) VALUES (${lote.consultaId}, ${lote.ano}, ${coletaId})
      ON CONFLICT (consulta_id, ano) DO UPDATE
        SET coleta_id = EXCLUDED.coleta_id, publicado_em = now()
        WHERE ${real}::boolean OR (SELECT status FROM coletas WHERE id = publicacoes.coleta_id) = 'exemplo'`);
    return (resultado.rowCount ?? 0) > 0;
  }
}
