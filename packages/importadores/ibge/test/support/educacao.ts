// Respostas fictícias das consultas de educação: as tabelas do Censo e as pesquisas 40 e 13.
import { variavel } from './agregados';

const CENSO = (valor: string, categorias: string[] = []) => ({ categorias, serie: { '2022': valor } });
const CENSO_2010 = (valor: string, categorias: string[] = []) => ({ categorias, serie: { '2010': valor } });

const POS = 'Especialização de nível superior, mestrado ou doutorado';

type Opcoes = {
  alfabetizadas?: string;
  municipioGraduacao?: string;
  outroGraduacao?: string;
  totalGraduacao?: string;
  estrangeiroGraduacao?: string;
};

export const respostasDaEducacao = ({
  alfabetizadas = '900',
  municipioGraduacao = '398',
  outroGraduacao = '188',
  totalGraduacao = '585',
  estrangeiroGraduacao = '-',
}: Opcoes = {}) => ({
  '10091': [
    variavel('2513', '%', [
      CENSO('97.00'),
      CENSO('96.90', ['Homens']),
      CENSO('97.10', ['Mulheres']),
      CENSO('99.10', ['15 a 17 anos']),
      CENSO('97.40', ['Urbana']),
      CENSO('96.60', ['Rural']),
    ]),
  ],
  '10092': [
    variavel('950', 'Pessoas', [
      CENSO('1000'),
      CENSO(alfabetizadas, ['Alfabetizadas']),
      CENSO('100', ['Não alfabetizadas']),
    ]),
  ],
  '10056': [variavel('3795', '%', [CENSO('20.50'), CENSO('50.10', ['0 a 3 anos']), CENSO('80.20', ['4 a 5 anos'])])],
  '10057': [
    variavel('13282', 'Pessoas', [
      CENSO('100'),
      CENSO('60', ['0 a 3 anos']),
      CENSO('40', ['4 a 5 anos']),
      CENSO('70', ['Creche']),
      CENSO('30', ['Pré-escolar']),
      CENSO('55', ['Creche', '0 a 3 anos']),
      CENSO('15', ['Creche', '4 a 5 anos']),
    ]),
  ],
  '10058': [
    variavel('13283', 'Pessoas', [
      CENSO('300'),
      CENSO('-', ['Alfabetização de jovens e adultos']),
      CENSO('240', ['Regular de ensino fundamental']),
      CENSO('61', ['Regular do ensino médio']), // arredondamento da amostra: soma 301
    ]),
  ],
  '10059': [
    variavel('13284', 'Pessoas', [CENSO('90'), CENSO('80', ['Superior de graduação']), CENSO('10', ['Mestrado'])]),
  ],
  '10061': [
    variavel('2667', 'Pessoas', [
      CENSO('1000', ['25 anos ou mais']),
      CENSO('400', ['Sem instrução e fundamental incompleto', '25 anos ou mais']),
      CENSO('200', ['Fundamental completo e médio incompleto', '25 anos ou mais']),
      CENSO('250', ['Médio completo e superior incompleto', '25 anos ou mais']),
      CENSO('150', ['Superior completo', '25 anos ou mais']),
      CENSO('70', ['Superior completo', '25 anos ou mais', 'Homens']),
      CENSO('80', ['Superior completo', '25 anos ou mais', 'Mulheres']),
    ]),
  ],
  '10062': [variavel('13285', 'Anos', [CENSO('9.5'), CENSO('9.4', ['Homens'])])],
  '10324': [
    variavel('2021', 'Pessoas', [
      CENSO('850'),
      CENSO('600', ['Município de residência']),
      CENSO('250', ['Outro município']),
      CENSO('-', ['País estrangeiro']),
      CENSO('42', ['Outro município', 'Fundamental']),
      CENSO(outroGraduacao, ['Outro município', 'Superior de graduação']),
      CENSO('20', ['Outro município', POS]),
      CENSO(totalGraduacao, ['Superior de graduação']),
      CENSO(municipioGraduacao, ['Município de residência', 'Superior de graduação']),
      CENSO(estrangeiroGraduacao, ['País estrangeiro', 'Superior de graduação']),
      CENSO('50', [POS]),
      CENSO('30', ['Município de residência', POS]),
      CENSO('-', ['País estrangeiro', POS]),
    ]),
  ],
  '1549': [
    variavel('93', 'Pessoas', [CENSO_2010('1000'), CENSO_2010('100', ['6 anos']), CENSO_2010('900', ['7 a 14 anos'])]),
    variavel('364', 'Pessoas', [CENSO_2010('500'), CENSO_2010('90', ['6 anos']), CENSO_2010('410', ['7 a 14 anos'])]),
  ],
});

type No = { id: number; indicador: string; unidade?: { id: string }; children: No[] };

const no = (id: number, indicador: string, children: No[] = [], unidade?: string): No => ({
  id,
  indicador,
  ...(unidade ? { unidade: { id: unidade } } : {}),
  children,
});

const matricula = (id: number, indicador: string, children: No[] = []) => no(id, indicador, children, 'matrículas');

const ARVORE_DO_IDEB = [
  no(30277, 'Índice de Desenvolvimento da Educação Básica', [
    no(78185, 'Ensino fundamental', [no(78183, 'Anos iniciais', [no(78187, 'Pública', [no(78188, 'Municipal')])])]),
    no(78186, 'Ensino médio'),
  ]),
];

const ARVORE_DA_REDE = [
  no(78117, 'Ensino básico', [
    no(5902, 'Matrículas', [
      matricula(77881, 'Ensino infantil', [
        matricula(77882, 'Creche', [matricula(77883, 'Municipal'), matricula(77886, 'Privado')]),
        matricula(5903, 'Pré-escolar', [matricula(5904, 'Municipal')]),
      ]),
      matricula(5908, 'Ensino fundamental', [
        matricula(77899, '1º ano', [matricula(77941, 'Municipal'), matricula(77942, 'Estadual')]),
        matricula(77900, '2º ano', [matricula(77945, 'Municipal'), matricula(77948, 'Privado')]),
      ]),
      matricula(5913, 'Ensino médio', [matricula(77908, '1º série', [matricula(77978, 'Estadual')])]),
    ]),
    no(5923, 'Docentes', [no(5934, 'Ensino médio', [], 'docentes')]),
  ]),
];

type Valores = Record<number, Record<string, string | null>>;

const resultado = (localidade: string, valores: Valores) =>
  Object.entries(valores).map(([id, res]) => ({ id: Number(id), res: [{ localidade, res, notas: {} }] }));

const VALORES_DO_IDEB: Valores = {
  78183: { '2023': '6.2', '2025': '6.5' },
  78187: { '2023': '6.0', '2025': '6.4' },
  78188: { '2023': '-', '2025': '6.3' },
  78186: { '2023': null, '2025': '' },
};

// 2021: a linha de cada ano do fundamental vem vazia, como na fonte; ano × rede tem valor e fecha com a etapa.
export const VALORES_DA_REDE: Valores = {
  77881: { '2021': '100', '2025': '120' },
  77882: { '2021': '60', '2025': '70' },
  77883: { '2021': '40', '2025': '50' },
  77886: { '2021': '20', '2025': '20' },
  5903: { '2021': '40', '2025': '50' },
  5904: { '2021': '40', '2025': '50' },
  5908: { '2021': '150', '2025': '177' },
  77899: { '2021': null, '2025': '100' },
  77941: { '2021': '50', '2025': '60' },
  77942: { '2021': '30', '2025': '40' },
  77900: { '2021': null, '2025': '77' },
  77945: { '2021': '60', '2025': '70' },
  77948: { '2021': '10', '2025': '7' },
  5913: { '2021': '30', '2025': '-' },
  77908: { '2021': '30', '2025': '-' },
  77978: { '2021': '30', '2025': '-' },
  5934: { '2021': '12', '2025': '14' },
};

/** Resultados por `pesquisa:local`, como a API responde: Orleans sem o dígito verificador. */
export const respostasDasPesquisas = ({
  rede = VALORES_DA_REDE,
  redeSc = VALORES_DA_REDE,
  ideb = VALORES_DO_IDEB,
}: { rede?: Valores; redeSc?: Valores; ideb?: Valores } = {}) => ({
  arvores: { '40': ARVORE_DO_IDEB, '13': ARVORE_DA_REDE } as Record<string, unknown>,
  resultados: {
    '40:4211702': resultado('421170', ideb),
    '40:42': resultado('42', ideb),
    '13:4211702': resultado('421170', rede),
    '13:42': resultado('42', redeSc),
  } as Record<string, unknown>,
});

export type RespostasDasPesquisas = ReturnType<typeof respostasDasPesquisas>;
