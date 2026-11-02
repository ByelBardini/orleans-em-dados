import { receitasSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance } from 'fastify';
import { parametro, responder, responderCsv, texto } from '../../lib/borda';
import { gerarCsv } from '../../lib/csv';
import { coletaOu404 } from '../coletas/coletas.routes';
import { receitasDoAno } from './receitas.service';

const colunas = (arrecadado: string) =>
  [
    ['rubrica', 'Rubrica'],
    ['descricao', 'Descrição'],
    ['entidade', 'Entidade'],
    ['orcadoAtualizado', 'Orçado atualizado'],
    ['arrecadadoNoMes', arrecadado],
  ] as const;

export async function rotasDeReceitas(app: FastifyInstance) {
  app.get('/api/receitas', async (request, reply) => {
    const coleta = await coletaOu404(request, reply, 'receitas');
    if (!coleta) return reply;
    const corpo = await receitasDoAno(coleta, Number(parametro(request, 'ano')), texto(request, 'entidade'));
    return responder(reply, receitasSchema, corpo);
  });

  app.get('/api/receitas.csv', async (request, reply) => {
    const coleta = await coletaOu404(request, reply, 'receitas');
    if (!coleta) return reply;
    const { naturezas } = await receitasDoAno(coleta, Number(parametro(request, 'ano')), texto(request, 'entidade'));
    // A coleta de exemplo não é conferida: o cabeçalho não pode dizer que é.
    const titulo = coleta.meta.exemplo ? 'Arrecadado' : 'Arrecadado conferido';
    return responderCsv(reply, `receitas-${parametro(request, 'ano')}.csv`, gerarCsv(colunas(titulo), naturezas));
  });
}
