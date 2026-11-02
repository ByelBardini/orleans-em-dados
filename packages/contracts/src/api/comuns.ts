// Peças repetidas nas respostas da API. Soma sobre recorte vazio é NULL no SQL,
// e NULL é informação da fonte: valor monetário é sempre number | null.
import { z } from 'zod';

export const valorSchema = z.number().nullable();

// Até onde o TCE-SC já recebeu dados do exercício.
export const limitesDaConferenciaSchema = z.strictObject({
  mesReceita: z.number().nullable(),
  dataEmpenho: z.string().nullable(),
});

// JSON do LEFT JOIN com entidades: todos os campos nulos quando o código não está no catálogo.
export const entidadeSchema = z.strictObject({
  nome: z.string().nullable(),
  sigla: z.string().nullable(),
  status: z.string().nullable(),
});

const conferenciaDoTotalizadorSchema = z.strictObject({
  campo: z.string(),
  titulo: z.string().nullable(),
  fonte: valorSchema,
  calculado: valorSchema,
  diferenca: valorSchema,
});

export const metaSchema = z.strictObject({
  coletaId: z.number(),
  fonte: z.string(),
  consultaId: z.number(),
  consultaNome: z.string(),
  urlOrigem: z.string(),
  ano: z.number(),
  filtro: z.record(z.string(), z.unknown()),
  origem: z.string(),
  iniciadoEm: z.string(),
  coletadoEm: z.string(),
  totalHits: z.number(),
  capturados: z.number(),
  idsUnicos: z.number(),
  camposAusentes: z.record(z.string(), z.number()),
  status: z.string(),
  exemplo: z.boolean(),
  conferencia: z.array(conferenciaDoTotalizadorSchema),
});

export type Meta = z.infer<typeof metaSchema>;
