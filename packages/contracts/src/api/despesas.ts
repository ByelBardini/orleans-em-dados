import { z } from 'zod';
import { entidadeSchema, limitesDaConferenciaSchema, metaSchema, valorSchema } from './comuns';

// Só as entidades conferidas entram em `totais`. O orçado existe só na Betha: fonte única.
export const despesasResumoSchema = z.strictObject({
  meta: metaSchema,
  fonteUnica: z.tuple([z.literal('orcadoAtualizado')]),
  conferencia: z.strictObject({
    disponivel: z.boolean(),
    parcial: z.boolean().nullable(),
    limites: limitesDaConferenciaSchema.nullable(),
    aguardandoTce: valorSchema,
    entidadesConferidas: z.number().nullable(),
    entidadesFora: z.number().nullable(),
    // Só quando não há conferência: as consultas que faltam publicar.
    faltando: z.array(z.string()).optional(),
  }),
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
      // `betha_57170` no encerrado, `tce` no ano em curso, nulo se não conferida; `betha` só em exemplo.
      fonte: z.string().nullable(),
      conferida: z.boolean(),
      dataCorte: z.string().nullable(),
      aguardandoTce: z.number(),
      empenhado: valorSchema,
      liquidado: valorSchema,
      pago: valorSchema,
    }),
  ),
  // Só existe no TCE-SC, sem conferência; nulo no recorte por entidade ou sem a coleta do TCE-SC.
  camara: z
    .strictObject({
      nome: z.string(),
      sigla: z.string(),
      fonte: z.literal('tce'),
      conferida: z.literal(false),
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
