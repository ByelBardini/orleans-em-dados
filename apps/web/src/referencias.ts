// Dados de referência que não vêm da Betha.

// População de Orleans/SC (IBGE, código 4211702). Censo 2022 e estimativas anuais
// (tabela 6579). Para um ano sem número, usa o mais próximo anterior.
const POPULACAO: Record<number, { pessoas: number; fonte: string }> = {
  2022: { pessoas: 23661, fonte: 'IBGE, Censo 2022' },
  2025: { pessoas: 24686, fonte: 'IBGE, estimativa 2025' },
};

export function populacao(ano: number) {
  const anos = Object.keys(POPULACAO)
    .map(Number)
    .sort((a, b) => a - b);
  const escolhido = [...anos].reverse().find((a) => a <= ano) ?? (anos[0] as number);
  return POPULACAO[escolhido] as { pessoas: number; fonte: string };
}

// Origem da receita (dois primeiros dígitos da natureza) em linguagem do dia a dia.
export const ORIGEM_CIDADAO: Record<string, string> = {
  11: 'Impostos e taxas municipais',
  12: 'Contribuições (iluminação pública)',
  13: 'Rendimentos de aplicações',
  14: 'Receita agropecuária',
  15: 'Receita industrial',
  16: 'Tarifas e serviços (água, esgoto)',
  17: 'Repasses da União e do Estado',
  19: 'Outras receitas',
  21: 'Empréstimos',
  22: 'Venda de bens',
  23: 'Empréstimos recebidos de volta',
  24: 'Repasses para obras e equipamentos',
  29: 'Outras receitas de capital',
};

// Origens que são dinheiro vindo de fora (União, Estado, convênios).
export const ORIGENS_DE_FORA = new Set(['17', '24']);

export const GLOSSARIO: [string, string][] = [
  ['Previsto', 'Quanto o orçamento aprovado pela Câmara esperava arrecadar no ano.'],
  ['Arrecadado', 'O que de fato entrou nos cofres: impostos, taxas, tarifas e repasses.'],
  ['Empenhado', 'O valor reservado para uma despesa. É o primeiro passo, ainda não é pagamento.'],
  ['Liquidado', 'A confirmação de que o produto foi entregue ou o serviço, prestado.'],
  ['Pago', 'O que saiu do caixa para o credor depois da liquidação.'],
  ['Credor', 'A empresa, órgão ou pessoa que recebe o pagamento.'],
];

// Função de governo em linguagem do dia a dia; o nome oficial vai junto quando é outro.
const FUNCAO_CIDADAO: Record<string, string> = {
  '04': 'Administração da prefeitura',
  '06': 'Segurança e defesa civil',
  '08': 'Assistência social',
  '13': 'Cultura',
  '15': 'Ruas, praças e iluminação',
  '16': 'Moradia',
  '17': 'Água, esgoto e lixo',
  '18': 'Meio ambiente',
  '20': 'Agricultura',
  '23': 'Comércio e serviços',
  '26': 'Estradas e transporte',
  '27': 'Esporte e lazer',
};

/** `oficial` só vem quando o nome do dia a dia é outro. */
export const nomeDaFuncao = (codigo: string, oficial: string): { nome: string; oficial: string | null } => {
  const cidadao = FUNCAO_CIDADAO[codigo];
  return cidadao && cidadao.toLocaleLowerCase('pt-BR') !== oficial.toLocaleLowerCase('pt-BR')
    ? { nome: cidadao, oficial }
    : { nome: oficial, oficial: null };
};

// Como cada entidade entra numa frase ("Em 2025, o SAMAE arrecadou…").
const SUJEITO: Record<string, string> = {
  728: 'a Prefeitura',
  319: 'o Fundo Municipal de Saúde',
  2473: 'o SAMAE',
  320: 'a Fundação Ambiental',
};

export const sujeito = (entidade: string, entidades: readonly { codigo: string; sigla: string }[] = []) =>
  !entidade ? 'Orleans' : (SUJEITO[entidade] ?? entidades.find((e) => e.codigo === entidade)?.sigla ?? 'a entidade');
