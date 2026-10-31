// Dados de referência que não vêm da Betha.

// População de Orleans/SC (IBGE, código 4211702). Censo 2022 e estimativas anuais
// (tabela 6579). Para um ano sem número, usa o mais próximo anterior.
const POPULACAO = {
  2022: { pessoas: 23661, fonte: 'IBGE, Censo 2022' },
  2025: { pessoas: 24686, fonte: 'IBGE, estimativa 2025' },
};

export function populacao(ano) {
  const anos = Object.keys(POPULACAO).map(Number).sort((a, b) => a - b);
  const escolhido = [...anos].reverse().find((a) => a <= ano) ?? anos[0];
  return POPULACAO[escolhido];
}

// Origem da receita (dois primeiros dígitos da natureza) em linguagem do dia a dia.
export const ORIGEM_CIDADAO = {
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

export const GLOSSARIO = [
  ['Previsto', 'Quanto o orçamento aprovado pela Câmara esperava arrecadar no ano.'],
  ['Arrecadado', 'O que de fato entrou nos cofres: impostos, taxas, tarifas e repasses.'],
  ['Empenhado', 'O valor reservado para uma despesa. É o primeiro passo, ainda não é pagamento.'],
  ['Liquidado', 'A confirmação de que o produto foi entregue ou o serviço, prestado.'],
  ['Pago', 'O que saiu do caixa para o credor depois da liquidação.'],
  ['Credor', 'A empresa, órgão ou pessoa que recebe o pagamento.'],
];

// Como cada entidade entra numa frase ("Em 2025, o SAMAE arrecadou…").
const SUJEITO = {
  728: 'a Prefeitura',
  319: 'o Fundo Municipal de Saúde',
  2473: 'o SAMAE',
  320: 'a Fundação Ambiental',
};

export const sujeito = (entidade, entidades = []) =>
  !entidade ? 'Orleans' : (SUJEITO[entidade] ?? entidades.find((e) => e.codigo === entidade)?.sigla ?? 'a entidade');
