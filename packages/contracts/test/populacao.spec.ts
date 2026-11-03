import { describe, expect, it } from 'vitest';
import { populacaoDoAno, type PontoDaPopulacao } from '../src/populacao';

const SERIE: PontoDaPopulacao[] = [
  { ano: 2010, populacao: 21000, tipo: 'censo' },
  { ano: 2021, populacao: 23000, tipo: 'estimativa' },
  { ano: 2022, populacao: 23500, tipo: 'censo' },
  { ano: 2024, populacao: 24000, tipo: 'estimativa' },
];

describe('populacaoDoAno', () => {
  it('ano com estimativa usa a estimativa do próprio ano', () => {
    expect(populacaoDoAno(SERIE, 2024)).toEqual({ ano: 2024, populacao: 24000, tipo: 'estimativa' });
  });

  it('ano de censo usa o censo', () => {
    expect(populacaoDoAno(SERIE, 2022)).toEqual({ ano: 2022, populacao: 23500, tipo: 'censo' });
  });

  it('ano sem número usa o anterior mais próximo', () => {
    expect(populacaoDoAno(SERIE, 2023)).toEqual({ ano: 2022, populacao: 23500, tipo: 'censo' });
  });

  it('ano depois da série usa o último', () => {
    expect(populacaoDoAno(SERIE, 2030)?.ano).toBe(2024);
  });

  it('ano antes da série não tem população', () => {
    expect(populacaoDoAno(SERIE, 2009)).toBeNull();
  });

  it('série vazia não tem população', () => {
    expect(populacaoDoAno([], 2024)).toBeNull();
  });

  it('série fora de ordem dá o mesmo resultado', () => {
    expect(populacaoDoAno([...SERIE].reverse(), 2023)?.ano).toBe(2022);
  });
});
