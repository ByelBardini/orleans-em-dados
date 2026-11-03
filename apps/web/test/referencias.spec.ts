import { describe, expect, it } from 'vitest';
import { nomeDaFuncao, sujeito } from '../src/referencias';

describe('nomeDaFuncao', () => {
  it('rótulo do dia a dia vem com o nome oficial à parte', () => {
    expect(nomeDaFuncao('26', 'Transporte')).toEqual({ nome: 'Estradas e transporte', oficial: 'Transporte' });
  });

  it('função já em linguagem do dia a dia fica só com o nome oficial', () => {
    expect(nomeDaFuncao('10', 'Saúde')).toEqual({ nome: 'Saúde', oficial: null });
  });

  it('função sem rótulo próprio fica com o nome oficial', () => {
    expect(nomeDaFuncao('99', 'Reserva de Contingência')).toEqual({ nome: 'Reserva de Contingência', oficial: null });
  });

  it('rótulo que só muda a caixa do oficial não repete o nome', () => {
    expect(nomeDaFuncao('08', 'Assistência Social')).toEqual({ nome: 'Assistência Social', oficial: null });
  });

  it('código com zero à esquerda é respeitado', () => {
    expect(nomeDaFuncao('04', 'Administração')).toEqual({
      nome: 'Administração da prefeitura',
      oficial: 'Administração',
    });
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
