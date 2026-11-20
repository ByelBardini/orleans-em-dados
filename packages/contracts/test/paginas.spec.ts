import { describe, expect, it } from 'vitest';
import { caminhoDoHashAntigo, PAGINAS, paginaDoCaminho } from '../src/paginas.js';

describe('paginaDoCaminho', () => {
  it('o caminho de uma página de segundo nível dá a página e a área dela', () => {
    const achada = paginaDoCaminho('/financas/receitas');

    expect(achada?.pagina.id).toBe('receitas');
    expect(achada?.pagina.area).toBe('financas');
    expect(achada?.redirecionar).toBeNull();
  });

  it('a raiz é a capa', () => {
    expect(paginaDoCaminho('/')?.pagina.id).toBe('visao-geral');
  });

  it('barra no fim acha a página e pede o redirecionamento para o caminho sem ela', () => {
    const achada = paginaDoCaminho('/financas/receitas/');

    expect(achada?.pagina.id).toBe('receitas');
    expect(achada?.redirecionar).toBe('/financas/receitas');
  });

  it('caixa alta não é adivinhada: o caminho não existe', () => {
    expect(paginaDoCaminho('/Financas')).toBeNull();
  });

  it.each(['/financas/x', '/educacao/dinheiro/2024', '', '//'])('caminho desconhecido %j não é página', (caminho) => {
    expect(paginaDoCaminho(caminho)).toBeNull();
  });

  it('a página Apoiar existe, fora do menu', () => {
    const achada = paginaDoCaminho('/apoiar');

    expect(achada?.pagina.id).toBe('apoiar');
    expect(achada?.pagina.menu).toBe(false);
  });
});

describe('caminhoDoHashAntigo', () => {
  it.each([
    ['#educacao-dinheiro', '/educacao/dinheiro'],
    ['#receitas', '/financas/receitas'],
    ['#visao-geral', '/'],
    ['#conferencia', '/discrepancias'],
    ['#metodologia', '/sobre-os-dados'],
    ['#educacao-professores', '/educacao/professores-e-turmas'],
  ])('o link antigo %s vai para %s', (hash, caminho) => {
    expect(caminhoDoHashAntigo(hash)).toBe(caminho);
  });

  it.each(['#nada', '', '#', 'receitas'])('%j não é endereço antigo', (hash) => {
    expect(caminhoDoHashAntigo(hash)).toBeNull();
  });
});

describe('PAGINAS', () => {
  it('são as dezesseis páginas, cada uma com caminho próprio', () => {
    const caminhos = PAGINAS.map((p) => p.caminho);

    expect(caminhos).toHaveLength(16);
    expect(new Set(caminhos).size).toBe(16);
  });

  it('os caminhos são os do plano, com as áreas de primeiro nível na frente', () => {
    expect(PAGINAS.map((p) => [p.id, p.caminho, p.area])).toEqual([
      ['visao-geral', '/', 'visao-geral'],
      ['conheca-orleans', '/conheca-orleans', 'conheca-orleans'],
      ['financas', '/financas', 'financas'],
      ['receitas', '/financas/receitas', 'financas'],
      ['despesas', '/financas/despesas', 'financas'],
      ['para-onde-vai', '/financas/para-onde-vai', 'financas'],
      ['educacao', '/educacao', 'educacao'],
      ['educacao-aprendizado', '/educacao/aprendizado', 'educacao'],
      ['educacao-acesso', '/educacao/acesso', 'educacao'],
      ['educacao-permanencia', '/educacao/permanencia', 'educacao'],
      ['educacao-professores', '/educacao/professores-e-turmas', 'educacao'],
      ['educacao-dinheiro', '/educacao/dinheiro', 'educacao'],
      ['educacao-cidade', '/educacao/cidade-e-ensino-superior', 'educacao'],
      ['discrepancias', '/discrepancias', 'discrepancias'],
      ['metodologia', '/sobre-os-dados', 'metodologia'],
      ['apoiar', '/apoiar', 'apoiar'],
    ]);
  });

  // O Google corta o título perto de 60 caracteres e a descrição perto de 160; abaixo de 70, sobra espaço.
  it.each(PAGINAS.map((p) => [p.id, p]))('%s tem título de até 60 caracteres', (_id, p) => {
    expect(p.titulo.length).toBeLessThanOrEqual(60);
  });

  it.each(PAGINAS.map((p) => [p.id, p]))('%s tem descrição entre 70 e 160 caracteres', (_id, p) => {
    expect(p.descricao.length).toBeGreaterThanOrEqual(70);
    expect(p.descricao.length).toBeLessThanOrEqual(160);
  });

  // A descrição é fixa: um valor nela desatualiza e foge da regra do selo.
  it.each(PAGINAS.map((p) => [p.id, p]))('%s não traz valor em reais na descrição', (_id, p) => {
    expect(p.descricao).not.toMatch(/R\$|\d/);
  });

  it('as páginas de dados descritas como conjunto de dados são as cinco do plano', () => {
    expect(PAGINAS.filter((p) => p.dataset).map((p) => p.id)).toEqual([
      'conheca-orleans',
      'receitas',
      'despesas',
      'para-onde-vai',
      'educacao',
    ]);
  });

  it('toda página de dados cita ao menos uma fonte, com endereço https', () => {
    for (const p of PAGINAS.filter((p) => p.dataset)) {
      expect(p.fontes.length, p.id).toBeGreaterThan(0);
      for (const fonte of p.fontes) expect(fonte.url, `${p.id}: ${fonte.nome}`).toMatch(/^https:\/\//);
    }
  });

  it('o primeiro nível do menu são as seis áreas, sem a página Apoiar', () => {
    expect(PAGINAS.filter((p) => p.menu && p.area === p.id).map((p) => p.nome)).toEqual([
      'Início',
      'Conheça Orleans',
      'Finanças',
      'Educação',
      'Discrepâncias',
      'Sobre os dados',
    ]);
  });
});
