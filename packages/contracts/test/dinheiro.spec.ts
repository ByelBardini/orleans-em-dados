import { describe, expect, it } from 'vitest';
import { centavos, deCentavos, dinheiro, dinheiroSchema, somar } from '../src/dinheiro';

describe('dinheiro', () => {
  it('texto decimal vira centavos exatos e volta igual', () => {
    const valor = dinheiro('1234.56');
    expect(centavos(valor)).toBe(123456n);
    expect(deCentavos(123456n)).toBe('1234.56');
  });

  it('negativo pequeno mantém o sinal nos dois sentidos', () => {
    expect(centavos(dinheiro('-0.01'))).toBe(-1n);
    expect(deCentavos(-1n)).toBe('-0.01');
  });

  it.each([
    ['0.1', '0.10'],
    ['1234', '1234.00'],
    ['-5000.25', '-5000.25'],
    ['-0.00', '0.00'],
    ['007.50', '7.50'],
  ])('texto %s é normalizado para %s', (entrada, esperado) => {
    expect(dinheiro(entrada)).toBe(esperado);
  });

  it.each([
    [250000.5, '250000.50'],
    [-5000.25, '-5000.25'],
    [300000, '300000.00'],
  ])('número %s da fonte com até duas casas vira %s', (entrada, esperado) => {
    expect(dinheiro(entrada)).toBe(esperado);
  });

  it.each(['1234.567', '1e3', '', 'abc', '1.234,56', ' 10', 'NaN'])(
    'texto "%s" é recusado citando o valor',
    (valor) => {
      expect(() => dinheiro(valor)).toThrow(`"${valor}"`);
    },
  );

  it('número com erro de ponto flutuante é recusado', () => {
    expect(() => dinheiro(0.1 + 0.2)).toThrow('0.30000000000000004');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('número %s é recusado', (valor) => {
    expect(() => dinheiro(valor)).toThrow(String(valor));
  });

  it('valor além do inteiro seguro continua exato em centavos', () => {
    expect(centavos(dinheiro('90071992547409.93'))).toBe(9007199254740993n);
  });
});

describe('somar', () => {
  it('mil parcelas de dez centavos somam cem reais exatos', () => {
    expect(somar(Array.from({ length: 1000 }, () => dinheiro('0.10')))).toBe('100.00');
  });

  it('positivos e negativos se compensam até zero', () => {
    expect(somar([dinheiro('5000.25'), dinheiro('-5000.25')])).toBe('0.00');
  });

  it('lista vazia soma zero', () => {
    expect(somar([])).toBe('0.00');
  });
});

describe('dinheiroSchema', () => {
  it('aceita número da fonte e entrega texto decimal', () => {
    expect(dinheiroSchema.parse(250000.5)).toBe('250000.50');
  });

  it('recusa valor inválido sem lançar exceção de domínio', () => {
    const resultado = dinheiroSchema.safeParse('1234.567');
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toContain('1234.567');
  });
});
