// Itens fictícios do RREO Anexo 14, no formato da API.
import type { ItemDoRreo } from '../../src/normalizar';

export const COLUNAS_DO_RREO = {
  valor: 'Valor Apurado Até o Bimestre',
  minimo: '% Mínimo a Aplicar no Exercício',
  percentual: '% Aplicado Até o Bimestre',
};

export const CONTA_DA_EDUCACAO =
  'Mínimo Anual de <18% / 25%> das Receitas de Impostos na Manutenção e Desenvolvimento do Ensino';
export const CONTA_DO_FUNDEB_ATE_2020 =
  'Mínimo Anual de 60% do FUNDEB na Remuneração do Magistério com Educação Infantil e Ensino Fundamental';
export const CONTA_DO_FUNDEB = 'Mínimo Anual de 70% do FUNDEB na Remuneração dos Profissionais da Educação Básica';

export const itemDoRreo = (
  conta: string,
  coluna: string,
  valor: number | null,
  campos: Partial<ItemDoRreo> = {},
): ItemDoRreo => ({
  exercicio: 2025,
  demonstrativo: 'RREO',
  periodo: 6,
  periodicidade: 'B',
  instituicao: 'Prefeitura Municipal de Orleans - SC',
  cod_ibge: 4211702,
  uf: 'SC',
  populacao: 23531,
  anexo: 'RREO-Anexo 14',
  esfera: 'M',
  rotulo: 'Padrão',
  coluna,
  cod_conta: 'ContaFicticia',
  conta,
  valor,
  ...campos,
});

/** As três colunas de uma conta, como a fonte entrega: valor, mínimo e percentual. */
export const contaDoRreo = (
  conta: string,
  valor: number,
  percentual: number,
  minimo = 25,
  campos: Partial<ItemDoRreo> = {},
): ItemDoRreo[] => [
  itemDoRreo(conta, COLUNAS_DO_RREO.valor, valor, campos),
  itemDoRreo(conta, COLUNAS_DO_RREO.minimo, minimo, campos),
  itemDoRreo(conta, COLUNAS_DO_RREO.percentual, percentual, campos),
];

/** O que a API traz de outros assuntos no mesmo anexo: tem de ficar de fora. */
export const linhasDeOutrosAssuntos = (campos: Partial<ItemDoRreo> = {}): ItemDoRreo[] => [
  itemDoRreo('Receita Corrente Líquida', 'Até o Bimestre', 1000.5, campos),
  itemDoRreo(
    'Mínimo de 15% da Complementação da União ao FUNDEB (VAAT) em Despesas de Capital',
    COLUNAS_DO_RREO.minimo,
    15,
    campos,
  ),
  itemDoRreo(
    'Despesas com Ações e Serviços Públicos de Saúde Executadas com Recursos de Impostos',
    COLUNAS_DO_RREO.percentual,
    19.5,
    campos,
  ),
];

/** Anexo com as duas contas e as linhas de outros assuntos. */
export const anexo14Coerente = ({ ano = 2025 } = {}): ItemDoRreo[] => [
  ...linhasDeOutrosAssuntos({ exercicio: ano }),
  ...contaDoRreo(CONTA_DA_EDUCACAO, 1500.25, 26.5, 25, { exercicio: ano }),
  ...contaDoRreo(CONTA_DO_FUNDEB, 800.75, 81.25, 70, { exercicio: ano }),
];
