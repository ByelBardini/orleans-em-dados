import { describe, expect, it } from 'vitest';
import { anosDeHistorico, janelaDeAnos } from '../src/janela';

const AGORA = new Date('2026-11-16T12:00:00.000Z');

describe('janelaDeAnos', () => {
  it('janela de 10 vai dos 10 exercícios encerrados ao corrente, em ordem crescente', () => {
    expect(janelaDeAnos(AGORA, 10)).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });

  it('janela zero é só o exercício corrente', () => {
    expect(janelaDeAnos(AGORA, 0)).toEqual([2026]);
  });

  it('o primeiro exercício da fonte corta o começo da janela', () => {
    expect(janelaDeAnos(AGORA, 10, { primeiro: 2023 })).toEqual([2023, 2024, 2025, 2026]);
  });

  it('o último exercício da fonte corta o fim da janela', () => {
    expect(janelaDeAnos(AGORA, 3, { ultimo: 2024 })).toEqual([2023, 2024]);
  });

  it('primeiro exercício depois do último deixa a janela vazia', () => {
    expect(janelaDeAnos(AGORA, 10, { primeiro: 2027 })).toEqual([]);
  });
});

describe('anosDeHistorico', () => {
  it.each([
    ['5', 5],
    ['0', 0],
    ['15', 15],
  ])('ANOS_DE_HISTORICO=%s vale %i', (valor, anos) => {
    expect(anosDeHistorico(valor)).toBe(anos);
  });

  it.each([[undefined], [''], ['-1'], ['2.5'], ['dez']])('valor %j vira o padrão de 10', (valor) => {
    expect(anosDeHistorico(valor)).toBe(10);
  });
});
