// Orleans diante de outro lugar: acima, abaixo ou igual, e quanto. Valor que já é percentual compara em pontos, porque
// "10% de 20%" confunde. Cor só onde maior é melhor sem discussão: quem chama diz, e o padrão é sem cor.
export const SETA = { acima: '▲', abaixo: '▼', igual: '=' };

export type Posicao = { sentido: 'acima' | 'abaixo' | 'igual'; texto: string; tom: 'bom' | 'ruim' | null };

export const umaCasa = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function posicao(
  orleans: number | null,
  lugar: number | null,
  {
    em,
    maiorEBom = false,
    menorEBom = false,
  }: { em: 'percentual' | 'pontos'; maiorEBom?: boolean; menorEBom?: boolean },
): Posicao | null {
  if (orleans === null || lugar === null) return null;
  if (em === 'percentual' && lugar === 0) return null;
  const diferenca = em === 'percentual' ? ((orleans - lugar) / Math.abs(lugar)) * 100 : orleans - lugar;
  const distancia = Math.abs(diferenca);
  if (Math.round(distancia * 10) === 0) return { sentido: 'igual', texto: 'igual', tom: null };
  const acima = diferenca > 0;
  const quanto =
    em === 'percentual' ? `${umaCasa(distancia)}%` : `${umaCasa(distancia)} ${distancia < 2 ? 'ponto' : 'pontos'}`;
  return {
    sentido: acima ? 'acima' : 'abaixo',
    texto: quanto,
    tom: maiorEBom ? (acima ? 'bom' : 'ruim') : menorEBom ? (acima ? 'ruim' : 'bom') : null,
  };
}
