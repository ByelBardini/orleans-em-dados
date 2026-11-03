import { describe, expect, it } from 'vitest';
import { pibPerCapita } from '../../src/modules/municipio/municipio.service';

describe('pibPerCapita', () => {
  it('converte mil reais em reais por pessoa, com dois centavos de precisão', () => {
    expect(pibPerCapita(1408944, 23661)).toBe(59547.1);
  });

  it('PIB sem valor não vira zero', () => {
    expect(pibPerCapita(null, 23661)).toBeNull();
  });

  it('sem população não há divisão', () => {
    expect(pibPerCapita(1408944, null)).toBeNull();
  });
});
