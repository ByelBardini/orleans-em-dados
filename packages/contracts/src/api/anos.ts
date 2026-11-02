import { z } from 'zod';

export const anosSchema = z.strictObject({
  anos: z.array(z.number()),
  exemplo: z.boolean(),
  atualizadoEm: z.record(z.string(), z.string()),
  entidades: z.array(z.strictObject({ codigo: z.string(), nome: z.string(), sigla: z.string() })),
});

export type Anos = z.infer<typeof anosSchema>;
