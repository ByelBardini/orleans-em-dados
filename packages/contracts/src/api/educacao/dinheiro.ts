// GET /api/educacao/dinheiro: o mínimo legal, o gasto, os repasses e a conta do Fundeb, em reais nominais e só de
// exercício encerrado. Dinheiro é `number`, somado no SQL ou em centavos. Falta de dado é nulo, nunca zero.
import { z } from 'zod';
import { camposDaAba, fonteDoBlocoSchema } from '../educacao';

const valor = z.number().nullable();

// O SIOPE é o principal; o SICONFI só entra para o aviso, e a tabela da diferença fica em Discrepâncias.
const indiceLegalSchema = z.strictObject({
  ano: z.number(),
  percentual: valor,
  aplicado: valor,
  minimo: z.number(),
  siconfi: z.strictObject({ percentual: valor, valor }).nullable(),
  difereDoSiconfi: z.boolean(),
});

const blocoDoIndice = {
  fonte: fonteDoBlocoSchema,
  fonteComparada: fonteDoBlocoSchema.nullable(),
  anos: z.array(indiceLegalSchema),
};

const minimoSchema = z.strictObject({
  ...blocoDoIndice,
  // O que o Anexo 8 de 2023 registra sobre 2021.
  emenda119: z.strictObject({ diferencaEm2021: valor, complementadoEm2022: valor }).nullable(),
});

const fundebRemuneracaoSchema = z.strictObject(blocoDoIndice);

export const nivelDoGastoSchema = z.enum(['conferido', 'diferenca', 'sem_betha']);

const gastoDoAnoSchema = z.strictObject({
  ano: z.number(),
  liquidado: valor,
  conferencia: nivelDoGastoSchema,
  // Só quando o gasto total do Anexo 8 é igual ao centavo.
  igualAoAnexo8: z.boolean(),
  anexo8: valor,
  divisor: z.strictObject({ ano: z.number(), populacao: z.number(), tipo: z.enum(['censo', 'estimativa']) }).nullable(),
  porMorador: valor,
  // O liquidado em reais do ano-base de `inflacao`; nulo sem IPCA ou com o ano incompleto.
  corrigido: valor,
  // Função 12 ÷ (total − função 01, a Câmara).
  participacao: valor,
  // Subfunção ÷ função 12.
  etapas: z.array(
    z.strictObject({ chave: z.enum(['fundamental', 'infantil', 'superior', 'outras']), valor, percentual: valor }),
  ),
});

const gastoSchema = z.strictObject({
  fonte: fonteDoBlocoSchema,
  anos: z.array(gastoDoAnoSchema),
  // Primeiro × último ano, os dois corrigidos; uma casa, com sinal. Nulo se um dos dois não tem correção.
  crescimentoReal: z.strictObject({ de: z.number(), ate: z.number(), percentual: z.number() }).nullable(),
  // As ações do último exercício com a Betha, para a nota sobre as etapas.
  acoesNasEtapas: z.strictObject({ ano: z.number(), transporte: valor, merenda: valor }).nullable(),
});

const acoesSchema = z.strictObject({
  fonte: fonteDoBlocoSchema,
  anos: z.array(
    z.strictObject({
      ano: z.number(),
      total: valor,
      // Só o total tem par: cada ação e cada natureza seguem fonte única.
      totalConferido: z.boolean(),
      acoes: z.array(z.strictObject({ nome: z.string(), liquidado: valor })),
      naturezas: z.array(
        z.strictObject({
          chave: z.enum(['pessoal', 'custeio', 'investimento', 'outras']),
          liquidado: valor,
          percentual: valor,
        }),
      ),
    }),
  ),
});

const repassesSchema = z.strictObject({
  fonte: fonteDoBlocoSchema,
  anos: z.array(
    z.strictObject({
      ano: z.number(),
      // `valor` nulo: a rubrica tem coleta, mas ficou fora do conferido com o TCE-SC.
      rubricas: z.array(z.strictObject({ rubrica: z.string(), nome: z.string(), valor })),
      // Repasse ÷ gasto: "equivale a", porque a conta não prova que o repasse pagou esse gasto.
      equivalencias: z.array(
        z.strictObject({ chave: z.enum(['transporte', 'merenda']), gasto: valor, repasses: valor, percentual: valor }),
      ),
    }),
  ),
});

const contaDoFundebSchema = z.strictObject({
  fonte: fonteDoBlocoSchema,
  anos: z.array(
    z.strictObject({
      ano: z.number(),
      // Receita conferida com o TCE-SC; nulo no ano sem essa conferência.
      recebido: valor,
      contribuicao: valor,
      contribuicaoConferida: z.boolean(),
      // Recebido − contribuição, em centavos.
      conta: valor,
      resultado: valor,
      // Resultado oficial − conta, com sinal. Zero é "fecha"; nulo é "não dá para fazer a conta".
      diferenca: valor,
    }),
  ),
});

const porAlunoSchema = z.strictObject({
  fonte: fonteDoBlocoSchema,
  anos: z.array(
    z.strictObject({
      ano: z.number(),
      infantil: valor,
      fundamental: valor,
      educacaoBasica: valor,
      // Os mesmos três em reais do ano-base; nulo sem IPCA.
      corrigido: z.strictObject({ infantil: valor, fundamental: valor, educacaoBasica: valor }).nullable(),
    }),
  ),
});

// A correção pela inflação: IPCA médio do ano (tabela 1737 do IBGE), em reais do último ano completo.
const inflacaoSchema = z.strictObject({
  fonte: fonteDoBlocoSchema,
  anoBase: z.number(),
  metodo: z.literal('ipca_medio'),
});

export const educacaoDinheiroSchema = z.strictObject({
  ...camposDaAba,
  valores: z.literal('nominais'),
  // Nulo sem a coleta do IPCA: aí nada tem `corrigido`.
  inflacao: inflacaoSchema.nullable(),
  minimo: minimoSchema.nullable(),
  fundebRemuneracao: fundebRemuneracaoSchema.nullable(),
  gasto: gastoSchema.nullable(),
  acoes: acoesSchema.nullable(),
  repasses: repassesSchema.nullable(),
  contaDoFundeb: contaDoFundebSchema.nullable(),
  porAluno: porAlunoSchema.nullable(),
});

export type EducacaoDinheiro = z.infer<typeof educacaoDinheiroSchema>;
