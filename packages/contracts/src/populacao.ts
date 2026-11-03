// A população usada como divisor. API e tela usam a mesma regra: o número do próprio ano,
// senão o anterior mais próximo. O texto na tela diz qual divisor foi usado.
export type PontoDaPopulacao = { ano: number; populacao: number; tipo: 'censo' | 'estimativa' };

export function populacaoDoAno(serie: readonly PontoDaPopulacao[], ano: number): PontoDaPopulacao | null {
  return serie.reduce<PontoDaPopulacao | null>(
    (melhor, ponto) => (ponto.ano <= ano && (!melhor || ponto.ano > melhor.ano) ? ponto : melhor),
    null,
  );
}
