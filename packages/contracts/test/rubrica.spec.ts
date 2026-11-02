import { describe, expect, it } from 'vitest';
import { codigoRubrica, rubricaSchema } from '../src/rubrica';

describe('codigoRubrica', () => {
  it('zero à esquerda é mantido', () => {
    expect(codigoRubrica('0123')).toBe('0123');
  });

  it('código do TCE-SC com pontos é aceito como veio', () => {
    expect(codigoRubrica('1.7.1.3.50.1.1')).toBe('1.7.1.3.50.1.1');
  });

  it('rubrica numérica é recusada, porque já perdeu os zeros à esquerda', () => {
    expect(() => codigoRubrica(17135011000000)).toThrow('17135011000000');
  });

  it.each(['', 'abc', '12 34', null])('valor "%s" é recusado', (valor) => {
    expect(() => codigoRubrica(valor)).toThrow(String(valor));
  });

  it('schema recusa número com a mensagem do domínio', () => {
    expect(rubricaSchema.safeParse(123).error?.issues[0]?.message).toContain('123');
  });
});
