// Item da DCA Anexo I-E → linha de siconfi_funcoes. Formato desconhecido é recusado, nunca
// adivinhado: o quadro I-E já mudou de um ano para o outro.
import { dinheiro, type Dinheiro } from '@orleans-em-dados/contracts';
import type { RegistroBruto } from '@orleans-em-dados/importador-nucleo';
import { SICONFI } from './config';

export type ItemDaDca = Record<string, unknown>;

export type LinhaDeFuncao = {
  idExterno: string;
  etapa: string;
  tipo: 'total' | 'funcao' | 'subfuncao';
  funcaoCodigo: string | null;
  subfuncaoCodigo: string | null;
  conta: string;
  valor: Dinheiro;
};

const ETAPAS: Record<string, string> = {
  'Despesas Empenhadas': 'empenhado',
  'Despesas Liquidadas': 'liquidado',
  'Despesas Pagas': 'pago',
  'Inscrição de Restos a Pagar Não Processados': 'rp_nao_processados',
  'Inscrição de Restos a Pagar Processados': 'rp_processados',
};

const CONTA_DE_TOTAL = 'Despesas Exceto Intraorçamentárias';
const FUNCAO = /^(\d{2}) - (.+)$/;
const SUBFUNCAO = /^((\d{2})\.\d{3}) - (.+)$/;
const DEMAIS_SUBFUNCOES = /^(FU(\d{2})) - (.+)$/;

export function registroDoItem(item: ItemDaDca): RegistroBruto {
  const etapa = ETAPAS[String(item.coluna)];
  if (!etapa) throw new Error(`SICONFI: coluna desconhecida no Anexo I-E: ${JSON.stringify(item.coluna)}`);
  return { ...item, id: `${etapa}:${String(item.conta)}` };
}

function classificar(conta: string): Pick<LinhaDeFuncao, 'tipo' | 'funcaoCodigo' | 'subfuncaoCodigo' | 'conta'> {
  if (conta === CONTA_DE_TOTAL) return { tipo: 'total', funcaoCodigo: null, subfuncaoCodigo: null, conta };
  const funcao = FUNCAO.exec(conta);
  if (funcao) return { tipo: 'funcao', funcaoCodigo: funcao[1]!, subfuncaoCodigo: null, conta: funcao[2]! };
  const subfuncao = SUBFUNCAO.exec(conta) ?? DEMAIS_SUBFUNCOES.exec(conta);
  if (subfuncao) {
    return { tipo: 'subfuncao', funcaoCodigo: subfuncao[2]!, subfuncaoCodigo: subfuncao[1]!, conta: subfuncao[3]! };
  }
  throw new Error(`conta em formato desconhecido: ${JSON.stringify(conta)}`);
}

export function normalizarConta(registro: RegistroBruto): LinhaDeFuncao {
  const { id, coluna, conta, valor, cod_ibge: ente } = registro;
  if (String(ente) !== SICONFI.ente) throw new Error(`ente ${String(ente)} recebido; esperado ${SICONFI.ente}`);
  return {
    idExterno: id,
    etapa: ETAPAS[String(coluna)]!,
    ...classificar(String(conta)),
    valor: dinheiro(valor as string | number),
  };
}
