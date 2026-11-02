// A seção pública das discrepâncias. Nunca leva credor nem histórico, e não leva os avisos internos
// dos registros manuais. Texto neutro: diferença entre fontes não afirma causa.
import { z } from 'zod';
import { limitesDaConferenciaSchema, valorSchema } from './comuns';

const situacaoSchema = z.enum(['confirmada_no_portal', 'confirmada_em_parte', 'calculada', 'rever']);
const areaSchema = z.enum(['receita', 'despesa', 'empenho']);

const etapaSchema = z.strictObject({ betha: valorSchema, tce: valorSchema, diferenca: valorSchema });

const rubricaDoParSchema = z.strictObject({ natureza: z.string(), betha: valorSchema, tce: valorSchema });

const itemSchema = z.strictObject({
  area: areaSchema,
  situacao: situacaoSchema,
  // Quando foi conferido à mão; nulos no que é só cálculo.
  data: z.string().nullable(),
  evidencia: z.string().nullable(),
  entidade: z.string(),
  codigoEntidade: z.string().nullable(),
  natureza: z.string().nullable(),
  descricao: z.string().nullable(),
  mes: z.number().nullable(),
  meses: z.array(
    z.strictObject({ mes: z.number().nullable(), betha: valorSchema, tce: valorSchema, diferenca: z.number() }),
  ),
  // Empenho: de qual fonte é a linha, e como achá-la.
  fonte: z.enum(['betha', 'tce']).nullable(),
  numero: z.number().nullable(),
  dataEmpenho: z.string().nullable(),
  id: z.string().nullable(),
  quantidade: z.number().nullable(),
  betha: valorSchema,
  tce: valorSchema,
  // Betha − TCE. No valor em meses diferentes é zero: a soma do ano é igual.
  diferenca: z.number(),
  diferencaBetha: z.number().nullable(),
  diferencaTce: z.number().nullable(),
  diferencaDaNatureza: z.number().nullable(),
  etapas: z.strictObject({ empenhado: etapaSchema, liquidado: etapaSchema, pago: etapaSchema }).nullable(),
  // Em módulo: é o que soma no `total` do grupo.
  valor: z.number(),
  // Duas rubricas de valores opostos, contadas como um caso: `natureza`, `betha` e `tce` ficam nulos.
  compensacao: z.strictObject({ aMenos: rubricaDoParSchema, aMais: rubricaDoParSchema }).nullable(),
  nota: z.string(),
});

const grupoSchema = z.strictObject({
  tipo: z.enum([
    'fora_do_acumulado',
    'duas_rubricas',
    'mes_diferente',
    'so_tce',
    'reclassificacao',
    'mes_repetido',
    'despesa_duplicada',
    'empenho_sem_execucao',
    'empenho_repetido',
    'empenho_renumerado',
    'empenho_ausente',
    'sem_causa',
  ]),
  // Receita, despesa e empenhos não se somam: `sem_causa` sai num grupo por área.
  area: areaSchema,
  rotulo: z.string(),
  explicacao: z.string(),
  // Soma de `itens[].valor`, em centavos.
  total: z.number(),
  itens: z.array(itemSchema),
});

const somaDaAreaSchema = z.strictObject({ casos: z.number(), total: z.number() });

export const discrepanciasSchema = z.strictObject({
  ano: z.number(),
  disponivel: z.boolean(),
  parcial: z.boolean().nullable(),
  limites: limitesDaConferenciaSchema.nullable(),
  // Só quando não há conferência: as consultas que faltam publicar.
  faltando: z.array(z.string()).optional(),
  grupos: z.array(grupoSchema),
  // Pendência, não discrepância: o que o TCE-SC ainda não recebeu.
  aguardando: z.strictObject({
    rotulo: z.string(),
    explicacao: z.string(),
    receita: z.strictObject({ total: z.number(), itens: z.array(itemSchema) }),
    despesa: z.strictObject({ total: z.number(), quantidade: z.number(), itens: z.array(itemSchema) }),
  }),
  resumo: z.strictObject({
    casos: z.number(),
    porSituacao: z.strictObject({
      confirmada_no_portal: z.number(),
      confirmada_em_parte: z.number(),
      calculada: z.number(),
      rever: z.number(),
    }),
    porArea: z.strictObject({ receita: somaDaAreaSchema, despesa: somaDaAreaSchema, empenho: somaDaAreaSchema }),
  }),
});

export type Discrepancias = z.infer<typeof discrepanciasSchema>;
