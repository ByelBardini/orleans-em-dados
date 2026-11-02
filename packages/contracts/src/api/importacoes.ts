import { z } from 'zod';

// Resposta pública: a mensagem de erro da execução fica só no banco.
export const importacoesSchema = z.strictObject({
  importadores: z.array(
    z.strictObject({
      id: z.string(),
      ultimaExecucao: z
        .strictObject({
          ano: z.number(),
          status: z.enum(['em_andamento', 'sucesso', 'rejeitada', 'falhou']),
          iniciadoEm: z.string(),
          finalizadoEm: z.string().nullable(),
          linhasLidas: z.number(),
          linhasGravadas: z.number(),
        })
        .nullable(),
      exercicios: z.array(z.strictObject({ ano: z.number(), atualizadoEm: z.string() })),
    }),
  ),
});

export type Importacoes = z.infer<typeof importacoesSchema>;
