// O importador do Portal da Transparência Betha: receitas (57153), empenhos (57140)
// e despesa orçamentária (57170). Cada consulta usa um esquema de filtro próprio.
import { tabelas } from '@orleans-em-dados/db';
import type { ConsultaImportada, Importador, RegistroBruto } from '@orleans-em-dados/importador-nucleo';
import { BethaAuthClient } from './auth';
import { BethaQueryClient } from './cliente';
import { esperarDeVerdade } from './config';
import { normalizarDespesa, normalizarEmpenho, normalizarReceita } from './normalizar';
import { paginar, type ClienteDePaginacao } from './paginacao';
import { contarAusentes, validarPorTotalizador } from './validar';

export interface ClienteBetha extends ClienteDePaginacao {
  totalizadores(consulta: number, filtro: unknown): Promise<unknown[]>;
}

type Declaracao = Pick<ConsultaImportada, 'id' | 'chave' | 'tabela'> & {
  filtro(ano: number): unknown;
  camposSoma: string[];
  normalizar(registro: RegistroBruto): Record<string, unknown>;
};

const DECLARACOES: Declaracao[] = [
  {
    id: 57153,
    chave: 'receitas',
    tabela: tabelas.receitas,
    filtro: (ano) => ({ ano: [String(ano)] }),
    camposSoma: ['valorOrcadoAtualizado', 'valorArrecadadoNoMes'],
    normalizar: normalizarReceita,
  },
  {
    id: 57140,
    chave: 'empenhos',
    tabela: tabelas.empenhos,
    filtro: (ano) => ({ anoExercicio: [String(ano)] }),
    camposSoma: ['valorEmpenho', 'valorLiquidadoEmpenho', 'valorPagoEmpenho'],
    normalizar: normalizarEmpenho,
  },
  // Despesa por natureza × ação, líquida de anulações. Com `anoExercicio` o filtro é
  // ignorado e voltam todos os exercícios: o desta consulta é `ano`.
  {
    id: 57170,
    chave: 'despesas',
    tabela: tabelas.despesas,
    filtro: (ano) => ({ ano: [String(ano)] }),
    camposSoma: ['valorEmpenhadoAtualizado', 'valorLiquidadoAtualizado', 'valorPagoAtualizado'],
    normalizar: normalizarDespesa,
  },
];

type Opcoes = {
  cliente?: ClienteBetha;
  limite?: number;
  pausaMs?: number;
  esperar?: (ms: number) => Promise<void>;
};

export function criarImportadorBetha(opcoes: Opcoes = {}): Importador {
  // Só instancia o cliente real quando nenhum foi dado: ele não abre conexão até o primeiro pedido.
  const cliente = opcoes.cliente ?? new BethaQueryClient(new BethaAuthClient());
  const paginacao = {
    limite: opcoes.limite ?? Number(process.env.BETHA_PAGE_SIZE ?? 10000),
    pausaMs: opcoes.pausaMs ?? Number(process.env.BETHA_PAUSA_MS ?? 300),
    esperar: opcoes.esperar ?? esperarDeVerdade,
  };

  const consultas = DECLARACOES.map(({ filtro: montarFiltro, camposSoma, ...declaracao }): ConsultaImportada => ({
    ...declaracao,
    async coletar({ ano }) {
      const filtro = montarFiltro(ano);
      const { totalHits, hits, erros } = await paginar(cliente, declaracao.id, filtro, paginacao);
      const registros = hits.map((h) => ({ ...h.sourceAsMap, id: h.id }));
      const totalizadores = await cliente.totalizadores(declaracao.id, filtro);
      return {
        filtro,
        totalHits,
        registros,
        erros,
        camposAusentes: contarAusentes(registros, camposSoma),
        extras: { totalizadores },
      };
    },
    validar: validarPorTotalizador(camposSoma),
  }));

  return {
    id: 'betha',
    fonte: 'betha',
    agenda: '0 3 * * *',
    // O exercício anterior ainda aceita retificação.
    anosDaRodada: (agora) => [agora.getUTCFullYear(), agora.getUTCFullYear() - 1],
    consultas,
  };
}
