import { z } from 'zod';
import { valorSchema } from './comuns';

const camposDeCausa = {
  causa: z.string().nullable(),
  explicada: z.boolean(),
};

const camposDaRubrica = {
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
  ...camposDeCausa,
  // Conhecida: diverge do mesmo lado em outro exercício, sem causa confirmada.
  conhecida: z.literal(true).optional(),
  recorrenteEm: z.array(z.number()).optional(),
};

const camposDoEmpenho = {
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
  ...camposDeCausa,
};

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
    z.strictObject({
      mes: z.number().nullable(),
      betha: valorSchema,
      tce: valorSchema,
      diferenca: valorSchema,
      parcelas: z.array(
        z.strictObject({
          mes: z.number(),
          ent: z.string(),
          entidade: z.string(),
          natureza: z.string(),
          diferenca: z.number(),
        }),
      ),
    }),
  ),
  receitaPorNatureza: z.array(z.strictObject(camposDaRubrica)),
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
  empenhosSemPar: z.array(z.strictObject(camposDoEmpenho)),
  // O que sobra sem padrão que aponte a causa provável.
  semExplicacao: z.array(
    z.discriminatedUnion('onde', [
      z.strictObject({
        onde: z.literal('despesa'),
        entidade: z.string(),
        codigoEntidade: z.string().nullable(),
        titulo: z.string(),
        betha: valorSchema,
        tce: valorSchema,
        diferenca: valorSchema,
        nota: z.string(),
      }),
      z.strictObject({ onde: z.literal('receita'), titulo: z.string(), ...camposDaRubrica }),
      z.strictObject({
        onde: z.literal('empenho'),
        titulo: z.string(),
        ...camposDoEmpenho,
        betha: valorSchema,
        tce: valorSchema,
        diferenca: z.number(),
      }),
    ]),
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
    semExplicacao: z.number(),
    comCausaProvavel: z.number(),
    conhecidas: z.number(),
  }),
});

export type Conferencia = z.infer<typeof conferenciaSchema>;
