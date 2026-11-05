import { describe, expect, it } from 'vitest';
import { fraseDaSerie, melhorDaSerie } from '../../src/educacao/serie';

const ponto = (ano: number, valor: number | null) => ({ ano, valor });

describe('melhorDaSerie', () => {
  it('o último ano acima de todos os outros é o melhor da série', () => {
    expect(melhorDaSerie([ponto(2021, 6), ponto(2023, 6.2), ponto(2025, 6.6)])).toEqual({ ano: 2025, valor: 6.6 });
  });

  it('o último ano abaixo de um anterior não é o melhor, mesmo acima do penúltimo', () => {
    expect(melhorDaSerie([ponto(2021, 6.8), ponto(2023, 6.1), ponto(2025, 6.4)])).toBeNull();
  });

  it('empate com um ano anterior não é o melhor', () => {
    expect(melhorDaSerie([ponto(2023, 6.6), ponto(2025, 6.6)])).toBeNull();
  });

  it('com o último ano sem dado, não há frase de melhor, mesmo que o anterior seja o maior', () => {
    expect(melhorDaSerie([ponto(2021, 4), ponto(2023, 5), ponto(2025, null)])).toBeNull();
  });

  it('um ano só não é série', () => {
    expect(melhorDaSerie([ponto(2021, null), ponto(2025, 3.9)])).toBeNull();
  });

  it('as lacunas no meio não contam como valor', () => {
    expect(melhorDaSerie([ponto(2017, 3.7), ponto(2021, null), ponto(2025, 3.9)])).toEqual({ ano: 2025, valor: 3.9 });
  });
});

describe('fraseDaSerie', () => {
  it('quando o último ano é o melhor, a frase diz', () => {
    expect(fraseDaSerie([ponto(2023, 6.2), ponto(2025, 6.6)])).toBe('6,6 em 2025, o melhor IDEB da série.');
  });

  it('quando não é, mostra o maior da série e o ano dele', () => {
    expect(fraseDaSerie([ponto(2023, 6.8), ponto(2025, 6.4)])).toBe('6,4 em 2025. O melhor da série foi 6,8, em 2023.');
  });

  it('em empate no maior, cita o ano mais recente dele', () => {
    expect(fraseDaSerie([ponto(2019, 6.8), ponto(2023, 6.8), ponto(2025, 6.4)])).toBe(
      '6,4 em 2025. O melhor da série foi 6,8, em 2023.',
    );
  });

  it('com o último ano sem dado, cita o último publicado, sem falar em melhor', () => {
    expect(fraseDaSerie([ponto(2021, 4), ponto(2023, 5), ponto(2025, null)])).toBe('Último dado: 5,0, em 2023.');
  });

  it('com um ano só, cita o valor', () => {
    expect(fraseDaSerie([ponto(2021, null), ponto(2025, 3.9)])).toBe('3,9 em 2025, o único ano com dado.');
  });

  it('sem nenhum valor, não há frase', () => {
    expect(fraseDaSerie([ponto(2021, null)])).toBeNull();
  });
});
