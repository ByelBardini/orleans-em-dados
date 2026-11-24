import { z } from 'zod';
import { entidadeSchema, limitesDaConferenciaSchema, metaSchema, valorSchema } from './comuns';

// `arrecadadoNoMes` é a parte conferida com o TCE-SC, ou a Betha sozinha quando `conferencia.fonteUnica`
// (fictícia, em dados de exemplo). O orçado existe só na Betha: fonte única, nunca conferida. `fonteUnica`
// declara esses campos.
export const receitasSchema = z.strictObject({
  meta: metaSchema,
  fonteUnica: z.tuple([z.literal('orcadoAtualizado'), z.literal('orcadoDeducoes')]),
  // Conferido + em discrepância + aguardando = total da fonte. Sem conferência, tudo nulo.
  conferencia: z
    .strictObject({
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
      // Das que faltam, as que a fonte não publica naquele exercício (o Farol: receitas desde 2018,
      // empenhos desde 2023). Ausente quando não há nenhuma.
      foraDaFonte: z.array(z.string()).optional(),
      // O TCE-SC não publica o exercício: os números são só da Betha, sem conferência.
      fonteUnica: z.boolean(),
      // A Betha publica a receita bruta, antes da dedução do FUNDEB (até 2019); a comparação é bruto × bruto.
      receitaBruta: z.boolean(),
      // No bruto, a dedução que só o TCE-SC registra; nunca somada ao conferido. Nula fora do bruto.
      deducaoSoTce: valorSchema,
      // Entidades com receita no TCE-SC e nenhuma na Betha no exercício: lacuna da fonte, fora da manchete.
      entidadesSemBetha: z.array(z.strictObject({ codigo: z.string(), entidade: z.string(), totalTce: z.number() })),
    })
    .refine((c) => !c.fonteUnica || (c.conferido === null && !c.disponivel), {
      message: 'Fonte única não tem parte conferida',
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
  // `natureza` é o código no formato novo; `rubrica`, como a Betha publica (até 2019, com a classe
  // na frente). Na linha de 8 dígitos não há rubrica publicada: as duas são a natureza.
  naturezas: z.array(
    z.strictObject({
      chave: z.string(),
      rubrica: z.string(),
      natureza: z.string(),
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
