import { describe, expect, it } from 'vitest';
import {
  contagemPublicavel,
  decimalDaFonte,
  dinheiroDoSiope,
  medianaPublicavel,
  percentualDoSiope,
  rendimentoFecha,
  taxaDoInep,
} from '../src/validacoes';

describe('contagemPublicavel', () => {
  it.each([1, 4])('%i pessoas só sai como "menos de 5"', (n) => {
    expect(contagemPublicavel(n)).toEqual({ valor: null, texto: 'menos de 5' });
  });

  it('5 pessoas sai o número', () => {
    expect(contagemPublicavel(5)).toEqual({ valor: '5', texto: null });
  });

  it('zero é o número, não "menos de 5"', () => {
    expect(contagemPublicavel(0)).toEqual({ valor: '0', texto: null });
  });
});

describe('medianaPublicavel', () => {
  const dez = [100n, 200n, 300n, 400n, 500n, 600n, 700n, 800n, 900n, 1000n];

  it('com menos de 10 pessoas sai nula', () => {
    expect(medianaPublicavel(dez.slice(0, 9))).toBeNull();
  });

  it('com 10 pessoas é a média dos dois do meio, em reais', () => {
    expect(medianaPublicavel(dez)).toBe('5.50');
  });

  it('com número ímpar é o valor do meio, fora de ordem na entrada', () => {
    expect(medianaPublicavel([1100n, ...dez.slice().reverse()])).toBe('6.00');
  });
});

describe('taxaDoInep', () => {
  it.each(['--', '-', '', null, undefined])('%s vira nulo, nunca zero', (bruto) => {
    expect(taxaDoInep(bruto)).toBeNull();
  });

  it('zero da fonte continua zero', () => {
    expect(taxaDoInep(0)).toBe('0');
  });

  it('número fica em texto decimal', () => {
    expect(taxaDoInep(97.2)).toBe('97.2');
  });

  it('texto fora do esperado falha, sem adivinhar', () => {
    expect(() => taxaDoInep('n/d')).toThrow(/valor inesperado: n\/d/);
  });
});

describe('decimalDaFonte', () => {
  it('arredonda nas casas pedidas', () => {
    expect(decimalDaFonte(3944.979, 2)).toBe('3944.98');
  });

  it('símbolo de sigilo declarado vira nulo', () => {
    expect(decimalDaFonte('a', 2, ['a', 'd'])).toBeNull();
  });

  it('símbolo não declarado falha', () => {
    expect(() => decimalDaFonte('z', 2, ['a', 'd'])).toThrow(/valor inesperado: z/);
  });
});

describe('percentualDoSiope', () => {
  it('"0,00%" vira nulo, porque o SIOPE o usa quando não calcula', () => {
    expect(percentualDoSiope('1.1', '0,00%')).toBeNull();
  });

  it.each(['1.4', '7.3'])('no indicador %s o zero é valor real', (codigo) => {
    expect(percentualDoSiope(codigo, '0,00%')).toBe('0.00');
  });

  it('percentual com vírgula vira texto decimal', () => {
    expect(percentualDoSiope('1.1', '28,63%')).toBe('28.63');
  });

  it('fora do formato falha', () => {
    expect(() => percentualDoSiope('1.1', 'R$ 3,00')).toThrow(/percentual inesperado/);
  });
});

describe('dinheiroDoSiope', () => {
  it('reais com milhar viram texto decimal', () => {
    expect(dinheiroDoSiope('4.1', 'R$ 13.181,18')).toBe('13181.18');
  });

  it('"R$ 0,00" vira nulo', () => {
    expect(dinheiroDoSiope('4.11', 'R$ 0,00')).toBeNull();
  });

  it('no indicador 7.3 "R$ 0,00" é zero', () => {
    expect(dinheiroDoSiope('7.3', 'R$ 0,00')).toBe('0.00');
  });

  it('valor negativo é mantido', () => {
    expect(dinheiroDoSiope('7.1', 'R$ -37.533.481,12')).toBe('-37533481.12');
  });
});

describe('rendimentoFecha', () => {
  it.each([
    ['100 exato', '97.2', '2.8', '0'],
    ['0,2 acima', '97.3', '2.8', '0.1'],
    ['0,2 abaixo', '97.2', '2.6', '0'],
  ])('%s fecha', (_n, a, r, b) => {
    expect(rendimentoFecha(a, r, b)).toBe(true);
  });

  it.each([
    ['0,3 acima', '97.3', '2.9', '0.1'],
    ['0,3 abaixo', '97.1', '2.6', '0'],
  ])('%s não fecha', (_n, a, r, b) => {
    expect(rendimentoFecha(a, r, b)).toBe(false);
  });

  it('sem uma das taxas não há o que conferir', () => {
    expect(rendimentoFecha('97.2', null, '0')).toBe(true);
  });
});
