import { z } from 'zod';
import { entidadeSchema, metaSchema, valorSchema } from './comuns';

// `empenhado` é o valor original da Betha (conceito da 57140). Liquidado, pago e saldo são do TCE-SC,
// e `empenhadoLiquido` é o empenhado do TCE-SC (nulo em dados de exemplo).
const somasSchema = {
  quantidade: z.number(),
  empenhado: valorSchema,
  empenhadoLiquido: valorSchema,
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
  empenhadoLiquido: valorSchema,
  pago: valorSchema,
};

export const empenhosResumoSchema = z.strictObject({
  meta: metaSchema,
  conferencia: z.strictObject({
    disponivel: z.boolean(),
    parcial: z.boolean().nullable(),
    dataCorte: z.string().nullable(),
    // Só quando não há conferência: as consultas que faltam publicar.
    faltando: z.array(z.string()).optional(),
  }),
  totais: z.strictObject({
    ...somasSchema,
    semValoresDeExecucao: z.number(),
    semValoresDeExecucaoValor: z.number(),
    saldoAPagar: z.number(),
    comSaldoAPagar: z.number(),
    credores: z.number(),
    // Registros da 57140 no recorte que ficaram fora da lista: sem par 1:1 ou depois do corte.
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
