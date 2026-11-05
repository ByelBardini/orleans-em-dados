// GET /api/educacao/acesso: quem está na escola. Falta de dado é nulo, nunca zero.
import { z } from 'zod';
import { camposDaAba, comparacaoSchema, fonteDoBlocoSchema, valoresDaRedeSchema } from '../educacao';

const contagem = z.number().nullable();

const frequenciaSchema = z.strictObject({
  ano: z.string(),
  anoAnterior: z.string(),
  fonte: fonteDoBlocoSchema,
  fonteAnterior: fonteDoBlocoSchema,
  faixas: z.array(
    z.strictObject({
      faixa: z.string(),
      comparacao: comparacaoSchema,
      noAnoAnterior: valoresDaRedeSchema,
    }),
  ),
});

const matriculasSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  total: contagem,
  etapas: z.array(
    z.strictObject({
      etapa: z.string(),
      total: contagem,
      municipal: contagem,
      estadual: contagem,
      federal: contagem,
      privada: contagem,
    }),
  ),
  // Uma escola pode atender mais de uma etapa, e um docente pode contar em mais de uma: não se somam.
  escolasEDocentes: z.array(z.strictObject({ etapa: z.string(), escolas: contagem, docentes: contagem })),
});

const outroMunicipioSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  comparacao: comparacaoSchema,
  estudantes: contagem,
  emOutroMunicipio: contagem,
});

export const nivelDeGestaoSchema = z.enum(['inicial', 'elementar', 'basico', 'avancado']);

// A resposta da Prefeitura ao MEC, nas palavras do painel. Não é contagem de crianças.
const retratoSchema = z.strictObject({
  ano: z.string(),
  fonte: fonteDoBlocoSchema,
  solicitacoesNaoAtendidas: z.string().nullable(),
  // Não há número público: nulo é "Sem dado", nunca zero.
  quantidadeNaLista: contagem,
  listaUnificada: z.string().nullable(),
  listasDivulgadas: z.string().nullable(),
  criteriosDePrioridade: z.string().nullable(),
  idadeInicial: z.string().nullable(),
  foraDaPreEscola: z.string().nullable(),
  nivelDeOrleans: nivelDeGestaoSchema.nullable(),
  distribuicaoEmSc: z.array(z.strictObject({ nivel: nivelDeGestaoSchema, municipios: contagem })),
});

export const educacaoAcessoSchema = z.strictObject({
  ...camposDaAba,
  frequencia: frequenciaSchema.nullable(),
  matriculas: matriculasSchema.nullable(),
  outroMunicipio: outroMunicipioSchema.nullable(),
  retrato: retratoSchema.nullable(),
});

export type EducacaoAcesso = z.infer<typeof educacaoAcessoSchema>;
export type NivelDeGestao = z.infer<typeof nivelDeGestaoSchema>;
