import { describe, expect, it } from 'vitest';
import { anoBase, corrigir, mediaDoAno, type MesDoIpca } from '../../../src/modules/educacao/inflacao.js';

/** Os 12 meses do ano com o mesmo índice; `faltando` tira meses do fim. */
const ano = (a: number, indice: number, faltando = 0): MesDoIpca[] =>
  Array.from({ length: 12 - faltando }, (_, i) => ({
    periodo: `${a}${String(i + 1).padStart(2, '0')}`,
    valor: indice,
  }));

const SERIE = [...ano(2024, 100), ...ano(2025, 110), ...ano(2026, 120, 3)];

describe('mediaDoAno', () => {
  it('é a média dos 12 números-índice do ano', () => {
    const serie = ano(2024, 100).map((m, i) => (i === 11 ? { ...m, valor: 112 } : m));

    expect(mediaDoAno(serie, 2024)).toBe(101);
  });

  it('ano com menos de 12 meses não tem média', () => {
    expect(mediaDoAno(SERIE, 2026)).toBeNull();
  });

  it('mês nulo conta como falta', () => {
    const serie = ano(2024, 100).map((m, i) => (i === 5 ? { ...m, valor: null } : m));

    expect(mediaDoAno(serie, 2024)).toBeNull();
  });
});

describe('anoBase', () => {
  it('é o último ano com os 12 meses: o ano em curso fica de fora', () => {
    expect(anoBase(SERIE)).toBe(2025);
  });

  it('sem nenhum ano completo, não há base', () => {
    expect(anoBase(ano(2026, 120, 3))).toBeNull();
  });
});

describe('corrigir', () => {
  it('leva o valor do ano para reais do ano-base pela razão das médias', () => {
    expect(corrigir(1000, 2024, SERIE)).toBe(1100);
  });

  it('valor do próprio ano-base fica igual', () => {
    expect(corrigir(1234.56, 2025, SERIE)).toBe(1234.56);
  });

  it('arredonda uma vez só, em centavos, no fim', () => {
    // 0,05 × 110/100 = 0,055 → 0,06 (meio centavo arredonda para cima)
    expect(corrigir(0.05, 2024, SERIE)).toBe(0.06);
  });

  it('valor grande não perde centavo: 12.345.678,91 × 1,1 = 13.580.246,80', () => {
    expect(corrigir(12345678.91, 2024, SERIE)).toBe(13580246.8);
  });

  it('ano sem os 12 meses fica sem correção', () => {
    expect(corrigir(1000, 2026, SERIE)).toBeNull();
  });

  it('valor nulo continua nulo', () => {
    expect(corrigir(null, 2024, SERIE)).toBeNull();
  });

  it('série sem ano completo não corrige nada', () => {
    expect(corrigir(1000, 2026, ano(2026, 120, 3))).toBeNull();
  });
});
