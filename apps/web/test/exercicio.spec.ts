import { describe, expect, it } from 'vitest';
import { ultimoExercicioEncerrado } from '../src/exercicio';

const NOVEMBRO_DE_2026 = new Date(2026, 10, 2);

describe('ultimoExercicioEncerrado', () => {
  it('com o ano corrente publicado, fica no anterior', () => {
    expect(ultimoExercicioEncerrado([2026, 2025, 2024], NOVEMBRO_DE_2026)).toBe(2025);
  });

  it('a ordem da lista não importa', () => {
    expect(ultimoExercicioEncerrado([2023, 2025, 2024], NOVEMBRO_DE_2026)).toBe(2025);
  });

  it('só com o ano corrente publicado, não há exercício encerrado', () => {
    expect(ultimoExercicioEncerrado([2026], NOVEMBRO_DE_2026)).toBeNull();
  });

  it('lista vazia não tem exercício', () => {
    expect(ultimoExercicioEncerrado([], NOVEMBRO_DE_2026)).toBeNull();
  });
});
