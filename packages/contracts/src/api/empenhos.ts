import { z } from 'zod';
import { entidadeSchema, metaSchema, valorSchema } from './comuns';

const somasSchema = {
  quantidade: z.number(),
  empenhado: valorSchema,
  liquidado: valorSchema,
  pago: valorSchema,
};

// Número é obrigatório na tabela; o resto pode faltar na fonte. Credor pode ser pessoa física.
const empenhoBaseSchema = {
  id: z.string(),
  entidade: z.string(),
  numero: z.number(),
  data: z.string().nullable(),
  orgao: z.string().nullable(),
  credor: z.string().nullable(),
  historico: z.string().nullable(),
  empenhado: valorSchema,
  pago: valorSchema,
};

export const empenhosResumoSchema = z.strictObject({
  meta: metaSchema,
  totais: z.strictObject({
    ...somasSchema,
    semValoresDeExecucao: z.number(),
    semValoresDeExecucaoValor: z.number(),
    saldoAPagar: z.number(),
    comSaldoAPagar: z.number(),
    credores: z.number(),
    excluidos: z.number(),
  }),
  porMes: z.array(z.strictObject({ chave: z.number().nullable(), ...somasSchema })),
  porEntidade: z.array(z.strictObject({ chave: z.string(), entidade: entidadeSchema, ...somasSchema })),
  porOrgao: z.array(z.strictObject({ chave: z.string().nullable(), nome: z.string().nullable(), ...somasSchema })),
  porCredor: z.array(
    z.strictObject({
      chave: z.string(),
      nome: z.string(),
      orgaoPrincipal: z.string().nullable(),
      ...somasSchema,
    }),
  ),
  maiores: z.array(z.strictObject(empenhoBaseSchema)),
});

export const empenhosBuscaSchema = z.strictObject({
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  itens: z.array(z.strictObject({ ...empenhoBaseSchema, liquidado: valorSchema, saldoAPagar: valorSchema })),
});

export type EmpenhosResumo = z.infer<typeof empenhosResumoSchema>;
export type EmpenhosBusca = z.infer<typeof empenhosBuscaSchema>;
