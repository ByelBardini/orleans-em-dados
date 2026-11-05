import { describe, expect, it } from 'vitest';
import { comparacaoSchema, fonteDoBlocoSchema, redeSchema } from '../../src/api';

const comparacao = {
  indicador: 'abandono',
  etapa: 'fundamental',
  ano: '2025',
  unidade: '%',
  fonte: { nome: 'INEP', url: 'https://www.gov.br/inep' },
  porRede: { publica: { orleans: 1.5, santaCatarina: 1.2, brasil: 2.1 } },
};

describe('comparacaoSchema', () => {
  it('aceita a meta opcional, junto com a comparação', () => {
    const meta = { valor: 60, referencia: 'PNE, meta nacional' };

    expect(comparacaoSchema.parse({ ...comparacao, meta }).meta).toEqual(meta);
  });

  it('lugar sem dado continua nulo, e zero continua zero', () => {
    const porRede = { municipal: { orleans: 0, santaCatarina: null, brasil: 2.1 } };

    expect(comparacaoSchema.parse({ ...comparacao, porRede }).porRede.municipal).toEqual({
      orleans: 0,
      santaCatarina: null,
      brasil: 2.1,
    });
  });

  it('a rede sem dado pode faltar na resposta', () => {
    expect(comparacaoSchema.parse(comparacao).porRede.privada).toBeUndefined();
  });

  it('recusa rede fora das cinco do alternador', () => {
    const porRede = { federal: { orleans: 1, santaCatarina: 1, brasil: 1 } };

    expect(comparacaoSchema.safeParse({ ...comparacao, porRede }).success).toBe(false);
  });

  it('recusa unidade fora da lista', () => {
    expect(comparacaoSchema.safeParse({ ...comparacao, unidade: 'reais' }).success).toBe(false);
  });

  it('recusa lugar faltando, porque falta de dado é nulo', () => {
    const porRede = { publica: { orleans: 1, santaCatarina: 1 } };

    expect(comparacaoSchema.safeParse({ ...comparacao, porRede }).success).toBe(false);
  });

  it('recusa campo a mais', () => {
    expect(comparacaoSchema.safeParse({ ...comparacao, escola: 'x' }).success).toBe(false);
  });
});

describe('redeSchema', () => {
  it('conhece as cinco redes, na ordem do alternador', () => {
    expect(redeSchema.options).toEqual(['publica', 'municipal', 'estadual', 'privada', 'todas']);
  });
});

describe('fonteDoBlocoSchema', () => {
  it('recusa fonte sem endereço', () => {
    expect(fonteDoBlocoSchema.safeParse({ nome: 'INEP' }).success).toBe(false);
  });
});
