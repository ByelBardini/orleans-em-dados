import { describe, expect, it } from 'vitest';
import { contarAusentes, validarPorTotalizador } from '../src/validar';

const coleta = (registros: object[], totalizadores: object[]) => ({
  filtro: {},
  totalHits: registros.length,
  registros: registros.map((r, i) => ({ id: String(i), ...r })),
  extras: { totalizadores },
});

const validar = validarPorTotalizador(['valor']);

describe('validarPorTotalizador', () => {
  it('soma igual ao totalizador aprova e registra a conferência com título e descrição', () => {
    const resultado = validar(
      coleta([{ valor: 0.1 }, { valor: 0.2 }], [{ campo: 'valor', valor: 0.3, titulo: 'Valor', descricao: 'Total' }]),
    );

    expect(resultado.erros).toEqual([]);
    expect(resultado.conferencia).toEqual([
      { campo: 'valor', titulo: 'Valor', descricao: 'Total', fonte: '0.30', calculado: '0.30', diferenca: '0.00' },
    ]);
  });

  it('diferença de um centavo reprova citando o campo e o valor', () => {
    const resultado = validar(coleta([{ valor: 10 }], [{ campo: 'valor', valor: 10.01 }]));

    expect(resultado.erros).toEqual(['valor: diferença de -0.01 em relação ao totalizador']);
    expect(resultado.conferencia[0]).toMatchObject({ fonte: '10.01', calculado: '10.00', diferenca: '-0.01' });
  });

  it('negativos entram na soma com o sinal', () => {
    const resultado = validar(coleta([{ valor: 100 }, { valor: -30.5 }], [{ campo: 'valor', valor: 69.5 }]));

    expect(resultado.erros).toEqual([]);
  });

  it('valor nulo não entra na soma como zero nem derruba a conferência', () => {
    const resultado = validar(coleta([{ valor: 5 }, { valor: null }, {}], [{ campo: 'valor', valor: 5 }]));

    expect(resultado.erros).toEqual([]);
    expect(resultado.conferencia[0]?.calculado).toBe('5.00');
  });

  it('totalizador ausente reprova e a conferência fica sem o valor da fonte', () => {
    const resultado = validar(coleta([{ valor: 5 }], []));

    expect(resultado.erros).toEqual(['totalizador ausente para valor']);
    expect(resultado.conferencia).toEqual([{ campo: 'valor', fonte: null, calculado: '5.00', diferenca: null }]);
  });

  it('totalizador com resíduo de ponto flutuante é arredondado ao centavo', () => {
    const resultado = validar(coleta([{ valor: 170915184.25 }], [{ campo: 'valor', valor: 170915184.25000012 }]));

    expect(resultado.erros).toEqual([]);
    expect(resultado.conferencia[0]?.fonte).toBe('170915184.25');
  });

  it('mil parcelas de dez centavos somam exatos 100,00', () => {
    const registros = Array.from({ length: 1000 }, () => ({ valor: 0.1 }));

    expect(validar(coleta(registros, [{ campo: 'valor', valor: 100 }])).erros).toEqual([]);
  });

  it('confere cada campo pedido, independentemente', () => {
    const resultado = validarPorTotalizador(['a', 'b'])(
      coleta(
        [{ a: 1, b: 2 }],
        [
          { campo: 'a', valor: 1 },
          { campo: 'b', valor: 3 },
        ],
      ),
    );

    expect(resultado.erros).toEqual(['b: diferença de -1.00 em relação ao totalizador']);
    expect(resultado.conferencia.map((c) => c.campo)).toEqual(['a', 'b']);
  });
});

describe('contarAusentes', () => {
  it('conta por campo os registros sem valor, nulo ou faltando', () => {
    expect(contarAusentes([{ a: 1, b: null }, { a: 0 }, { b: 2 }], ['a', 'b'])).toEqual({ a: 1, b: 2 });
  });

  it('zero é valor, não ausência', () => {
    expect(contarAusentes([{ a: 0 }], ['a'])).toEqual({ a: 0 });
  });
});
