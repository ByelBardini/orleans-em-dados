// GET /api/educacao/resumo: as seis perguntas e "quem cuida de quê", lidas das outras abas. Sempre o último ano, um
// número por pergunta, na rede pública ou na rede que a fonte tem, escrita em `rede`. Falta de dado é nulo, nunca zero.
import { z } from 'zod';
import { camposDaAba, fonteDoBlocoSchema, redeSchema, valoresDaRedeSchema } from '../educacao';

const valor = z.number().nullable();

const cartaoSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  rede: redeSchema,
  valores: valoresDaRedeSchema,
});

// Orleans é a rede municipal, e SC e o Brasil, a pública: a fonte não abre a mesma rede nos três lugares.
const alfabetizacaoSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  redes: z.strictObject({
    orleans: redeSchema.nullable(),
    santaCatarina: redeSchema.nullable(),
    brasil: redeSchema.nullable(),
  }),
  valores: valoresDaRedeSchema,
  metaDeOrleans: z.union([z.number(), z.string()]).nullable(),
});

const crecheSchema = z.strictObject({
  ...cartaoSchema.shape,
  anoAnterior: z.string(),
  fonteAnterior: fonteDoBlocoSchema,
  orleansNoAnoAnterior: valor,
});

// O que a Prefeitura informou ao MEC, nas palavras do painel. Não é contagem de crianças.
const procuraPorCrecheSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  solicitacoesNaoAtendidas: z.string().nullable(),
});

const abandonoSchema = z.strictObject({
  ...cartaoSchema.shape,
  anosIniciais: valoresDaRedeSchema.nullable(),
  anosFinais: valoresDaRedeSchema.nullable(),
});

// Exercício encerrado mais recente com valor. O selo do gasto segue `conferencia`, como na aba Dinheiro.
const gastoSchema = z.strictObject({
  ano: z.number(),
  fonte: fonteDoBlocoSchema,
  liquidado: z.number(),
  conferencia: z.enum(['conferido', 'diferenca', 'sem_betha']),
  igualAoAnexo8: z.boolean(),
  porMorador: valor,
  divisor: z.strictObject({ ano: z.number(), populacao: z.number(), tipo: z.enum(['censo', 'estimativa']) }).nullable(),
});

const minimoSchema = z.strictObject({
  ano: z.number(),
  fonte: fonteDoBlocoSchema,
  percentual: z.number(),
  aplicado: valor,
  minimo: z.number(),
  siconfi: z.strictObject({ percentual: valor, valor }).nullable(),
  difereDoSiconfi: z.boolean(),
});

// `total` é a soma das etapas, da creche ao ensino médio. As redes dizem quem atende cada etapa.
const matriculasSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  total: z.number(),
  etapas: z.array(
    z.strictObject({
      etapa: z.string(),
      total: valor,
      municipal: valor,
      estadual: valor,
      federal: valor,
      privada: valor,
    }),
  ),
});

const superiorSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  instituicao: z.string(),
  // `TP_CATEGORIA_ADMINISTRATIVA` do Censo Superior, nas palavras do campo.
  natureza: z.string().nullable(),
});

// Investimento por aluno do SIOPE no último ano: educação básica (4.8) ou, sem ela, o fundamental (4.2).
const porAlunoSchema = z.strictObject({
  ano: z.number(),
  fonte: fonteDoBlocoSchema,
  etapa: z.enum(['educacao_basica', 'fundamental']),
  valor: z.number(),
});

export const educacaoResumoSchema = z.strictObject({
  ...camposDaAba,
  alfabetizacao: alfabetizacaoSchema.nullable(),
  creche: crecheSchema.nullable(),
  procuraPorCreche: procuraPorCrecheSchema.nullable(),
  abandono: abandonoSchema.nullable(),
  ideb: cartaoSchema.nullable(),
  docentesSuperior: cartaoSchema.nullable(),
  turmas: cartaoSchema.nullable(),
  gasto: gastoSchema.nullable(),
  porAluno: porAlunoSchema.nullable(),
  minimo: minimoSchema.nullable(),
  matriculas: matriculasSchema.nullable(),
  alfabetizacaoDosMoradores: cartaoSchema.nullable(),
  superior: superiorSchema.nullable(),
});

export type EducacaoResumo = z.infer<typeof educacaoResumoSchema>;
