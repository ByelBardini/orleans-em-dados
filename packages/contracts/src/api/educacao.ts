// O caderno de Educação: o bloco que compara Orleans, Santa Catarina e o Brasil, rede com rede.
// As rotas entram com cada aba; aqui fica a forma comum. Falta de dado é nulo, nunca zero.
import { z } from 'zod';

// `federal` existe no banco, mas não é opção do alternador.
export const redeSchema = z.enum(['publica', 'municipal', 'estadual', 'privada', 'todas']);

export const fonteDoBlocoSchema = z.strictObject({ nome: z.string(), url: z.string() });

// O que toda resposta de aba traz: sempre `200`, e o bloco sem coleta vem nulo, com a consulta em `faltando`.
export const camposDaAba = { disponivel: z.boolean(), faltando: z.array(z.string()) };

export const valoresDaRedeSchema = z.strictObject({
  orleans: z.number().nullable(),
  santaCatarina: z.number().nullable(),
  brasil: z.number().nullable(),
});

export const comparacaoSchema = z.strictObject({
  indicador: z.string(),
  etapa: z.string(),
  // Texto: a transição é de dois anos, como `2021-2022`.
  ano: z.string(),
  unidade: z.enum(['%', 'alunos', 'horas', 'indice', 'nota', 'anos']),
  fonte: fonteDoBlocoSchema,
  // A rede sem dado pode faltar, e cada lugar da rede presente é obrigatório.
  porRede: z.partialRecord(redeSchema, valoresDaRedeSchema),
  meta: z.strictObject({ valor: z.number(), referencia: z.string() }).optional(),
});

export type Rede = z.infer<typeof redeSchema>;
export type FonteDoBloco = z.infer<typeof fonteDoBlocoSchema>;
export type ValoresDaRede = z.infer<typeof valoresDaRedeSchema>;
// `Comparacao` já é a forma de /api/municipio.
export type ComparacaoDeEducacao = z.infer<typeof comparacaoSchema>;
