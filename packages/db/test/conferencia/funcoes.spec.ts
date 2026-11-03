import { describe, expect, it } from 'vitest';
import { compararFuncoes, type SomaDaEtapa } from '../../src/conferencia/conferencia.bo';

const etapas = (total: number, legislativa: number): SomaDaEtapa[] => [
  { etapa: 'empenhado', total, legislativa },
  { etapa: 'liquidado', total, legislativa },
  { etapa: 'pago', total, legislativa },
];

// Na DCA o total inclui a Legislativa; no TCE-SC, `total` são as UGs sem a Câmara.
const DCA = etapas(1100, 100);
const TCE = etapas(1000, 100);

describe('compararFuncoes', () => {
  it('valores iguais nas três etapas ficam conferidos, com diferença zero', () => {
    const resultado = compararFuncoes(2025, DCA, TCE);

    expect(resultado.estado).toBe('conferido');
    if (resultado.estado !== 'conferido') return;
    expect(resultado.total).toEqual({
      estado: 'conferido',
      etapas: [
        { etapa: 'empenhado', dca: 1000, tce: 1000, diferenca: 0, maior: null },
        { etapa: 'liquidado', dca: 1000, tce: 1000, diferenca: 0, maior: null },
        { etapa: 'pago', dca: 1000, tce: 1000, diferenca: 0, maior: null },
      ],
    });
    expect(resultado.legislativa.estado).toBe('conferido');
  });

  it('o total da DCA é comparado sem a Legislativa, em centavos', () => {
    const resultado = compararFuncoes(
      2025,
      etapas(153944258.42 + 2981800.76, 2981800.76),
      etapas(153944258.42, 2981800.76),
    );

    expect(resultado.estado).toBe('conferido');
  });

  it('R$ 0,01 de diferença em uma etapa é diferença, com o valor de cada fonte e o lado que registra mais', () => {
    const dca: SomaDaEtapa[] = [DCA[0]!, DCA[1]!, { etapa: 'pago', total: 1100.01, legislativa: 100 }];

    const resultado = compararFuncoes(2025, dca, TCE);

    expect(resultado.estado).toBe('diferenca');
    if (resultado.estado !== 'diferenca') return;
    expect(resultado.total.estado).toBe('diferenca');
    expect(resultado.total.etapas[2]).toEqual({
      etapa: 'pago',
      dca: 1000.01,
      tce: 1000,
      diferenca: 0.01,
      maior: 'dca',
    });
    expect(resultado.total.etapas[0]?.maior).toBeNull();
  });

  it('TCE-SC maior que a DCA aponta o TCE-SC como o lado que registra mais', () => {
    const resultado = compararFuncoes(2025, DCA, etapas(1000.5, 100));

    if (resultado.estado !== 'diferenca') throw new Error('esperava diferença');
    expect(resultado.total.etapas[0]).toEqual({
      etapa: 'empenhado',
      dca: 1000,
      tce: 1000.5,
      diferenca: -0.5,
      maior: 'tce',
    });
  });

  it('Legislativa fecha e o resto não: cada comparação tem o próprio estado', () => {
    const resultado = compararFuncoes(2025, DCA, etapas(999, 100));

    if (resultado.estado !== 'diferenca') throw new Error('esperava diferença');
    expect(resultado.total.estado).toBe('diferenca');
    expect(resultado.legislativa.estado).toBe('conferido');
  });

  it('Legislativa diferente e total sem a Câmara igual: só a Legislativa fica em diferença', () => {
    const resultado = compararFuncoes(2025, etapas(1100, 110), etapas(990, 100));

    if (resultado.estado !== 'diferenca') throw new Error('esperava diferença');
    expect(resultado.total.estado).toBe('conferido');
    expect(resultado.legislativa.estado).toBe('diferenca');
  });

  it('sem coleta do TCE-SC no ano fica sem_tce, sem diferença calculada', () => {
    expect(compararFuncoes(2023, DCA, [])).toEqual({ ano: 2023, estado: 'sem_tce' });
  });

  it('sem a coleta da DCA fica sem_dca', () => {
    expect(compararFuncoes(2023, [], TCE)).toEqual({ ano: 2023, estado: 'sem_dca' });
  });

  it('etapa ausente numa das fontes é erro de dado, e não vira zero', () => {
    expect(() => compararFuncoes(2025, DCA.slice(0, 2), TCE)).toThrow('pago');
  });
});
