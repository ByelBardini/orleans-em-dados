// Respostas fictícias dos agregados e um cliente de mentira que as devolve por tabela.
import type { ClienteIbge } from '../../src/cliente';
import type { ConsultaDeAgregado } from '../../src/config';

const LOCALIDADE = { id: '4211702', nivel: { id: 'N6', nome: 'Município' }, nome: 'Orleans (SC)' };

export type Serie = Record<string, string>;

type Parte = { categorias?: string[]; serie: Serie };

/** Uma variável da resposta, com uma série por combinação de categorias. */
export const variavel = (id: string, unidade: string, partes: Parte[]) => ({
  id,
  variavel: `Variável ${id}`,
  unidade,
  resultados: partes.map(({ categorias = [], serie }) => ({
    classificacoes: categorias.map((nome, i) => ({ id: String(i), nome: `Classe ${i}`, categoria: { [i]: nome } })),
    series: [{ localidade: LOCALIDADE, serie }],
  })),
});

export class ClienteIbgeFake implements ClienteIbge {
  pedidos: ConsultaDeAgregado[] = [];
  /** `comparacao` responde aos pedidos com `localidades`; sem ela, `respostas` responde a todos. */
  constructor(
    private respostas: Record<string, unknown>,
    private comparacao: Record<string, unknown> = respostas,
  ) {}
  async agregado(consulta: ConsultaDeAgregado) {
    this.pedidos.push(consulta);
    const resposta = (consulta.localidades ? this.comparacao : this.respostas)[consulta.tabela];
    if (resposta === undefined) throw new Error(`IBGE: HTTP 404 em ${consulta.tabela}`);
    return resposta;
  }
}

const NA_2022 = (valor: string): Parte => ({ serie: { '2022': valor } });

export const respostasDaPopulacao = (censo2022: string | null = '1000') => ({
  '6579': [variavel('9324', 'Pessoas', [{ serie: { '2021': '950', '2024': '1020' } }])],
  '200': [
    variavel('93', 'Pessoas', [{ categorias: ['Total', 'Total', 'Total'], serie: { '2000': '800', '2010': '900' } }]),
  ],
  '4709': [variavel('93', 'Pessoas', censo2022 === null ? [{ serie: {} }] : [NA_2022(censo2022)])],
});

export const respostasDoCenso = ({
  urbana = '700',
  rural = '300',
  homens = '500',
  mulheres = '500',
}: { urbana?: string; rural?: string; homens?: string; mulheres?: string } = {}) => ({
  '4714': [
    variavel('93', 'Pessoas', [NA_2022('1000')]),
    variavel('6318', 'Quilômetros quadrados', [NA_2022('549.859')]),
    variavel('614', 'Habitante por quilômetro quadrado', [NA_2022('1.82')]),
  ],
  '9923': [
    variavel('93', 'Pessoas', [
      { categorias: ['Total'], ...NA_2022('1000') },
      { categorias: ['Urbana'], ...NA_2022(urbana) },
      { categorias: ['Rural'], ...NA_2022(rural) },
    ]),
  ],
  '9514': [
    variavel('93', 'Pessoas', [
      { categorias: ['Total', 'Total', 'Total'], ...NA_2022('1000') },
      { categorias: ['Homens', 'Total', 'Total'], ...NA_2022('500') },
      { categorias: ['Total', '0 a 4 anos', 'Total'], ...NA_2022('400') },
      { categorias: ['Homens', '0 a 4 anos', 'Total'], ...NA_2022('200') },
      { categorias: ['Mulheres', '0 a 4 anos', 'Total'], ...NA_2022('200') },
      { categorias: ['Homens', '5 a 9 anos', 'Total'], ...NA_2022(String(Number(homens) - 200)) },
      { categorias: ['Mulheres', '5 a 9 anos', 'Total'], ...NA_2022(String(Number(mulheres) - 200)) },
      { categorias: ['Homens', '100 anos ou mais', 'Total'], ...NA_2022('-') },
    ]),
  ],
  '10295': [
    variavel('13431', 'Reais', [{ categorias: ['Total', 'Total', 'Total'], ...NA_2022('2000.50') }]),
    variavel('13534', 'Reais', [{ categorias: ['Total', 'Total', 'Total'], ...NA_2022('1500.25') }]),
  ],
});

/** PIB fictício: 2021 com a composição inteira, 2023 só com o total, como na tabela 5938. */
export const respostasDoPib = ({ pib2021 = '1000', comPib = true }: { pib2021?: string; comPib?: boolean } = {}) => {
  const parte = (v2021: string, v2023: string) => [{ serie: { '2021': v2021, '2023': v2023 } }];
  return {
    '5938': [
      ...(comPib ? [variavel('37', 'Mil Reais', parte(pib2021, '1500'))] : []),
      variavel('498', 'Mil Reais', parte('900', '...')),
      variavel('513', 'Mil Reais', parte('100', '...')),
      variavel('517', 'Mil Reais', parte('300', '...')),
      variavel('6575', 'Mil Reais', parte('400', '...')),
      variavel('525', 'Mil Reais', parte('100', '...')),
      variavel('543', 'Mil Reais', parte('100', '...')),
    ],
  };
};

export const respostasCompletas = () => ({ ...respostasDaPopulacao(), ...respostasDoCenso(), ...respostasDoPib() });

type Respostas = Record<string, ReturnType<typeof variavel>[]>;

const naLocalidade = (variaveis: ReturnType<typeof variavel>[] = [], id: string) =>
  variaveis.map((v) => ({
    ...v,
    resultados: v.resultados.map((r) => ({
      ...r,
      series: r.series.map((s) => ({ ...s, localidade: { ...s.localidade, id } })),
    })),
  }));

/** As mesmas tabelas de Orleans, com as séries do Brasil (1) e de Santa Catarina (42). */
export const respostasDaComparacao = ({
  brasil = respostasCompletas(),
  santaCatarina = respostasCompletas(),
}: { brasil?: Respostas; santaCatarina?: Respostas } = {}) =>
  Object.fromEntries(
    [...new Set([...Object.keys(brasil), ...Object.keys(santaCatarina)])].map((tabela) => [
      tabela,
      [...naLocalidade(brasil[tabela], '1'), ...naLocalidade(santaCatarina[tabela], '42')],
    ]),
  );
