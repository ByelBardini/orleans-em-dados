import { describe, expect, it } from 'vitest';
import { moeda, pct, percentual } from '../src/format.js';

// O Intl do pt-BR separa "R$" do número com espaço não separável (U+00A0).
const NBSP = ' ';

describe('moeda', () => {
  it('valor com milhar sai em reais com ponto de milhar e vírgula decimal', () => {
    expect(moeda(1234.56)).toBe(`R$${NBSP}1.234,56`);
  });

  it('zero é exibido como valor, não como ausência', () => {
    expect(moeda(0)).toBe(`R$${NBSP}0,00`);
  });

  it('valor negativo mantém o sinal', () => {
    expect(moeda(-0.5)).toBe(`-R$${NBSP}0,50`);
  });

  it.each([null, undefined])('valor %s não vira zero e aparece como travessão', (valor) => {
    expect(moeda(valor)).toBe('—');
  });
});

describe('pct', () => {
  it.each([
    [1, 3, '33,3%'],
    [1, 2, '50,0%'],
  ])('%s de %s com uma casa fixa é %s', (parte, total, esperado) => {
    expect(pct(parte, total)).toBe(esperado);
  });

  it('casas decimais pedidas como zero arredondam para o inteiro', () => {
    expect(pct(1, 3, 0)).toBe('33%');
  });

  it('parte negativa mantém o sinal no percentual', () => {
    expect(pct(-1, 4)).toBe('-25,0%');
  });

  it.each([0, null])('total %s não tem percentual e aparece como travessão', (total) => {
    expect(pct(1, total)).toBe('—');
  });
});

describe('percentual', () => {
  it.each([
    [1, 2, '50%'],
    [1, 3, '33,3%'],
  ])('%s de %s sem casas forçadas é %s', (parte, total, esperado) => {
    expect(percentual(parte, total)).toBe(esperado);
  });

  it('total zero não tem percentual e aparece como travessão', () => {
    expect(percentual(1, 0)).toBe('—');
  });
});
