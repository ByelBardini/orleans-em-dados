import { z } from 'zod';
import { entidadeSchema, metaSchema, valorSchema } from './comuns';

export const despesasResumoSchema = z.strictObject({
  meta: metaSchema,
  totais: z.strictObject({
    orcadoAtualizado: valorSchema,
    empenhado: valorSchema,
    liquidado: valorSchema,
    pago: valorSchema,
  }),
  porEntidade: z.array(
    z.strictObject({
      chave: z.string(),
      entidade: entidadeSchema,
      fonte: z.string(),
      empenhado: valorSchema,
      liquidado: valorSchema,
      pago: valorSchema,
    }),
  ),
  // Só existe no TCE-SC; nulo no recorte por entidade ou sem a coleta do TCE-SC.
  camara: z
    .strictObject({
      nome: z.string(),
      sigla: z.string(),
      quantidade: z.number(),
      empenhado: valorSchema,
      liquidado: valorSchema,
      pago: valorSchema,
      ultimoEmpenho: z.string().nullable(),
      coletadoEm: z.string(),
      urlOrigem: z.string(),
    })
    .nullable(),
});

export type DespesasResumo = z.infer<typeof despesasResumoSchema>;
