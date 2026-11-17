import { discrepanciasSchema, foraDaFonte } from '@orleans-em-dados/contracts';
import { conferenciaPorArea, conferirFuncoes } from '@orleans-em-dados/db/conferencias';
import type { FastifyInstance } from 'fastify';
import { parametro, responder } from '../../lib/borda';
import { coletaPublicada } from '../coletas/coletas.dao';
import { montarSecao, secaoIndisponivel } from './discrepancias.service';

// A ordem do `faltando` nas respostas.
const ORDEM = ['receitas', 'empenhos', 'despesas', 'tcesc_receitas', 'tcesc_empenhos'];

export async function rotasDeDiscrepancias(app: FastifyInstance) {
  // O que ficou fora do conferido, por tipo. Ano sem coleta é 404; ano sem as duas fontes diz o que falta.
  app.get('/api/discrepancias', async (request, reply) => {
    const pedido = parametro(request, 'ano');
    const ano = Number(pedido);
    const publicado = /^\d{4}$/.test(pedido ?? '') ? await coletaPublicada('receitas', ano) : null;
    if (!publicado) return reply.code(404).send({ erro: `Sem dados de discrepâncias para ${pedido}` });
    const [porArea, funcoes] = await Promise.all([conferenciaPorArea(ano), conferirFuncoes(ano)]);
    const { receita, despesa, parcial, limites, discrepancias } = porArea;
    const fora = [
      ...(receita.disponivel ? [] : [{ area: 'receita' as const, faltando: receita.faltando }]),
      ...(despesa.disponivel ? [] : [{ area: 'despesa' as const, faltando: despesa.faltando }]),
    ].map((a) => ({ ...a, foraDaFonte: foraDaFonte(a.faltando, ano) }));
    if (!receita.disponivel && !despesa.disponivel) {
      const faltando = ORDEM.filter((c) => fora.some((a) => a.faltando.includes(c)));
      return responder(reply, discrepanciasSchema, secaoIndisponivel(ano, faltando, foraDaFonte(faltando, ano)));
    }
    // De 2018 a 2022 só a receita é conferida: a seção traz os casos dela e diz que a despesa ficou de fora.
    const secao = montarSecao({ ano, parcial, limites, discrepancias, funcoes });
    return responder(reply, discrepanciasSchema, fora.length ? { ...secao, semConferencia: fora } : secao);
  });
}
