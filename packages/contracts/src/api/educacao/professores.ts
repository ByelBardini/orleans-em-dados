// GET /api/educacao/professores: quem ensina e como são as turmas. Falta de dado é nulo, nunca zero.
import { z } from 'zod';
import { camposDaAba, comparacaoSchema, fonteDoBlocoSchema } from '../educacao';

const valor = z.number().nullable();

const comparacoesSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  comparacoes: z.array(comparacaoSchema),
});

export const grupoDeAdequacaoSchema = z.enum(['grupo_1', 'grupo_2', 'grupo_3', 'grupo_4', 'grupo_5']);
export const nivelDeRegularidadeSchema = z.enum(['baixa', 'media_baixa', 'media_alta', 'alta']);

// Conta aulas, não pessoas.
const formacaoSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  etapas: z.array(
    z.strictObject({
      etapa: z.string(),
      grupos: z.array(z.strictObject({ grupo: grupoDeAdequacaoSchema, comparacao: comparacaoSchema })),
    }),
  ),
});

// Percentual de escolas: a fonte não publica a contagem, e ela não é deduzida.
const regularidadeSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  niveis: z.array(z.strictObject({ nivel: nivelDeRegularidadeSchema, comparacao: comparacaoSchema })),
});

// Matrículas ÷ docentes da rede municipal, da pesquisa 13. O docente pode contar em mais de uma etapa.
const alunosPorDocenteSchema = z.strictObject({
  fonte: fonteDoBlocoSchema,
  rede: z.literal('municipal'),
  etapas: z.array(
    z.strictObject({
      etapa: z.string(),
      anos: z.array(z.strictObject({ ano: z.string(), matriculas: valor, docentes: valor, alunosPorDocente: valor })),
    }),
  ),
});

// De 1 a 4 pessoas, a fonte só traz o texto "menos de 5".
const pessoasSchema = z.union([z.number(), z.string()]).nullable();
const cargaDoGrupoSchema = z.strictObject({ cargaTemporaria: valor, profissionais: pessoasSchema });

// `periodo` é `AAAA-05`: uma foto de maio, não o exercício.
const temporariosSchema = z.strictObject({
  fonte: fonteDoBlocoSchema,
  anos: z.array(z.strictObject({ periodo: z.string(), magisterio: cargaDoGrupoSchema, outros: cargaDoGrupoSchema })),
});

const medianasDoGrupoSchema = z.strictObject({ todos: valor, efetivo: valor, temporario: valor });

const remuneracaoSchema = z.strictObject({
  fonte: fonteDoBlocoSchema,
  anos: z.array(
    z.strictObject({ periodo: z.string(), magisterio: medianasDoGrupoSchema, outros: medianasDoGrupoSchema }),
  ),
});

// Outra base: docentes localizados na RAIS, em 2021. SC não tem linha municipal, e a rede de cada lugar vem escrita.
const raisSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  linhas: z.array(
    z.strictObject({
      lugar: z.enum(['orleans', 'santaCatarina', 'brasil']),
      rede: z.enum(['municipal', 'publica']),
      mediaPor40h: valor,
      docentes: valor,
    }),
  ),
});

export const educacaoProfessoresSchema = z.strictObject({
  ...camposDaAba,
  turmas: comparacoesSchema.nullable(),
  horas: comparacoesSchema.nullable(),
  formacao: formacaoSchema.nullable(),
  docentesSuperior: comparacoesSchema.nullable(),
  regularidade: regularidadeSchema.nullable(),
  alunosPorDocente: alunosPorDocenteSchema.nullable(),
  temporarios: temporariosSchema.nullable(),
  remuneracao: remuneracaoSchema.nullable(),
  rais: raisSchema.nullable(),
});

export type EducacaoProfessores = z.infer<typeof educacaoProfessoresSchema>;
export type GrupoDeAdequacao = z.infer<typeof grupoDeAdequacaoSchema>;
export type NivelDeRegularidade = z.infer<typeof nivelDeRegularidadeSchema>;
