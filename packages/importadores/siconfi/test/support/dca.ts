// Itens fictícios da DCA e um cliente de mentira que os devolve.
import type { ClienteSiconfi } from '../../src/cliente';
import type { ItemDaDca, ItemDoRreo } from '../../src/normalizar';
import { anexo14Coerente } from './rreo';

export const COLUNAS = {
  empenhado: 'Despesas Empenhadas',
  liquidado: 'Despesas Liquidadas',
  pago: 'Despesas Pagas',
  rp_nao_processados: 'Inscrição de Restos a Pagar Não Processados',
  rp_processados: 'Inscrição de Restos a Pagar Processados',
};

export const item = (coluna: string, conta: string, valor: number, campos: Partial<ItemDaDca> = {}): ItemDaDca => ({
  exercicio: 2025,
  instituicao: 'Prefeitura Municipal de Orleans - SC',
  cod_ibge: 4211702,
  uf: 'SC',
  anexo: 'DCA-Anexo I-E',
  rotulo: 'Total Geral da Despesa por Função',
  coluna,
  cod_conta: 'TotalDespesas',
  conta,
  valor,
  populacao: 23531,
  ...campos,
});

/** A mesma composição em cada etapa; `total` permite descasar a linha de total da soma das funções. */
export const anexoCoerente = ({
  total = 300.5,
  totalDoPago = total,
}: { total?: number; totalDoPago?: number } = {}): ItemDaDca[] => {
  const etapa = (coluna: string, linhaTotal: number) => [
    item(coluna, 'Despesas Exceto Intraorçamentárias', linhaTotal),
    item(coluna, '01 - Legislativa', 50.25),
    item(coluna, '10 - Saúde', 200.25),
    item(coluna, '10.301 - Atenção Básica', 200.25),
    item(coluna, '12 - Educação', 50),
    item(coluna, 'FU12 - Demais Subfunções', 50),
  ];
  return [
    ...etapa(COLUNAS.empenhado, total),
    ...etapa(COLUNAS.liquidado, total),
    ...etapa(COLUNAS.pago, totalDoPago),
    // Inscrição de restos a pagar: não fecha com o total das etapas de propósito.
    item(COLUNAS.rp_nao_processados, 'Despesas Exceto Intraorçamentárias', 9),
    item(COLUNAS.rp_nao_processados, '10 - Saúde', 7),
    item(COLUNAS.rp_processados, 'Despesas Exceto Intraorçamentárias', 8),
  ];
};

export class ClienteSiconfiFake implements ClienteSiconfi {
  anos: number[] = [];
  anosDoRreo: number[] = [];
  constructor(
    private itens: ItemDaDca[],
    private anexo14: (ano: number) => ItemDoRreo[] = (ano) => anexo14Coerente({ ano }),
  ) {}
  async anexo(ano: number) {
    this.anos.push(ano);
    return this.itens;
  }
  async rreo(ano: number) {
    this.anosDoRreo.push(ano);
    return this.anexo14(ano);
  }
}
