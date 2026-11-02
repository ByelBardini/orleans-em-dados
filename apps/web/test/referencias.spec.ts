import { describe, expect, it } from 'vitest';
import { populacao, sujeito } from '../src/referencias';

describe('populacao', () => {
  it('ano com número usa o dele', () => {
    expect(populacao(2025)).toEqual({ pessoas: 24686, fonte: 'IBGE, estimativa 2025' });
  });

  it('ano sem número usa o mais próximo anterior', () => {
    expect(populacao(2024).pessoas).toBe(23661);
    expect(populacao(2030).pessoas).toBe(24686);
  });

  it('ano antes de qualquer número usa o mais antigo', () => {
    expect(populacao(2010).pessoas).toBe(23661);
  });
});

describe('sujeito', () => {
  it('sem entidade, a frase fala de Orleans', () => {
    expect(sujeito('')).toBe('Orleans');
  });

  it('entidade conhecida entra com o artigo certo', () => {
    expect(sujeito('2473')).toBe('o SAMAE');
    expect(sujeito('728')).toBe('a Prefeitura');
  });

  it('entidade nova usa a sigla da lista', () => {
    expect(sujeito('999', [{ codigo: '999', sigla: 'Nova' }])).toBe('Nova');
  });

  it('entidade que nem a lista conhece vira "a entidade"', () => {
    expect(sujeito('999')).toBe('a entidade');
  });
});
