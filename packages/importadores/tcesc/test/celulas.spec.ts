import { describe, expect, it } from 'vitest';
import { centavosDoMotor, textoDaCelula, type CelulaQlik } from '../src/celulas';

describe('centavosDoMotor', () => {
  it('double do motor com resíduo vira os centavos exatos', () => {
    expect(centavosDoMotor(170915184.25000012)).toBe(17091518425n);
  });

  it('negativo mantém o sinal', () => {
    expect(centavosDoMotor(-5000.25)).toBe(-500025n);
  });

  it('zero é valor', () => {
    expect(centavosDoMotor(0)).toBe(0n);
  });

  it('valor que não cai sobre um centavo inteiro é recusado com nulo', () => {
    expect(centavosDoMotor(10.123)).toBeNull();
  });

  it.each(['NaN', undefined, Number.NaN, Number.POSITIVE_INFINITY])('qNum %s não é dinheiro', (qNum) => {
    expect(centavosDoMotor(qNum)).toBeNull();
  });
});

describe('textoDaCelula', () => {
  it('devolve o texto da célula', () => {
    expect(textoDaCelula({ qText: 'ORLEANS', qNum: 'NaN' })).toBe('ORLEANS');
  });

  it.each([
    ['qIsNull', { qIsNull: true, qText: 'x' }],
    ['traço do Qlik', { qText: '-', qNum: 'NaN' }],
    ['sem texto', { qNum: 'NaN' }],
  ])('%s é nulo', (_caso, celula) => {
    expect(textoDaCelula(celula as CelulaQlik)).toBeNull();
  });
});
