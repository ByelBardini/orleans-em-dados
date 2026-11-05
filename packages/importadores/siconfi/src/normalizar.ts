// Item da DCA Anexo I-E → linha de siconfi_funcoes; itens do RREO Anexo 14 → linha de
// educacao_financas. Formato desconhecido é recusado, nunca adivinhado: o quadro I-E já mudou
// de um ano para o outro, e o Anexo 14 mudou a redação do Fundeb em 2021.
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

export type ItemDoRreo = Record<string, unknown>;

export type LinhaDeIndice = {
  idExterno: string;
  periodo: string;
  indicador: string;
  lugar: string;
  rede: 'municipal';
  recorte: '';
  valor: Dinheiro;
  percentual: string;
};

export const INDICADORES_DO_RREO = ['indice_educacao', 'fundeb_remuneracao'];

// As únicas redações conhecidas. A do Fundeb mudou em 2021, com o novo fundo: 60% do magistério até
// 2020, 70% dos profissionais desde então. É o mesmo indicador, com outra regra.
const INDICADOR_DA_CONTA: Record<string, string> = {
  'Mínimo Anual de <18% / 25%> das Receitas de Impostos na Manutenção e Desenvolvimento do Ensino': 'indice_educacao',
  'Mínimo Anual de 60% do FUNDEB na Remuneração do Magistério com Educação Infantil e Ensino Fundamental':
    'fundeb_remuneracao',
  'Mínimo Anual de 70% do FUNDEB na Remuneração dos Profissionais da Educação Básica': 'fundeb_remuneracao',
};

// Larga de propósito: redação nova do assunto passa daqui e é recusada na normalização, em vez de
// sumir junto com as outras linhas do anexo (fiscal, saúde, Complementação da União ao Fundeb).
const CONTA_DOS_INDICES = /manutenção e desenvolvimento do ensino|fundeb na remuneração/i;

const COLUNA_DO_VALOR = 'Valor Apurado Até o Bimestre';
const COLUNA_DO_PERCENTUAL = '% Aplicado Até o Bimestre';

/** Uma conta do anexo vem em um item por coluna; a tabela quer uma linha por conta. O resto do anexo fica de fora. */
export function registrosDosIndices(itens: readonly ItemDoRreo[]): { registros: RegistroBruto[]; erros: string[] } {
  const contas = new Map<string, { registro: RegistroBruto; colunas: Record<string, unknown> }>();
  const erros: string[] = [];
  for (const { coluna, valor, ...item } of itens) {
    const conta = String(item.conta);
    if (!CONTA_DOS_INDICES.test(conta)) continue;
    let achada = contas.get(conta);
    if (!achada) {
      const colunas: Record<string, unknown> = {};
      achada = { registro: { ...item, id: conta, colunas }, colunas };
      contas.set(conta, achada);
    }
    if (String(coluna) in achada.colunas) erros.push(`coluna "${String(coluna)}" repetida em "${conta}"`);
    achada.colunas[String(coluna)] = valor;
  }
  return { registros: [...contas.values()].map((c) => c.registro), erros };
}

export function normalizarIndice(registro: RegistroBruto): LinhaDeIndice {
  const { conta, exercicio, cod_ibge: ente } = registro;
  if (String(ente) !== SICONFI.ente) throw new Error(`ente ${String(ente)} recebido; esperado ${SICONFI.ente}`);
  const indicador = INDICADOR_DA_CONTA[String(conta)];
  if (!indicador) throw new Error(`conta em formato desconhecido: ${JSON.stringify(conta)}`);

  const colunas = registro.colunas as Record<string, string | number | null | undefined>;
  const coluna = (nome: string) => {
    const valor = colunas[nome];
    if (valor === null || valor === undefined) throw new Error(`${indicador} sem a coluna "${nome}"`);
    return dinheiro(valor);
  };
  const periodo = String(exercicio);
  return {
    idExterno: `${SICONFI.ente}:municipal:::${indicador}:${periodo}`,
    periodo,
    indicador,
    lugar: SICONFI.ente,
    rede: 'municipal',
    recorte: '',
    valor: coluna(COLUNA_DO_VALOR),
    percentual: coluna(COLUNA_DO_PERCENTUAL),
  };
}
