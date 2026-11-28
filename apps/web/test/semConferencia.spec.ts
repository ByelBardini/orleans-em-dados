// Os textos de quando a conferência não cobre tudo: a fonte única, a lacuna da Betha e a dedução do FUNDEB.
import { describe, expect, it } from 'vitest';
import {
  avisoDeFonteUnica,
  avisoDeLacuna,
  motivoSemConferencia,
  naoPublica,
  notaDaDeducao,
  RECEITA_BRUTA,
} from '../src/semConferencia';

const NBSP = ' ';

describe('naoPublica', () => {
  it('junta as consultas que a fonte não publica com "nem"', () => {
    expect(naoPublica(['tcesc_receitas', 'tcesc_empenhos'], 2016)).toBe(
      'O TCE-SC não publica as receitas nem os empenhos de 2016',
    );
  });
});

describe('avisoDeFonteUnica', () => {
  it('na receita, diz que a fonte não publica e que os números são só do Portal da Transparência', () => {
    expect(avisoDeFonteUnica(['tcesc_receitas'], 2017)).toBe(
      'O TCE-SC não publica as receitas de 2017. Os números são só do Portal da Transparência, sem conferência.',
    );
  });

  it('com o recorte, diz de quais números', () => {
    expect(avisoDeFonteUnica(['tcesc_empenhos'], 2019, 'da despesa')).toBe(
      'O TCE-SC não publica os empenhos de 2019. Os números da despesa são só do Portal da Transparência, sem conferência.',
    );
  });
});

describe('avisoDeLacuna', () => {
  it.each([
    ['Prefeitura', 'da Prefeitura'],
    ['Fundação Ambiental', 'da Fundação Ambiental'],
    ['FMS', 'do FMS'],
    ['SAMAE', 'do SAMAE'],
  ])('a entidade %s sai com o artigo certo e o valor do TCE-SC', (entidade, comArtigo) => {
    expect(avisoDeLacuna({ codigo: '1', entidade, totalTce: 74677758.7 }, 2020)).toBe(
      `O Portal da Transparência não publica a receita ${comArtigo} em 2020. O TCE-SC registra R$${NBSP}74.677.758,70.`,
    );
  });
});

describe('a receita bruta', () => {
  it('o rótulo diz que é antes da dedução do FUNDEB', () => {
    expect(RECEITA_BRUTA).toBe('receita bruta, antes da dedução do FUNDEB');
  });

  it('a nota da dedução diz o valor em módulo e que o Portal da Transparência não a publica', () => {
    expect(notaDaDeducao(-7939733.75)).toBe(
      `O TCE-SC registra a dedução do FUNDEB de R$${NBSP}7.939.733,75, que o Portal da Transparência não publica neste ano.`,
    );
  });
});

describe('motivoSemConferencia', () => {
  it('sem a fonte dizer que não publica, a despesa ainda não tem as duas fontes', () => {
    expect(motivoSemConferencia(2026, undefined)).toBe('A despesa de 2026 ainda não tem as duas fontes publicadas.');
  });
});
