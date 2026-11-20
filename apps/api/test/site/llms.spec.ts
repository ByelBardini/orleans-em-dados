import { describe, expect, it } from 'vitest';
import { montarLlms } from '../../src/site/llms.js';

const SITE = 'https://exemplo.test';

describe('montarLlms', () => {
  const texto = montarLlms({ siteUrl: SITE, apoioAtivo: false });

  it('abre com o título e o resumo de uma linha, no formato do llms.txt', () => {
    const [titulo, vazia, resumo] = texto.split('\n');

    expect(titulo).toBe('# Orleans em Dados');
    expect(vazia).toBe('');
    expect(resumo).toMatch(/^> .*Orleans\/SC/);
  });

  it('avisa que o projeto é independente e que diferença entre fontes não é acusação', () => {
    expect(texto).toContain(
      'Projeto independente, sem vínculo com a Prefeitura de Orleans nem com os órgãos de controle.',
    );
    expect(texto).toContain('Diferença entre fontes não indica irregularidade');
  });

  it('traz uma linha por página, com o endereço absoluto e a descrição do catálogo', () => {
    expect(texto).toContain(
      '- [Receitas](https://exemplo.test/financas/receitas): Receitas do município de Orleans/SC por mês, origem e rubrica, do Portal da Transparência conferidas com o TCE-SC, com a previsão e a arrecadação.',
    );
    expect(texto.match(/^- \[[^\]]+\]\(https:\/\/exemplo\.test\/[^)]*\): /gm)).toHaveLength(15);
  });

  it('sem o apoio, a página Apoiar fica de fora; com ele, entra', () => {
    expect(texto).not.toContain('/apoiar');
    expect(montarLlms({ siteUrl: SITE, apoioAtivo: true })).toContain('- [Apoiar](https://exemplo.test/apoiar): ');
  });

  it('lista as fontes com o endereço de cada uma', () => {
    expect(texto).toContain('## Fontes');
    expect(texto).toContain('- [Farol do TCE-SC](https://servicos.tcesc.tc.br/farol_externo/)');
    expect(texto).toContain('- [INEP](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos)');
  });

  it('sem SITE_URL, os links das páginas ficam relativos', () => {
    expect(montarLlms({ apoioAtivo: false })).toContain('- [Receitas](/financas/receitas): ');
  });
});
