// Peças das rotas: leitura da query e resposta validada pelo contrato.
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

export type Query = Record<string, string | string[] | undefined>;

/** Primeiro valor do parâmetro, ou nulo: `?ano=2025&ano=2026` vale 2025. */
export function parametro(request: FastifyRequest, nome: string): string | null {
  const valor = (request.query as Query)[nome];
  return (Array.isArray(valor) ? valor[0] : valor) ?? null;
}

export const texto = (request: FastifyRequest, nome: string) => parametro(request, nome) ?? '';

/** A resposta passa pelo schema do contrato, o mesmo que a tela usa: desvio vira erro aqui, não lá. */
export function responder<S extends z.ZodType>(reply: FastifyReply, schema: S, corpo: unknown) {
  // Datas e o resto do que o JSON transforma, antes de validar.
  return reply.send(schema.parse(JSON.parse(JSON.stringify(corpo))));
}

export function responderCsv(reply: FastifyReply, nomeDoArquivo: string, csv: string) {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${nomeDoArquivo}"`)
    .send(csv);
}
