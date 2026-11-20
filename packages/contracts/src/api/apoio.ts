import { z } from 'zod';

// O Pix do apoio ao projeto (`GET /api/apoio`): a chave, quem recebe e o "copia e cola" do QR estático.
export const apoioSchema = z.strictObject({
  chave: z.string(),
  nome: z.string(),
  cidade: z.string(),
  copiaECola: z.string(),
});

export type Apoio = z.infer<typeof apoioSchema>;
