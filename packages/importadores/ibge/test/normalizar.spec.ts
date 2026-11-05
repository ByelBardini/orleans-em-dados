import { describe, expect, it } from 'vitest';
import {
  normalizarValor,
  registrosDaResposta,
  type RespostaDoAgregado,
  normalizarPesquisa,
  registrosDaPesquisa,
  semRepetidos,
} from '../src/normalizar';

const LOCALIDADE = { id: '4211702', nivel: { id: 'N6', nome: 'Município' }, nome: 'Orleans (SC)' };

type Classe = { id: string; nome: string; categoria: Record<string, string> };

const resposta = (
  variavel: { id: string; unidade: string },
  resultados: { classificacoes?: Classe[]; serie: Record<string, string>; localidade?: { id: string } }[],
): RespostaDoAgregado => [
  {
    id: variavel.id,
    variavel: 'Variável',
    unidade: variavel.unidade,
    resultados: resultados.map(({ classificacoes = [], serie, localidade = LOCALIDADE }) => ({
      classificacoes,
      series: [{ localidade, serie }],
    })),
  },
];

const situacao = (id: string, nome: string): Classe => ({
  id: '1',
  nome: 'Situação do domicílio',
  categoria: { [id]: nome },
});

const POPULACAO = { id: '9324', unidade: 'Pessoas' };

const umaLinha = (valor: string) =>
  normalizarValor(registrosDaResposta('6579', resposta(POPULACAO, [{ serie: { '2025': valor } }]))[0]!);

describe('registrosDaResposta', () => {
  it('tabela sem classificação vira um registro por período, com categoria vazia', () => {
    const registros = registrosDaResposta(
      '6579',
      resposta(POPULACAO, [{ serie: { '2024': '24474', '2025': '24686' } }]),
    );

    expect(registros).toEqual([
      {
        id: '6579:9324:2024:',
        tabela: '6579',
        variavel: '9324',
        unidade: 'Pessoas',
        periodo: '2024',
        categoria: '',
        localidade: '4211702',
        valor: '24474',
      },
      {
        id: '6579:9324:2025:',
        tabela: '6579',
        variavel: '9324',
        unidade: 'Pessoas',
        periodo: '2025',
        categoria: '',
        localidade: '4211702',
        valor: '24686',
      },
    ]);
  });

  it('classificação vira categoria, e o Total da classificação fica de fora', () => {
    const registros = registrosDaResposta(
      '9923',
      resposta({ id: '93', unidade: 'Pessoas' }, [
        { classificacoes: [situacao('6795', 'Total')], serie: { '2022': '23661' } },
        { classificacoes: [situacao('1', 'Urbana')], serie: { '2022': '15000' } },
        { classificacoes: [situacao('2', 'Rural')], serie: { '2022': '8661' } },
      ]),
    );

    expect(registros.map((r) => [r.id, r.categoria])).toEqual([
      ['9923:93:2022:', ''],
      ['9923:93:2022:Urbana', 'Urbana'],
      ['9923:93:2022:Rural', 'Rural'],
    ]);
  });

  it('duas classificações viram uma categoria só, na ordem da resposta', () => {
    const [registro] = registrosDaResposta(
      '9514',
      resposta({ id: '93', unidade: 'Pessoas' }, [
        {
          classificacoes: [
            { id: '2', nome: 'Sexo', categoria: { '4': 'Homens' } },
            { id: '287', nome: 'Idade', categoria: { '93070': '0 a 4 anos' } },
            { id: '286', nome: 'Forma de declaração da idade', categoria: { '113635': 'Total' } },
          ],
          serie: { '2022': '739' },
        },
      ]),
    );

    expect(registro?.categoria).toBe('Homens|0 a 4 anos');
  });

  it('resposta que não é a lista de variáveis lança citando a tabela', () => {
    expect(() => registrosDaResposta('6579', { erro: 'x' })).toThrow('6579');
  });
});

describe('normalizarValor', () => {
  it('6579 vira período 2025, valor 24686 e unidade Pessoas', () => {
    expect(umaLinha('24686')).toEqual({
      idExterno: '6579:9324:2025:',
      localidade: '4211702',
      tabela: '6579',
      variavel: '9324',
      periodo: '2025',
      categoria: '',
      valor: '24686',
      unidade: 'Pessoas',
      simbolo: null,
    });
  });

  it('área de 549.859 mantém as três casas', () => {
    const [registro] = registrosDaResposta(
      '4714',
      resposta({ id: '6318', unidade: 'Quilômetros quadrados' }, [{ serie: { '2022': '549.859' } }]),
    );

    expect(normalizarValor(registro!).valor).toBe('549.859');
  });

  it.each([['...'], ['..'], ['X']])('símbolo %s vira valor nulo, guardado em simbolo', (simbolo) => {
    expect(umaLinha(simbolo)).toMatchObject({ valor: null, simbolo });
  });

  // Na nota do SIDRA, `-` é zero absoluto. A pirâmide de 2022 confirma: com `-` = 0, as faixas somam o Censo.
  it('símbolo `-` é zero absoluto, com o símbolo guardado', () => {
    expect(umaLinha('-')).toMatchObject({ valor: '0', simbolo: '-' });
  });

  it('localidade diferente de 4211702 lança citando a recebida', () => {
    const [registro] = registrosDaResposta(
      '6579',
      resposta(POPULACAO, [{ serie: { '2025': '10' }, localidade: { id: '4200000' } }]),
    );

    expect(() => normalizarValor(registro!)).toThrow('4200000');
  });

  it.each([['abc'], ['1,5'], ['']])('valor %j fora da lista de símbolos lança citando o valor', (valor) => {
    expect(() => umaLinha(valor)).toThrow(`"${valor}"`);
  });
});

describe('localidades da comparação', () => {
  const noBrasil = () =>
    registrosDaResposta('6579', resposta(POPULACAO, [{ serie: { '2025': '10' }, localidade: { id: '1' } }]))[0]!;

  it('registro do Orleans mantém o id sem a localidade', () => {
    const [registro] = registrosDaResposta('6579', resposta(POPULACAO, [{ serie: { '2025': '10' } }]));

    expect(registro!.id).toBe('6579:9324:2025:');
  });

  it('registro de outra localidade leva a localidade no id, para Brasil e Santa Catarina não colidirem', () => {
    expect(noBrasil().id).toBe('1:6579:9324:2025:');
  });

  it('a linha guarda a localidade', () => {
    expect(normalizarValor(noBrasil(), ['1', '42']).localidade).toBe('1');
  });

  it('a linha de Orleans guarda o código do município', () => {
    const [registro] = registrosDaResposta('6579', resposta(POPULACAO, [{ serie: { '2025': '10' } }]));

    expect(normalizarValor(registro!).localidade).toBe('4211702');
  });

  it('localidade fora das aceitas pela consulta lança citando a recebida', () => {
    const [registro] = registrosDaResposta('6579', resposta(POPULACAO, [{ serie: { '2025': '10' } }]));

    expect(() => normalizarValor(registro!, ['1', '42'])).toThrow('4211702');
  });
});

describe('registrosDaPesquisa', () => {
  const municipal = { id: 5, indicador: 'Municipal', unidade: { id: 'matrículas' }, children: [] };
  const serie = { id: 4, indicador: '1º ano', unidade: { id: 'matrículas' }, children: [municipal] };
  const etapa = { id: 3, indicador: 'Ensino fundamental', unidade: { id: 'matrículas' }, children: [serie] };
  const ARVORE = [
    { id: 1, indicador: 'Ensino básico', children: [{ id: 2, indicador: 'Matrículas', children: [etapa] }] },
  ];
  const IDEB = [
    {
      id: 30277,
      indicador: 'Índice de Desenvolvimento da Educação Básica',
      children: [{ id: 78186, indicador: 'Ensino médio', children: [] }],
    },
  ];
  const resultado = (id: number, localidade: string, res: Record<string, string | null>) => [
    { id, res: [{ localidade, res }] },
  ];

  it('caminho da árvore vira categoria sem a raiz, com tabela, variável e unidade', () => {
    const [registro] = registrosDaPesquisa('13', ARVORE, resultado(5, '42', { '2025': '60' }));

    expect(registro).toEqual({
      id: '42:pesquisa-13:5:2025:Matrículas > Ensino fundamental > 1º ano > Municipal',
      tabela: 'pesquisa-13',
      variavel: '5',
      unidade: 'matrículas',
      periodo: '2025',
      categoria: 'Matrículas > Ensino fundamental > 1º ano > Municipal',
      localidade: '42',
      valor: '60',
    });
  });

  it('Orleans vem sem o dígito verificador e sai com o código de sete dígitos, sem prefixo no id', () => {
    const [registro] = registrosDaPesquisa('13', ARVORE, resultado(3, '421170', { '2025': '100' }));

    expect(registro?.localidade).toBe('4211702');
    expect(registro?.id).toBe('pesquisa-13:3:2025:Matrículas > Ensino fundamental');
  });

  it('IDEB não tem unidade na árvore e sai como índice, sem a raiz na categoria', () => {
    const [registro] = registrosDaPesquisa('40', IDEB, resultado(78186, '42', { '2025': '3.9' }));

    expect(registro?.unidade).toBe('índice');
    expect(registro?.categoria).toBe('Ensino médio');
  });

  it('ensino superior mantém a raiz: sem ela, "Matrículas > Municipal" não diria a etapa', () => {
    const superior = [
      {
        id: 78118,
        indicador: 'Ensino superior',
        children: [{ id: 5918, indicador: 'Matrículas', unidade: { id: 'matrículas' }, children: [] }],
      },
    ];

    const [registro] = registrosDaPesquisa('13', superior, resultado(5918, '42', { '2025': '10' }));

    expect(registro?.categoria).toBe('Ensino superior > Matrículas');
  });

  it('id fora da árvore vira registro sem categoria, para a normalização recusar', () => {
    const [registro] = registrosDaPesquisa('13', ARVORE, resultado(999, '42', { '2025': '1' }));

    expect(registro?.categoria).toBeNull();
    expect(registro?.id).toBe('42:pesquisa-13:999:2025:');
  });

  it('resposta que não é lista lança citando a pesquisa', () => {
    expect(() => registrosDaPesquisa('13', ARVORE, { erro: 'x' })).toThrow('pesquisa 13');
  });
});

describe('normalizarPesquisa', () => {
  const registro = (valor: unknown, campos: Record<string, unknown> = {}) => ({
    id: 'pesquisa-40:78188:2025:Ensino fundamental',
    tabela: 'pesquisa-40',
    variavel: '78188',
    unidade: 'índice',
    periodo: '2025',
    categoria: 'Ensino fundamental',
    localidade: '4211702',
    valor,
    ...campos,
  });
  const ACEITAS = ['4211702', '42'];

  it('número fica como veio, em texto', () => {
    expect(normalizarPesquisa(registro('6.0'), ACEITAS)).toMatchObject({ valor: '6.0', simbolo: null });
  });

  it('traço na pesquisa é sem dado: nulo com o símbolo, diferente do zero do SIDRA', () => {
    expect(normalizarPesquisa(registro('-'), ACEITAS)).toMatchObject({ valor: null, simbolo: '-' });
  });

  it.each([[''], [null]])('valor %j fica nulo, sem símbolo', (valor) => {
    expect(normalizarPesquisa(registro(valor), ACEITAS)).toMatchObject({ valor: null, simbolo: null });
  });

  it('texto desconhecido recusa o registro citando o valor', () => {
    expect(() => normalizarPesquisa(registro('n/d'), ACEITAS)).toThrow('n/d');
  });

  it('indicador fora da árvore recusa o registro citando o id', () => {
    expect(() => normalizarPesquisa(registro('5', { categoria: null }), ACEITAS)).toThrow('78188');
  });

  it('localidade fora das aceitas recusa o registro', () => {
    expect(() => normalizarPesquisa(registro('5', { localidade: '1' }), ACEITAS)).toThrow('localidade 1');
  });
});

describe('semRepetidos', () => {
  const r = (id: string, valor: string) => ({ id, valor });

  it('o mesmo id com o mesmo conteúdo, vindo de dois recortes, fica uma vez', () => {
    expect(semRepetidos([r('a', '1'), r('b', '2'), r('a', '1')])).toEqual([r('a', '1'), r('b', '2')]);
  });

  it('o mesmo id com valor diferente fica duas vezes, para o executor recusar', () => {
    expect(semRepetidos([r('a', '1'), r('a', '2')])).toEqual([r('a', '1'), r('a', '2')]);
  });
});
