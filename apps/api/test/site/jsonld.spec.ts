import { paginaPeloId } from '@orleans-em-dados/contracts';
import { describe, expect, it } from 'vitest';
import { jsonLdDaPagina, serializarJsonLd } from '../../src/site/jsonld.js';

const SITE = 'https://exemplo.test';
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

type Bloco = Record<string, unknown>;
const doTipo = (blocos: Bloco[], tipo: string) => blocos.find((b) => b['@type'] === tipo);

describe('jsonLdDaPagina: a capa', () => {
  const blocos = jsonLdDaPagina(paginaPeloId('visao-geral'), { siteUrl: SITE, anos: [2025, 2024] });
  const site = doTipo(blocos, 'WebSite');

  it('se descreve como WebSite em português, sobre a cidade de Orleans, em Santa Catarina', () => {
    expect(site).toMatchObject({
      '@context': 'https://schema.org',
      name: 'Orleans em Dados',
      url: 'https://exemplo.test/',
      inLanguage: 'pt-BR',
      about: { '@type': 'City', name: 'Orleans', containedInPlace: { '@type': 'State', name: 'Santa Catarina' } },
    });
  });

  it('quem publica é o projeto, nunca a Prefeitura', () => {
    expect(site?.publisher).toEqual({
      '@type': 'Organization',
      name: 'Orleans em Dados',
      url: 'https://exemplo.test/',
    });
  });

  it('não é conjunto de dados nem tem trilha de navegação', () => {
    expect(blocos.map((b) => b['@type'])).toEqual(['WebSite']);
  });
});

describe('jsonLdDaPagina: Receitas como Dataset', () => {
  const blocos = jsonLdDaPagina(paginaPeloId('receitas'), { siteUrl: SITE, anos: [2025, 2018, 2024] });
  const dataset = doTipo(blocos, 'Dataset');

  it('traz nome, descrição longa, licença CC BY, acesso livre, criador e a cidade', () => {
    expect(dataset).toMatchObject({
      '@context': 'https://schema.org',
      name: 'Receitas do município de Orleans/SC',
      url: 'https://exemplo.test/financas/receitas',
      license: CC_BY,
      isAccessibleForFree: true,
      inLanguage: 'pt-BR',
      creator: { '@type': 'Organization', name: 'Orleans em Dados', url: 'https://exemplo.test/' },
      spatialCoverage: { '@type': 'City', name: 'Orleans' },
    });
    expect(String(dataset?.description).length).toBeGreaterThanOrEqual(50);
  });

  it('o período vai do primeiro ao último exercício publicado', () => {
    expect(dataset?.temporalCoverage).toBe('2018/2025');
  });

  it('cita como base as fontes do catálogo, com o endereço de cada uma', () => {
    expect(dataset?.isBasedOn).toEqual([
      {
        '@type': 'CreativeWork',
        name: 'Portal da Transparência de Orleans',
        url: 'https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==',
      },
      { '@type': 'CreativeWork', name: 'Farol do TCE-SC', url: 'https://servicos.tcesc.tc.br/farol_externo/' },
    ]);
  });

  it('distribui o CSV de receitas do último exercício', () => {
    expect(dataset?.distribution).toEqual([
      {
        '@type': 'DataDownload',
        encodingFormat: 'text/csv',
        contentUrl: 'https://exemplo.test/api/receitas.csv?ano=2025',
      },
    ]);
  });

  it('com a trilha Início › Finanças › Receitas, em URL absoluta', () => {
    expect(doTipo(blocos, 'BreadcrumbList')?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://exemplo.test/' },
      { '@type': 'ListItem', position: 2, name: 'Finanças', item: 'https://exemplo.test/financas' },
      { '@type': 'ListItem', position: 3, name: 'Receitas', item: 'https://exemplo.test/financas/receitas' },
    ]);
  });
});

describe('jsonLdDaPagina: as outras páginas', () => {
  // O CSV de empenhos traz nome de credor que pode ser pessoa física: não vira distribuição de nada.
  it('Despesas é Dataset sem distribuição de empenhos', () => {
    const dataset = doTipo(jsonLdDaPagina(paginaPeloId('despesas'), { siteUrl: SITE, anos: [2025] }), 'Dataset');

    expect(dataset?.temporalCoverage).toBe('2025');
    expect(dataset).not.toHaveProperty('distribution');
    expect(JSON.stringify(dataset)).not.toContain('empenhos.csv');
  });

  it('sem exercício publicado, o Dataset sai sem período e sem CSV', () => {
    const dataset = doTipo(jsonLdDaPagina(paginaPeloId('receitas'), { siteUrl: SITE, anos: [] }), 'Dataset');

    expect(dataset).not.toHaveProperty('temporalCoverage');
    expect(dataset).not.toHaveProperty('distribution');
    expect(dataset?.license).toBe(CC_BY);
  });

  // Os exercícios publicados são os da Betha: não dizem o período do IBGE nem o da Educação.
  it.each(['conheca-orleans', 'educacao', 'para-onde-vai'] as const)(
    '%s é Dataset sem o período das finanças',
    (id) => {
      const dataset = doTipo(jsonLdDaPagina(paginaPeloId(id), { siteUrl: SITE, anos: [2025, 2018] }), 'Dataset');

      expect(dataset?.['@type']).toBe('Dataset');
      expect(dataset).not.toHaveProperty('temporalCoverage');
    },
  );

  it('uma página de segundo nível da Educação tem a trilha Início › Educação › Dinheiro e não é Dataset', () => {
    const blocos = jsonLdDaPagina(paginaPeloId('educacao-dinheiro'), { siteUrl: SITE, anos: [] });

    expect(blocos.map((b) => b['@type'])).toEqual(['BreadcrumbList']);
    expect(doTipo(blocos, 'BreadcrumbList')?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://exemplo.test/' },
      { '@type': 'ListItem', position: 2, name: 'Educação', item: 'https://exemplo.test/educacao' },
      { '@type': 'ListItem', position: 3, name: 'Dinheiro', item: 'https://exemplo.test/educacao/dinheiro' },
    ]);
  });

  it('página de primeiro nível sem dados (Discrepâncias) não leva JSON-LD', () => {
    expect(jsonLdDaPagina(paginaPeloId('discrepancias'), { siteUrl: SITE, anos: [2025] })).toEqual([]);
  });
});

describe('serializarJsonLd', () => {
  it('um fechamento de script dentro de um texto não fecha a tag', () => {
    const texto = serializarJsonLd({ name: 'a</script><script>alert(1)</script>' });

    expect(texto).toBe('{"name":"a<\\/script><script>alert(1)<\\/script>"}');
    expect(texto).not.toContain('</script>');
  });

  it('um comentário HTML aberto dentro de um texto também é neutralizado', () => {
    expect(serializarJsonLd({ name: '<!-- x' })).not.toContain('<!--');
  });
});
