import { z } from 'zod';
import { entidadeSchema, limitesDaConferenciaSchema, metaSchema, valorSchema } from './comuns';

// `arrecadadoNoMes` é sempre a parte conferida com o TCE-SC (fictícia, em dados de exemplo).
// O orçado existe só na Betha: fonte única, nunca conferida. `fonteUnica` declara esses campos.
export const receitasSchema = z.strictObject({
  meta: metaSchema,
  fonteUnica: z.tuple([z.literal('orcadoAtualizado'), z.literal('orcadoDeducoes')]),
  // Conferido + em discrepância + aguardando = total da fonte. Sem conferência, tudo nulo.
  conferencia: z.strictObject({
    disponivel: z.boolean(),
    parcial: z.boolean().nullable(),
    limites: limitesDaConferenciaSchema.nullable(),
    conferido: valorSchema,
    diferencaBetha: valorSchema,
    diferencaTce: valorSchema,
    aguardandoTce: valorSchema,
    totalBetha: valorSchema,
    totalTce: valorSchema,
    // Só quando não há conferência: as consultas que faltam publicar.
    faltando: z.array(z.string()).optional(),
  }),
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
  // Tabela mista: 14 dígitos quando todos os meses da natureza batem; 8 quando algum diverge.
  naturezas: z.array(
    z.strictObject({
      chave: z.string(),
      rubrica: z.string(),
      nivel: z.union([z.literal(8), z.literal(14)]),
      descricao: z.string(),
      entidade: z.string(),
      quantidade: z.number(),
      orcadoAtualizado: valorSchema,
      arrecadadoNoMes: valorSchema,
    }),
  ),
});

export type Receitas = z.infer<typeof receitasSchema>;
