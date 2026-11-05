// GET /api/educacao/discrepancias: onde as fontes da educação registram valores diferentes, em todos os exercícios.
// Fora de /api/discrepancias?ano: não depende do filtro de ano, nem entra na conta do ano. Nenhum campo diz a causa.
import { z } from 'zod';
import { camposDaAba } from '../educacao';

const ladoSchema = z.strictObject({ valor: z.number().nullable(), percentual: z.number().nullable() });

const fonteDoLadoSchema = z.strictObject({
  // `coluna` é o cabeçalho da tabela, e `lado` completa "a mais ...".
  coluna: z.string(),
  lado: z.string(),
  nome: z.string(),
  url: z.string(),
});

const casoSchema = z.strictObject({
  ano: z.number().int(),
  item: z.string(),
  a: ladoSchema,
  b: ladoSchema,
  // Em módulo: `maior` diz o lado. Sem o valor de uma fonte, os dois são nulos, e só os percentuais ficam lado a lado.
  diferenca: z.number().nullable(),
  maior: z.enum(['a', 'b']).nullable(),
  nota: z.string().nullable(),
});

const grupoSchema = z.strictObject({
  id: z.enum(['indices', 'gasto_total', 'gasto_acoes']),
  rotulo: z.string(),
  explicacao: z.string(),
  fonteA: fonteDoLadoSchema,
  fonteB: fonteDoLadoSchema,
  casos: z.array(casoSchema).min(1),
});

export const educacaoDiscrepanciasSchema = z.strictObject({ ...camposDaAba, grupos: z.array(grupoSchema) });

export type EducacaoDiscrepancias = z.infer<typeof educacaoDiscrepanciasSchema>;
