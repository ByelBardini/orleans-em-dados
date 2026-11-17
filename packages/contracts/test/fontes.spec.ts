import { describe, expect, it } from 'vitest';
import { foraDaFonte } from '../src/fontes';

// "Não coletado ainda" e "a fonte não publica este ano" pedem textos diferentes na tela.
describe('foraDaFonte', () => {
  it('empenhos do TCE-SC antes de 2023 a fonte não publica', () => {
    expect(foraDaFonte(['tcesc_empenhos'], 2019)).toEqual(['tcesc_empenhos']);
  });

  it('receitas do TCE-SC antes de 2018 a fonte não publica, junto com os empenhos', () => {
    expect(foraDaFonte(['tcesc_receitas', 'tcesc_empenhos'], 2017)).toEqual(['tcesc_receitas', 'tcesc_empenhos']);
  });

  it('no primeiro exercício da fonte, faltar é só não ter coletado ainda', () => {
    expect(foraDaFonte(['tcesc_empenhos'], 2023)).toEqual([]);
  });

  it('consulta sem primeiro exercício registrado nunca está fora da fonte', () => {
    expect(foraDaFonte(['receitas', 'despesas'], 2010)).toEqual([]);
  });
});
