import { z } from 'zod';
import { entidadeSchema, metaSchema, valorSchema } from './comuns';

export const receitasSchema = z.strictObject({
  meta: metaSchema,
  totais: z.strictObject({
    quantidade: z.number(),
    orcadoAtualizado: valorSchema,
    orcadoDeducoes: valorSchema,
    arrecadadoNoMes: valorSchema,
    negativos: z.number(),
    rubricas: z.number(),
  }),
  // Mês inferido do sufixo do id: nulo quando o registro não tem sufixo.
  porMes: z.array(
    z.strictObject({ chave: z.number().nullable(), quantidade: z.number(), arrecadadoNoMes: valorSchema }),
  ),
  porEntidade: z.array(
    z.strictObject({
      chave: z.string(),
      entidade: entidadeSchema,
      quantidade: z.number(),
      orcadoAtualizado: valorSchema,
      arrecadadoNoMes: valorSchema,
    }),
  ),
  porOrigem: z.array(
    z.strictObject({
      chave: z.string(),
      quantidade: z.number(),
      orcadoAtualizado: valorSchema,
      arrecadadoNoMes: valorSchema,
      descricao: z.string(),
    }),
  ),
  naturezas: z.array(
    z.strictObject({
      chave: z.string(),
      rubrica: z.string(),
      descricao: z.string(),
      entidade: z.string(),
      quantidade: z.number(),
      orcadoAtualizado: valorSchema,
      arrecadadoNoMes: valorSchema,
    }),
  ),
});

export type Receitas = z.infer<typeof receitasSchema>;
