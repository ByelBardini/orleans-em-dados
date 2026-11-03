// A despesa por função, da DCA Anexo I-E. O total é conferido com o TCE-SC; a divisão é fonte única.
// Empenhado, liquidado e pago nunca se somam. A Câmara fica à parte, fora do total e da participação.
import { z } from 'zod';
import { metaSchema, valorSchema } from './comuns';
import { pontoDaPopulacaoSchema } from './municipio';

const etapasSchema = z.strictObject({ empenhado: valorSchema, liquidado: valorSchema, pago: valorSchema });

const conferenciaDaFuncaoSchema = z.enum(['conferido', 'diferenca', 'sem_tce']);

const comparacaoSchema = z.strictObject({
  estado: z.enum(['conferido', 'diferenca']),
  etapas: z.array(
    z.strictObject({
      etapa: z.enum(['empenhado', 'liquidado', 'pago']),
      dca: z.number(),
      tce: z.number(),
      // DCA − TCE-SC.
      diferenca: z.number(),
      maior: z.enum(['dca', 'tce']).nullable(),
    }),
  ),
});

const subfuncaoSchema = etapasSchema.extend({ codigo: z.string(), nome: z.string() });

const funcaoSchema = subfuncaoSchema.extend({
  // Em %, sobre o total sem a Câmara da mesma etapa.
  participacao: etapasSchema,
  porMorador: etapasSchema.nullable(),
  subfuncoes: z.array(subfuncaoSchema),
});

const camaraSchema = subfuncaoSchema.extend({ subfuncoes: z.array(subfuncaoSchema) });

export const funcoesSchema = z.strictObject({
  ano: z.number(),
  meta: metaSchema,
  conferencia: conferenciaDaFuncaoSchema,
  // Só com `conferencia: 'diferenca'`: cada comparação tem o próprio estado.
  diferenca: z.strictObject({ total: comparacaoSchema, legislativa: comparacaoSchema }).nullable(),
  total: etapasSchema,
  // A população usada no "por morador"; nula sem a coleta do IBGE.
  divisor: pontoDaPopulacaoSchema.nullable(),
  porMorador: etapasSchema.nullable(),
  funcoes: z.array(funcaoSchema),
  camara: camaraSchema.nullable(),
});

export const funcoesSerieSchema = z.strictObject({
  // Sem correção pela inflação.
  valores: z.literal('nominais'),
  anos: z.array(
    z.strictObject({
      ano: z.number(),
      conferencia: conferenciaDaFuncaoSchema,
      total: etapasSchema,
      funcoes: z.array(subfuncaoSchema.extend({ participacao: etapasSchema })),
      camara: subfuncaoSchema.nullable(),
    }),
  ),
});

export type Funcoes = z.infer<typeof funcoesSchema>;
export type FuncoesSerie = z.infer<typeof funcoesSerieSchema>;
