import { describe, expect, it } from 'vitest';
import { posicao } from '../src/comparacao';

describe('posicao', () => {
  it.each([
    [2065.31, 2220.4, 'abaixo', '7,0%'],
    [2065.31, 1638.06, 'acima', '26,1%'],
    [43.03, 79.5, 'abaixo', '45,9%'],
    [59547.1, 53886.67, 'acima', '10,5%'],
  ])('%d diante de %d em percentual fica %s, em %s', (orleans, lugar, sentido, texto) => {
    expect(posicao(orleans, lugar, { em: 'percentual' })).toMatchObject({ sentido, texto });
  });

  it.each([
    [79.55, 88.36, 'abaixo', '8,8 pontos'],
    [16.59, 15.81, 'acima', '0,8 ponto'],
    [10.6, 6.46, 'acima', '4,1 pontos'],
    [11.5, 10, 'acima', '1,5 ponto'],
  ])('%d diante de %d em pontos fica %s, em %s', (orleans, lugar, sentido, texto) => {
    expect(posicao(orleans, lugar, { em: 'pontos' })).toMatchObject({ sentido, texto });
  });

  it('o percentual é sobre o outro lugar, e não sobre Orleans', () => {
    // 150 sobre 100 é 50% acima; sobre 150 seria 33,3%.
    expect(posicao(150, 100, { em: 'percentual' })?.texto).toBe('50,0%');
  });

  it.each([
    ['pontos', '2,0 pontos'],
    ['percentual', '50,0%'],
  ] as const)('em %s, perder menos que o outro lugar fica acima', (em, texto) => {
    // Crescimento de -2 diante de -4.
    expect(posicao(-2, -4, { em })).toMatchObject({ sentido: 'acima', texto });
  });

  it.each([
    [1000, 1000.2],
    [1000, 999.8],
  ])('%d diante de %d arredonda para zero: é igual, sem cor', (orleans, lugar) => {
    expect(posicao(orleans, lugar, { em: 'percentual', maiorEBom: true })).toEqual({
      sentido: 'igual',
      texto: 'igual',
      tom: null,
    });
  });

  it('onde maior é melhor, acima é bom', () => {
    expect(posicao(2, 1, { em: 'percentual', maiorEBom: true })?.tom).toBe('bom');
  });

  it('onde maior é melhor, abaixo é ruim', () => {
    expect(posicao(1, 2, { em: 'percentual', maiorEBom: true })?.tom).toBe('ruim');
  });

  it('onde menor é melhor, abaixo é bom', () => {
    expect(posicao(4, 6, { em: 'pontos', menorEBom: true })?.tom).toBe('bom');
  });

  it('onde menor é melhor, acima é ruim', () => {
    expect(posicao(6, 4, { em: 'pontos', menorEBom: true })?.tom).toBe('ruim');
  });

  it.each([
    [2, 1],
    [1, 2],
  ])('sem dizer que maior é melhor, %d diante de %d não leva cor', (orleans, lugar) => {
    expect(posicao(orleans, lugar, { em: 'pontos' })?.tom).toBeNull();
  });

  it.each([
    [null, 10],
    [10, null],
  ])('%s diante de %s fica sem comparação', (orleans, lugar) => {
    expect(posicao(orleans, lugar, { em: 'pontos' })).toBeNull();
  });

  it('percentual sobre zero não existe: fica sem comparação', () => {
    expect(posicao(10, 0, { em: 'percentual' })).toBeNull();
  });
});
