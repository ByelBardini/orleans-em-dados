// As rotas do caderno de Educação: uma entrada por aba na lista. Sem coleta não é erro: sempre `200`, e a aba diz o que falta.
import {
  educacaoAcessoSchema,
  educacaoCidadeSchema,
  educacaoDinheiroSchema,
  educacaoProfessoresSchema,
  educacaoDiscrepanciasSchema,
  educacaoPermanenciaSchema,
  educacaoResumoSchema,
} from '@orleans-em-dados/contracts';
import { educacaoAprendizadoSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { responder, responderCsv } from '../../lib/borda';
import { acesso, linhasDoAcesso } from './acesso.service';
import { aprendizado, linhasDoAprendizado } from './aprendizado.service';
import { cidade, linhasDaCidade } from './cidade.service';
import { linhasDoProfessores, professores } from './professores.service';
import { dinheiro, linhasDoDinheiro } from './dinheiro.service';
import { discrepanciasDeEducacao } from './discrepancias.service';
import { csvDeEducacao, type LinhaDoCsv } from './educacao.comum';
import { linhasDaPermanencia, permanencia } from './permanencia.service';
import { linhasDoResumo, resumo } from './resumo.service';

type Aba<T> = {
  nome: string;
  schema: z.ZodType<T>;
  carregar: () => Promise<T>;
  linhasDoCsv: (resposta: T) => LinhaDoCsv[];
};

const aba =
  <T>({ nome, schema, carregar, linhasDoCsv }: Aba<T>) =>
  (app: FastifyInstance) => {
    app.get(`/api/educacao/${nome}`, async (_request, reply) => responder(reply, schema, await carregar()));
    app.get(`/api/educacao/${nome}.csv`, async (_request, reply) =>
      responderCsv(reply, `educacao-${nome}.csv`, csvDeEducacao(linhasDoCsv(await carregar()))),
    );
  };

const ABAS = [
  aba({ nome: 'acesso', schema: educacaoAcessoSchema, carregar: acesso, linhasDoCsv: linhasDoAcesso }),
  aba({
    nome: 'aprendizado',
    schema: educacaoAprendizadoSchema,
    carregar: aprendizado,
    linhasDoCsv: linhasDoAprendizado,
  }),
  aba({ nome: 'dinheiro', schema: educacaoDinheiroSchema, carregar: dinheiro, linhasDoCsv: linhasDoDinheiro }),
  aba({ nome: 'cidade', schema: educacaoCidadeSchema, carregar: cidade, linhasDoCsv: linhasDaCidade }),
  aba({
    nome: 'professores',
    schema: educacaoProfessoresSchema,
    carregar: professores,
    linhasDoCsv: linhasDoProfessores,
  }),
  aba({
    nome: 'permanencia',
    schema: educacaoPermanenciaSchema,
    carregar: permanencia,
    linhasDoCsv: linhasDaPermanencia,
  }),
  aba({ nome: 'resumo', schema: educacaoResumoSchema, carregar: resumo, linhasDoCsv: linhasDoResumo }),
];

export async function rotasDeEducacao(app: FastifyInstance) {
  for (const registrar of ABAS) registrar(app);
  // Não é aba: fica em Discrepâncias, sem CSV.
  app.get('/api/educacao/discrepancias', async (_request, reply) =>
    responder(reply, educacaoDiscrepanciasSchema, await discrepanciasDeEducacao()),
  );
}
