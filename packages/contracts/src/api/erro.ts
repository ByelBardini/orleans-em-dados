import { z } from 'zod';

export const erroSchema = z.strictObject({
  erro: z.string(),
  // Só na conferência indisponível: as consultas que faltam publicar.
  faltando: z.array(z.string()).optional(),
});

export type ErroDaApi = z.infer<typeof erroSchema>;
