import { z } from 'zod';
import { valorSchema } from './comuns';

export const conferenciaSchema = z.strictObject({
  ano: z.number(),
  disponivel: z.literal(true),
  geradoEm: z.string(),
  parcial: z.boolean(),
  limites: z.strictObject({ mesReceita: z.number().nullable(), dataEmpenho: z.string().nullable() }),
  coletas: z.array(
    z.strictObject({
      chave: z.string(),
      fonte: z.string(),
      nome: z.string(),
      coleta: z.string(),
      coletadoEm: z.string(),
      linhas: z.number(),
      recargaTce: z.string().nullable(),
    }),
  ),
  // Agregação sem GROUP BY: sempre há linha, com somas nulas se a Câmara não tiver empenhos.
  camara: z.strictObject({
    empenhos: z.number(),
    empenhado: valorSchema,
    liquidado: valorSchema,
    pago: valorSchema,
    ultimo: z.string().nullable(),
  }),
  despesaPorEntidade: z.array(
    z.strictObject({
      sigla: z.string(),
      nome: z.string(),
      poder: z.string(),
      entidadeBetha: z.string().nullable(),
      bethaEmpenhado: valorSchema,
      tceEmpenhado: valorSchema,
      difEmpenhado: valorSchema,
      bethaLiquidado: valorSchema,
      tceLiquidado: valorSchema,
      difLiquidado: valorSchema,
      bethaPago: valorSchema,
      tcePago: valorSchema,
      difPago: valorSchema,
      comparavel: z.boolean(),
    }),
  ),
  receitaPorEntidade: z.array(
    z.strictObject({
      sigla: z.string(),
      codigoEntidade: z.string().nullable(),
      betha: valorSchema,
      tce: valorSchema,
      diferenca: z.number(),
      incoerenciaBetha: z.number(),
    }),
  ),
  receitaPorMes: z.array(
    z.strictObject({ mes: z.number().nullable(), betha: valorSchema, tce: valorSchema, diferenca: valorSchema }),
  ),
  receitaPorNatureza: z.array(
    z.strictObject({
      entidade: z.string().nullable(),
      natureza: z.string(),
      descricao: z.string().nullable(),
      betha: valorSchema,
      tce: valorSchema,
      diferenca: z.number(),
      codigoEntidade: z.string().nullable(),
      tipo: z.enum(['valor', 'soBetha', 'soTce']),
      incoerenciaBetha: z.number(),
      nota: z.string(),
    }),
  ),
  receitaIncoerente: z.array(
    z.strictObject({ ent: z.string(), nat: z.string(), mes: z.number(), excesso: z.number() }),
  ),
  empenhos: z.array(
    z.strictObject({
      entidade: z.string().nullable(),
      codigoEntidade: z.string().nullable(),
      betha: z.number(),
      tce: z.number(),
      casados: z.number(),
      soBetha: z.number(),
      valorSoBetha: z.number(),
      soTce: z.number(),
      valorSoTce: z.number(),
    }),
  ),
  empenhosSemPar: z.array(
    z.strictObject({
      fonte: z.enum(['betha', 'tce']),
      entidade: z.string().nullable(),
      codigoEntidade: z.string().nullable(),
      numero: z.number().nullable(),
      data: z.string().nullable(),
      valor: valorSchema,
      liquidado: valorSchema,
      ocorrencia: z.number(),
      numeroNaOutra: z.number().nullable(),
      id: z.string(),
      nota: z.string(),
    }),
  ),
  resumo: z.strictObject({
    despesaEntidadesComparadas: z.number(),
    despesaEntidadesIguais: z.number(),
    receitaBetha: z.number(),
    receitaTce: z.number(),
    receitaDiferenca: z.number(),
    receitaIncoerenteBetha: z.number(),
    naturezasComparadas: z.number(),
    naturezasIguais: z.number(),
    empenhosBetha: z.number(),
    empenhosTce: z.number(),
    empenhosCasados: z.number(),
  }),
});

export type Conferencia = z.infer<typeof conferenciaSchema>;
