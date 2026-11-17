import { z } from 'zod';

// O healthcheck do Coolify: o processo está de pé e o banco responde.
export const saudeSchema = z.strictObject({ ok: z.boolean() });

export type Saude = z.infer<typeof saudeSchema>;
