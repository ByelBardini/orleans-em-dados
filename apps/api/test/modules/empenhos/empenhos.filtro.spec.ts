import { describe, expect, it } from 'vitest';
import { filtroBusca } from '../../../src/modules/empenhos/empenhos.filtro';

describe('filtroBusca', () => {
  it('sem filtros, os parâmetros ficam vazios e não há cláusula de situação', () => {
    const { filtro, params } = filtroBusca({});

    expect(params).toEqual(['', '', '']);
    expect(filtro).not.toContain('saldo');
    expect(filtro).not.toContain('liquidado');
  });

  it('o termo de busca vai sem espaços nas pontas', () => {
    expect(filtroBusca({ q: '  merenda ' }).params).toEqual(['', 'merenda', '']);
  });

  it('entidade e órgão vão como parâmetros, na ordem do SQL', () => {
    expect(filtroBusca({ entidade: '728', orgao: 'OBRAS' }).params).toEqual(['728', '', 'OBRAS']);
  });

  it.each([
    ['pago', 'e.liquidado > 0 AND e.saldo = 0'],
    ['apagar', 'e.liquidado > 0 AND e.saldo > 0'],
    ['sem', '(e.liquidado IS NULL OR e.liquidado = 0)'],
  ])('situação %s acrescenta a própria cláusula', (situacao, clausula) => {
    expect(filtroBusca({ situacao }).filtro).toContain(`AND ${clausula}`);
  });

  it('situação desconhecida é ignorada', () => {
    expect(filtroBusca({ situacao: 'desconhecida' }).filtro).toBe(filtroBusca({}).filtro);
  });

  // Regressão: `?situacao=constructor` pegava o método herdado de Object e injetava o texto
  // da função no SQL, resultando em erro 500 (armadilha do objeto usado como mapa).
  it.each(['constructor', 'toString', '__proto__'])('situação %s, herdada de Object, é ignorada', (situacao) => {
    expect(filtroBusca({ situacao }).filtro).toBe(filtroBusca({}).filtro);
  });

  it('o valor pedido pelo usuário nunca entra no texto do SQL', () => {
    const { filtro } = filtroBusca({ q: "x'; DROP TABLE", entidade: "y'", orgao: "z'", situacao: "injetado'; --" });

    expect(filtro).not.toContain('DROP');
    expect(filtro).not.toContain("y'");
    expect(filtro).not.toContain('injetado');
  });
});
