// GET /api/educacao/permanencia: como termina o ano, por rede. Falta de dado é nulo, nunca zero.
import { z } from 'zod';
import { camposDaAba, comparacaoSchema, fonteDoBlocoSchema } from '../educacao';

const contagem = z.number().nullable();

const rendimentoSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  etapas: z.array(
    z.strictObject({
      etapa: z.string(),
      aprovacao: comparacaoSchema,
      reprovacao: comparacaoSchema,
      abandono: comparacaoSchema,
    }),
  ),
});

// A matrícula é de Orleans, no ano da taxa. A pública soma municipal, estadual e federal, como a taxa do INEP.
const matriculasDaSerieSchema = z.strictObject({
  publica: contagem,
  municipal: contagem,
  estadual: contagem,
  privada: contagem,
  todas: contagem,
});

const seriesSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  fonteDasMatriculas: fonteDoBlocoSchema,
  series: z.array(
    z.strictObject({
      etapa: z.string(),
      reprovacao: comparacaoSchema,
      abandono: comparacaoSchema,
      matriculas: matriculasDaSerieSchema,
    }),
  ),
});

// `ano` é texto: a evasão é a transição de dois anos, como `2021-2022`.
const comparacoesPorEtapaSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  etapas: z.array(comparacaoSchema),
});

export const educacaoPermanenciaSchema = z.strictObject({
  ...camposDaAba,
  rendimento: rendimentoSchema.nullable(),
  series: seriesSchema.nullable(),
  distorcao: comparacoesPorEtapaSchema.nullable(),
  evasao: comparacoesPorEtapaSchema.nullable(),
});

export type EducacaoPermanencia = z.infer<typeof educacaoPermanenciaSchema>;
