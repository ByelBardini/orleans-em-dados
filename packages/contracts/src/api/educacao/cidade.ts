// GET /api/educacao/cidade: escolaridade dos moradores (Censo 2022) e oferta de faculdade na cidade (INEP 2024).
// São dois assuntos, com públicos e anos diferentes: nenhum campo soma um com o outro. Falta de dado é nulo, nunca zero.
import { z } from 'zod';
import { camposDaAba, comparacaoSchema, fonteDoBlocoSchema } from '../educacao';

const contagem = z.number().nullable();
// Pessoas de 1 a 4 só existem como o texto `menos de 5` (docs/context/educacao.md).
const pessoas = z.union([z.number(), z.literal('menos de 5')]).nullable();
const grupoComparado = z.strictObject({ grupo: z.string(), comparacao: comparacaoSchema });

const alfabetizacaoSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  total: comparacaoSchema,
  naoAlfabetizados: contagem,
  porGrupo: z.array(grupoComparado),
  porIdade: z.array(grupoComparado),
});

export const nivelDeInstrucaoSchema = z.enum(['medio_ou_mais', 'superior', 'sem_instrucao']);

const escolaridadeSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  anosDeEstudo: z.array(grupoComparado),
  // O denominador dos níveis: tabela 10061, variável 2667, em pessoas.
  pessoasDe25AnosOuMais: contagem,
  niveis: z.array(z.strictObject({ nivel: nivelDeInstrucaoSchema, comparacao: comparacaoSchema })),
});

// Os números da tabela, como vêm: a amostra do Censo arredonda cada um, e as partes podem não fechar com o total.
const moradoresSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  graduacao: contagem,
  emOrleans: contagem,
  emOutroMunicipio: contagem,
  noExterior: contagem,
  posGraduacao: contagem,
  posEmOutroMunicipio: contagem,
  foraDoMunicipio: comparacaoSchema,
});

const ofertaSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  instituicao: z.string().nullable(),
  // `TP_CATEGORIA_ADMINISTRATIVA` do Censo Superior, nas palavras do campo.
  natureza: z.string().nullable(),
  cursos: contagem,
  vagas: contagem,
  inscritos: contagem,
  ingressantes: contagem,
  matriculas: contagem,
  concluintes: contagem,
  // O denominador do percentual é `matriculas`.
  perfil: z.array(
    z.strictObject({
      recorte: z.enum(['noturno', 'escola_publica', 'de_18_a_24', 'mulheres', 'prouni', 'fies']),
      pessoas,
      percentual: z.number().nullable(),
    }),
  ),
  // O INEP avisa que o dado a distância por município é limitado: só o total, nunca por curso.
  ead: z.strictObject({ instituicoes: contagem, matriculas: pessoas, ingressantes: pessoas }),
  docentes: z.strictObject({
    total: contagem,
    doutores: contagem,
    mestres: contagem,
    especialistas: contagem,
    tempoIntegral: contagem,
  }),
  tecnicos: contagem,
});

const igcSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  continuo: z.number().nullable(),
  // Sem conceito na fonte: nulo.
  faixa: z.number().nullable(),
  distribuicaoEmSc: z.array(z.strictObject({ faixa: z.number(), instituicoes: z.number() })),
  instituicoesEmSc: contagem,
});

const cursosSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  // `curso` é `Nome (grau)`. `mulheres` e `noturno` só existem a partir de 10 matrículas.
  lista: z.array(
    z.strictObject({
      curso: z.string(),
      vagas: contagem,
      ingressantes: pessoas,
      matriculas: pessoas,
      concluintes: pessoas,
      mulheres: pessoas,
      noturno: pessoas,
    }),
  ),
});

export const educacaoCidadeSchema = z.strictObject({
  ...camposDaAba,
  alfabetizacao: alfabetizacaoSchema.nullable(),
  escolaridade: escolaridadeSchema.nullable(),
  moradores: moradoresSchema.nullable(),
  oferta: ofertaSchema.nullable(),
  igc: igcSchema.nullable(),
  cursos: cursosSchema.nullable(),
});

export type EducacaoCidade = z.infer<typeof educacaoCidadeSchema>;
export type NivelDeInstrucao = z.infer<typeof nivelDeInstrucaoSchema>;
