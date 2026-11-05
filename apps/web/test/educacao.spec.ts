import type { ComparacaoDeEducacao } from '@orleans-em-dados/contracts';
import { describe, expect, it } from 'vitest';
import {
  cercaDe,
  escalaDaComparacao,
  formatarValor,
  NOMES_DE_ETAPA,
  NOMES_DE_REDE,
  posicaoNaEscala,
  redesComDado,
  trechosDaSerie,
} from '../src/educacao';

const comparacao = (mudancas: Partial<ComparacaoDeEducacao> = {}): ComparacaoDeEducacao => ({
  indicador: 'abandono',
  etapa: 'fundamental',
  ano: '2025',
  unidade: '%',
  fonte: { nome: 'INEP', url: 'https://inep.exemplo' },
  porRede: { publica: { orleans: 10, santaCatarina: 20, brasil: 30 } },
  ...mudancas,
});

describe('cercaDe', () => {
  it('multiplica a taxa pelo total e arredonda para o inteiro mais próximo', () => {
    expect(cercaDe(10.1, 177)).toBe('cerca de 18 de 177');
  });

  it('contagem abaixo de 5 vira "menos de 5"', () => {
    expect(cercaDe(5, 40)).toBe('menos de 5 de 40');
  });

  it('contagem de exatamente 5 ainda é número', () => {
    expect(cercaDe(12.5, 40)).toBe('cerca de 5 de 40');
  });

  it('taxa zero também não diz a contagem', () => {
    expect(cercaDe(0, 40)).toBe('menos de 5 de 40');
  });

  it('o total leva separador de milhar', () => {
    expect(cercaDe(10, 1200)).toBe('cerca de 120 de 1.200');
  });

  it.each([
    [null, 40],
    [10, null],
    [10, 0],
  ])('taxa %s de total %s não vira frase', (taxa, total) => {
    expect(cercaDe(taxa, total)).toBeNull();
  });

  it('turma com menos de 5 alunos não vira frase, porque identificaria alguém', () => {
    expect(cercaDe(50, 4)).toBeNull();
  });
});

describe('nomes', () => {
  it('as redes saem na ordem do alternador', () => {
    expect(Object.values(NOMES_DE_REDE)).toEqual(['Pública', 'Municipal', 'Estadual', 'Privada', 'Todas']);
  });

  it.each([
    ['pre_escola', 'Pré-escola'],
    ['anos_iniciais', 'Anos iniciais'],
    ['ano_5', '5º ano'],
    ['serie_3', '3ª série'],
    ['medio', 'Ensino médio'],
    ['eja_medio', 'EJA, ensino médio'],
  ])('a etapa %s se chama %s', (etapa, nome) => {
    expect(NOMES_DE_ETAPA[etapa]).toBe(nome);
  });
});

describe('redesComDado', () => {
  it('rede ausente e rede só com nulos ficam de fora, e zero conta como dado', () => {
    const c = comparacao({
      porRede: {
        todas: { orleans: 0, santaCatarina: null, brasil: null },
        estadual: { orleans: null, santaCatarina: null, brasil: null },
        publica: { orleans: 1, santaCatarina: 2, brasil: 3 },
      },
    });

    expect(redesComDado([c])).toEqual(['publica', 'todas']);
  });

  it('basta um lugar com dado, mesmo sem Orleans', () => {
    const c = comparacao({ porRede: { privada: { orleans: null, santaCatarina: 2, brasil: null } } });

    expect(redesComDado([c])).toEqual(['privada']);
  });

  it('junta as redes de várias comparações', () => {
    const a = comparacao({ porRede: { municipal: { orleans: 1, santaCatarina: 2, brasil: 3 } } });
    const b = comparacao({ porRede: { estadual: { orleans: 1, santaCatarina: 2, brasil: 3 } } });

    expect(redesComDado([b, a])).toEqual(['municipal', 'estadual']);
  });
});

describe('escalaDaComparacao', () => {
  it('percentual vai de 0 a 100', () => {
    expect(escalaDaComparacao(comparacao())).toEqual({ min: 0, max: 100 });
  });

  it('contagem começa em zero e sobe até um topo redondo, olhando todas as redes', () => {
    const c = comparacao({
      unidade: 'alunos',
      porRede: {
        publica: { orleans: 12, santaCatarina: 14, brasil: 13 },
        privada: { orleans: 20.1, santaCatarina: 9, brasil: null },
      },
    });

    expect(escalaDaComparacao(c)).toEqual({ min: 0, max: 30 });
  });

  it('a escala pedida vale quando cabe nos valores', () => {
    const c = comparacao({ unidade: 'nota', porRede: { todas: { orleans: 544, santaCatarina: 552, brasil: 524 } } });

    expect(escalaDaComparacao(c, { min: 450, max: 650 })).toEqual({ min: 450, max: 650 });
  });

  it('valor fora da escala pedida alarga a escala, em vez de pôr o ponto no lugar errado', () => {
    const c = comparacao({ unidade: 'nota', porRede: { todas: { orleans: 440, santaCatarina: 552, brasil: 700 } } });

    expect(escalaDaComparacao(c, { min: 450, max: 650 })).toEqual({ min: 440, max: 700 });
  });

  it('a meta também cabe na escala', () => {
    const c = comparacao({
      unidade: 'indice',
      meta: { valor: 9, referencia: 'x' },
      porRede: { todas: { orleans: 5, santaCatarina: 6, brasil: 7 } },
    });

    expect(escalaDaComparacao(c, { min: 0, max: 8 })).toEqual({ min: 0, max: 9 });
  });
});

describe('posicaoNaEscala', () => {
  it('a posição é proporcional dentro da escala, que não precisa começar em zero', () => {
    expect(posicaoNaEscala(500, { min: 450, max: 650 })).toBe('25%');
  });

  it('zero numa escala que começa em zero fica na ponta', () => {
    expect(posicaoNaEscala(0, { min: 0, max: 100 })).toBe('0%');
  });

  it('corta o resíduo de ponto flutuante', () => {
    expect(posicaoNaEscala(0.07, { min: 0, max: 1 })).toBe('7%');
  });

  it('escala sem amplitude não divide por zero', () => {
    expect(posicaoNaEscala(5, { min: 5, max: 5 })).toBe('0%');
  });
});

describe('formatarValor', () => {
  it.each([
    [10.1, '%', '10,1%'],
    [0, '%', '0,0%'],
    [24.5, 'alunos', '24,5 alunos'],
    [4.8, 'horas', '4,8 horas'],
    [6.6, 'indice', '6,6'],
    [544.35, 'nota', '544,35'],
  ] as const)('%s em %s sai como %s', (valor, unidade, texto) => {
    expect(formatarValor(valor, unidade)).toBe(texto);
  });

  it('falta de dado é travessão, nunca zero', () => {
    expect(formatarValor(null, '%')).toBe('—');
  });

  it('as casas podem ser pedidas', () => {
    expect(formatarValor(66, '%', 0)).toBe('66%');
  });
});

describe('trechosDaSerie', () => {
  const ANOS = [2017, 2019, 2021, 2023, 2025];

  it('ano nulo quebra a linha em dois trechos, sem ligar nem zerar', () => {
    const pontos = [
      { ano: 2017, valor: 4 },
      { ano: 2019, valor: 4.2 },
      { ano: 2021, valor: null },
      { ano: 2023, valor: 4.6 },
      { ano: 2025, valor: 4.8 },
    ];

    expect(trechosDaSerie(ANOS, pontos)).toEqual([
      [
        { ano: 2017, valor: 4 },
        { ano: 2019, valor: 4.2 },
      ],
      [
        { ano: 2023, valor: 4.6 },
        { ano: 2025, valor: 4.8 },
      ],
    ]);
  });

  it('ano ausente quebra do mesmo jeito que ano nulo', () => {
    const pontos = [
      { ano: 2017, valor: 4 },
      { ano: 2019, valor: 4.2 },
      { ano: 2025, valor: 4.8 },
    ];

    expect(trechosDaSerie(ANOS, pontos)).toEqual([
      [
        { ano: 2017, valor: 4 },
        { ano: 2019, valor: 4.2 },
      ],
      [{ ano: 2025, valor: 4.8 }],
    ]);
  });

  it('zero é dado e continua na linha', () => {
    const pontos = [
      { ano: 2023, valor: 0 },
      { ano: 2025, valor: 1 },
    ];

    expect(trechosDaSerie([2023, 2025], pontos)).toEqual([pontos]);
  });

  it('série sem nenhum valor não tem trecho', () => {
    expect(trechosDaSerie(ANOS, [{ ano: 2017, valor: null }])).toEqual([]);
  });
});
