import { describe, expect, it } from 'vitest';
import {
  comparacaoDosLugares,
  comparacaoPorRede,
  csvDeEducacao,
  emPercentual,
  faltandoDe,
  linhasDaComparacao,
  somaDosPresentes,
  type LinhaDeEducacao,
  type LoteDeEducacao,
} from '../../../src/modules/educacao/educacao.comum';

const FONTE = { nome: 'INEP', url: 'https://inep.exemplo' };
const CABECALHO = { indicador: 'abandono', etapa: 'medio', unidade: '%', fonte: FONTE } as const;

const linha = (lugar: string, rede: string, valor: number | null, campos: Partial<LinhaDeEducacao> = {}) =>
  ({
    indicador: 'abandono',
    lugar,
    rede,
    etapa: 'medio',
    recorte: '',
    periodo: '2025',
    valor,
    texto: null,
    unidade: '%',
    ...campos,
  }) satisfies LinhaDeEducacao;

const lote = (chave: string): LoteDeEducacao => ({ chave, coletaId: 1, ano: 2025, urlOrigem: 'https://x' });

describe('comparacaoPorRede', () => {
  it('monta os três lugares de cada rede, e o que falta é nulo', () => {
    const comparacao = comparacaoPorRede(
      [linha('4211702', 'publica', 2.5), linha('42', 'publica', 1.5), linha('4211702', 'estadual', 3)],
      { ...CABECALHO, periodo: '2025' },
    );

    expect(comparacao.porRede).toEqual({
      publica: { orleans: 2.5, santaCatarina: 1.5, brasil: null },
      estadual: { orleans: 3, santaCatarina: null, brasil: null },
    });
  });

  it('zero continua zero, e a rede em que tudo é nulo fica de fora', () => {
    const comparacao = comparacaoPorRede([linha('4211702', 'publica', 0), linha('42', 'privada', null)], {
      ...CABECALHO,
      periodo: '2025',
    });

    expect(comparacao.porRede).toEqual({ publica: { orleans: 0, santaCatarina: null, brasil: null } });
  });

  it('a rede federal, fora do alternador, não entra', () => {
    const comparacao = comparacaoPorRede([linha('42', 'federal', 1)], { ...CABECALHO, periodo: '2025' });

    expect(comparacao.porRede).toEqual({});
  });

  it('só olha o indicador, a etapa, o recorte e o período pedidos', () => {
    const comparacao = comparacaoPorRede(
      [
        linha('42', 'todas', 1),
        linha('42', 'publica', 2, { etapa: 'fundamental' }),
        linha('42', 'estadual', 3, { periodo: '2024' }),
        linha('42', 'privada', 4, { indicador: 'evasao' }),
        linha('42', 'municipal', 5, { recorte: 'grupo_1' }),
      ],
      { ...CABECALHO, periodo: '2025' },
    );

    expect(Object.keys(comparacao.porRede)).toEqual(['todas']);
  });

  it('o ano da comparação é o texto do período, como 2021-2022', () => {
    const comparacao = comparacaoPorRede([linha('42', 'todas', 1, { periodo: '2021-2022' })], {
      ...CABECALHO,
      periodo: '2021-2022',
    });

    expect(comparacao.ano).toBe('2021-2022');
  });
});

describe('comparacaoDosLugares', () => {
  it('o que não abre rede fica em "todas", e a meta só entra quando há', () => {
    const valores = { orleans: 1, santaCatarina: 2, brasil: null };

    expect(comparacaoDosLugares(valores, { ...CABECALHO, ano: '2022' })).toEqual({
      ...CABECALHO,
      ano: '2022',
      porRede: { todas: valores },
    });
  });
});

describe('emPercentual', () => {
  it('arredonda a duas casas', () => {
    expect(emPercentual(510, 5129)).toBe(9.94);
  });

  it.each([
    [null, 10],
    [5, null],
    [5, 0],
  ])('%s de %s não tem percentual', (parte, total) => {
    expect(emPercentual(parte, total)).toBeNull();
  });

  it('com uma casa, arredonda uma vez só: 23,548 é 23,5, e não 23,55 arredondado de novo', () => {
    expect(emPercentual(23548, 100000, 1)).toBe(23.5);
  });

  it('zero de um total é zero', () => {
    expect(emPercentual(0, 10)).toBe(0);
  });
});

describe('somaDosPresentes', () => {
  it('nulo não vira zero na soma, e tudo nulo é nulo', () => {
    expect(somaDosPresentes([1, null, 2])).toBe(3);
    expect(somaDosPresentes([null, null])).toBeNull();
  });
});

describe('faltandoDe', () => {
  it('lista, na ordem pedida, as consultas sem lote', () => {
    expect(faltandoDe(['a', 'b', 'c'], [lote('b')])).toEqual(['a', 'c']);
  });
});

describe('CSV', () => {
  const comparacao = comparacaoDosLugares(
    { orleans: 1.5, santaCatarina: null, brasil: 2 },
    { ...CABECALHO, ano: '2025' },
  );

  it('a comparação vira uma linha por rede e lugar, com o lugar por extenso', () => {
    expect(linhasDaComparacao(comparacao)).toEqual([
      {
        indicador: 'abandono',
        lugar: 'Orleans',
        rede: 'todas',
        etapa: 'medio',
        ano: '2025',
        valor: 1.5,
        unidade: '%',
        fonte: 'INEP',
      },
      {
        indicador: 'abandono',
        lugar: 'Santa Catarina',
        rede: 'todas',
        etapa: 'medio',
        ano: '2025',
        valor: null,
        unidade: '%',
        fonte: 'INEP',
      },
      {
        indicador: 'abandono',
        lugar: 'Brasil',
        rede: 'todas',
        etapa: 'medio',
        ano: '2025',
        valor: 2,
        unidade: '%',
        fonte: 'INEP',
      },
    ]);
  });

  it('o arquivo tem as oito colunas, e valor nulo sai vazio', () => {
    expect(csvDeEducacao(linhasDaComparacao(comparacao))).toBe(
      '﻿Indicador;Lugar;Rede;Etapa;Ano;Valor;Unidade;Fonte\r\n' +
        'abandono;Orleans;todas;medio;2025;1,5;%;INEP\r\n' +
        'abandono;Santa Catarina;todas;medio;2025;;%;INEP\r\n' +
        'abandono;Brasil;todas;medio;2025;2;%;INEP\r\n',
    );
  });
});
