import { describe, expect, it } from 'vitest';
import { exercicio, exercicioSchema } from '../src/exercicio';

describe('exercicio', () => {
  it('ano de quatro dígitos é aceito', () => {
    expect(exercicio(2025)).toBe(2025);
  });

  it('texto de ano vira número', () => {
    expect(exercicio('2025')).toBe(2025);
  });

  it.each([25, 2025.5, 0, -2025, 20250, 'abc', '', null, undefined])('valor %s é recusado', (valor) => {
    expect(() => exercicio(valor)).toThrow(String(valor));
  });

  it('schema recusa ano inválido com a mensagem do domínio', () => {
    expect(exercicioSchema.safeParse(25).error?.issues[0]?.message).toContain('25');
  });
});
