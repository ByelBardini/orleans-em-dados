// O retrato da cidade, com os indicadores do IBGE. Cada bloco traz o próprio ano: nenhum é "o atual".
import { z } from 'zod';

export const pontoDaPopulacaoSchema = z.strictObject({
  ano: z.number(),
  populacao: z.number(),
  tipo: z.enum(['censo', 'estimativa']),
});

const anoDoPibSchema = z.strictObject({
  ano: z.number(),
  // Em mil reais, como o IBGE publica.
  pib: z.number(),
  // Em reais por pessoa; `divisor` diz qual população foi usada.
  perCapita: z.number().nullable(),
  divisor: pontoDaPopulacaoSchema.nullable(),
  // Nula enquanto o IBGE não publica a composição do ano; nunca zero.
  composicao: z
    .strictObject({
      agropecuaria: z.number(),
      industria: z.number(),
      servicos: z.number(),
      administracao: z.number(),
      impostos: z.number(),
    })
    .nullable(),
});

// Os mesmos indicadores em cada lugar, calculados do mesmo jeito. Percentuais de 0 a 100.
const indicadoresDoLugarSchema = z.strictObject({
  densidade: z.number(),
  urbana: z.number(),
  ate14Anos: z.number(),
  aPartirDe60Anos: z.number(),
  // Entre os dois censos; nulo sem o censo anterior.
  crescimento: z.number().nullable(),
  rendimentoMedio: z.number(),
  rendimentoMediano: z.number(),
  pibPerCapita: z.number().nullable(),
});

// Orleans ao lado de Santa Catarina e do Brasil, no mesmo ano. Os dois são o total do estado e do país, não a média
// simples dos municípios. Nula enquanto a comparação não foi coletada: o retrato da cidade não depende dela.
const comparacaoSchema = z.strictObject({
  coletadoEm: z.string(),
  anoDoCenso: z.number(),
  anoDoCensoAnterior: z.number(),
  // O último ano com PIB nos três lugares.
  anoDoPib: z.number().nullable(),
  orleans: indicadoresDoLugarSchema,
  santaCatarina: indicadoresDoLugarSchema,
  brasil: indicadoresDoLugarSchema,
});

const municipioDisponivelSchema = z.strictObject({
  disponivel: z.literal(true),
  meta: z.strictObject({ fonte: z.string(), urlOrigem: z.string(), coletadoEm: z.string() }),
  populacao: z.strictObject({ serie: z.array(pontoDaPopulacaoSchema) }),
  territorio: z.strictObject({ ano: z.number(), areaKm2: z.number(), densidade: z.number() }),
  situacao: z.strictObject({ ano: z.number(), total: z.number(), urbana: z.number(), rural: z.number() }),
  piramide: z.strictObject({
    ano: z.number(),
    total: z.number(),
    faixas: z.array(z.strictObject({ faixa: z.string(), homens: z.number(), mulheres: z.number() })),
  }),
  // Rendimento domiciliar per capita, em reais por mês.
  rendimento: z.strictObject({ ano: z.number(), medio: z.number(), mediano: z.number() }),
  pib: z.strictObject({ serie: z.array(anoDoPibSchema), ultimoAnoDaComposicao: z.number().nullable() }),
  comparacao: comparacaoSchema.nullable(),
});

export const municipioSchema = z.discriminatedUnion('disponivel', [
  municipioDisponivelSchema,
  z.strictObject({ disponivel: z.literal(false), faltando: z.array(z.string()) }),
]);

export type Municipio = z.infer<typeof municipioSchema>;
export type MunicipioDisponivel = z.infer<typeof municipioDisponivelSchema>;
export type Comparacao = z.infer<typeof comparacaoSchema>;
export type IndicadoresDoLugar = z.infer<typeof indicadoresDoLugarSchema>;
