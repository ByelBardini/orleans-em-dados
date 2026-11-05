import { describe, expect, it } from 'vitest';
import { compararGastoEducacao, type SomaDoGasto } from '../../src/conferencia/conferencia.bo';

const etapas = (empenhado: number, liquidado: number, pago: number): SomaDoGasto[] => [
  { etapa: 'empenhado', valor: empenhado },
  { etapa: 'liquidado', valor: liquidado },
  { etapa: 'pago', valor: pago },
];

const DCA = etapas(1000.5, 900.25, 800);

describe('compararGastoEducacao', () => {
  it('três etapas iguais ficam conferidas, com diferença zero', () => {
    expect(compararGastoEducacao(2025, DCA, etapas(1000.5, 900.25, 800))).toEqual({
      ano: 2025,
      estado: 'conferido',
      etapas: [
        { etapa: 'empenhado', dca: 1000.5, betha: 1000.5, diferenca: 0, maior: null },
        { etapa: 'liquidado', dca: 900.25, betha: 900.25, diferenca: 0, maior: null },
        { etapa: 'pago', dca: 800, betha: 800, diferenca: 0, maior: null },
      ],
    });
  });

  it('soma que só chega igual em centavos, com resíduo de ponto flutuante, fica conferida', () => {
    const resultado = compararGastoEducacao(2025, etapas(0.3, 0.3, 0.3), etapas(0.1 + 0.2, 0.1 + 0.2, 0.1 + 0.2));

    expect(resultado.estado).toBe('conferido');
  });

  it('um centavo a menos na Betha numa etapa é diferença, que aponta a etapa e a DCA como o lado maior', () => {
    const resultado = compararGastoEducacao(2025, DCA, etapas(1000.5, 900.24, 800));

    if (resultado.estado !== 'diferenca') throw new Error('esperava diferença');
    expect(resultado.etapas.filter((e) => e.maior !== null)).toEqual([
      { etapa: 'liquidado', dca: 900.25, betha: 900.24, diferenca: 0.01, maior: 'dca' },
    ]);
  });

  it('Betha maior que a DCA aponta a Betha como o lado maior, com a diferença negativa', () => {
    const resultado = compararGastoEducacao(2025, DCA, etapas(1000.5, 900.25, 800.5));

    if (resultado.estado !== 'diferenca') throw new Error('esperava diferença');
    expect(resultado.etapas[2]).toEqual({ etapa: 'pago', dca: 800, betha: 800.5, diferenca: -0.5, maior: 'betha' });
  });

  it('sem coleta da Betha fica sem_betha, sem diferença calculada', () => {
    expect(compararGastoEducacao(2023, DCA, [])).toEqual({ ano: 2023, estado: 'sem_betha' });
  });

  it('sem a função na DCA fica sem_dca', () => {
    expect(compararGastoEducacao(2023, [], DCA)).toEqual({ ano: 2023, estado: 'sem_dca' });
  });

  it('etapa ausente numa das fontes é erro de dado, e não vira zero', () => {
    expect(() => compararGastoEducacao(2025, DCA.slice(0, 2), DCA)).toThrow('pago');
  });
});
