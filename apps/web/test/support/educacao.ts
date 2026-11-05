// As respostas do caderno de Educação com valores à mão, uma fábrica por aba. O schema recusa a fixture que sair do contrato.
import { educacaoResumoSchema, type EducacaoResumo } from '@orleans-em-dados/contracts';
import {
  educacaoDinheiroSchema,
  type EducacaoDinheiro,
  educacaoCidadeSchema,
  type EducacaoCidade,
} from '@orleans-em-dados/contracts';
import { educacaoAprendizadoSchema, type EducacaoAprendizado } from '@orleans-em-dados/contracts';
import {
  educacaoPermanenciaSchema,
  type EducacaoPermanencia,
  type FonteDoBloco,
  type Rede,
} from '@orleans-em-dados/contracts';
import {
  educacaoAcessoSchema,
  educacaoDiscrepanciasSchema,
  educacaoProfessoresSchema,
  type ComparacaoDeEducacao,
  type EducacaoAcesso,
  type EducacaoDiscrepancias,
  type EducacaoProfessores,
} from '@orleans-em-dados/contracts';

const FONTE_DO_CENSO = { nome: 'IBGE, Censo 2022', url: 'https://ibge.exemplo/agregados' };

type Tres = [orleans: number | null, santaCatarina: number | null, brasil: number | null];
const lugares = ([orleans, santaCatarina, brasil]: Tres) => ({ orleans, santaCatarina, brasil });

const faixa = (nome: string, em2022: Tres, em2010: Tres, meta?: ComparacaoDeEducacao['meta']) => ({
  faixa: nome,
  comparacao: {
    indicador: 'frequencia_escolar',
    etapa: nome,
    ano: '2022',
    unidade: '%' as const,
    fonte: FONTE_DO_CENSO,
    porRede: { todas: lugares(em2022) },
    ...(meta ? { meta } : {}),
  },
  noAnoAnterior: lugares(em2010),
});

const META_4A = { valor: 100, referencia: 'até 2029, para toda a faixa de 6 a 17 anos, no Plano Nacional de Educação' };

export const acesso = (trocas: Partial<EducacaoAcesso> = {}): EducacaoAcesso =>
  educacaoAcessoSchema.parse({
    disponivel: true,
    faltando: [],
    frequencia: {
      ano: '2022',
      anoAnterior: '2010',
      fonte: FONTE_DO_CENSO,
      fonteAnterior: { nome: 'IBGE, Censo 2010: quem frequentava ÷ população', url: 'https://ibge.exemplo/agregados' },
      faixas: [
        faixa('0 a 3 anos', [50.11, 47.22, 33.33], [35.1, 34.2, 23.3], {
          valor: 60,
          referencia: 'até 2036, no Plano Nacional de Educação',
        }),
        faixa('4 a 5 anos', [83.44, 90.55, 86.66], [80.1, 80.2, 80.3], {
          valor: 100,
          referencia: 'até 2028, no Plano Nacional de Educação',
        }),
        faixa('6 a 14 anos', [97.5, 98.5, 96.5], [98.1, 97.2, 96.3], META_4A),
        faixa('15 a 17 anos', [88.1, 86.2, 85.3], [77.1, 80.2, 83.3], META_4A),
        faixa('18 a 24 anos', [25.1, 28.2, 27.3], [29.1, 29.2, 30.3]),
      ],
    },
    matriculas: {
      ano: '2025',
      fonte: { nome: 'IBGE, sinopse do Censo Escolar (INEP)', url: 'https://ibge.exemplo/pesquisas' },
      total: 3000,
      etapas: [
        { etapa: 'creche', total: 500, municipal: 400, estadual: null, federal: null, privada: 100 },
        { etapa: 'pre_escola', total: 450, municipal: 350, estadual: null, federal: null, privada: 100 },
        { etapa: 'fundamental', total: 1500, municipal: 700, estadual: 600, federal: null, privada: 200 },
        { etapa: 'medio', total: 550, municipal: null, estadual: 480, federal: null, privada: 70 },
      ],
      escolasEDocentes: [
        { etapa: 'educacao_infantil', escolas: 11, docentes: 77 },
        { etapa: 'fundamental', escolas: 9, docentes: 140 },
        { etapa: 'medio', escolas: 2, docentes: null },
      ],
    },
    outroMunicipio: {
      ano: '2022',
      fonte: FONTE_DO_CENSO,
      comparacao: {
        indicador: 'estudam_em_outro_municipio',
        etapa: '',
        ano: '2022',
        unidade: '%',
        fonte: FONTE_DO_CENSO,
        porRede: { todas: lugares([12.5, 8.1, 7.2]) },
      },
      estudantes: 4000,
      emOutroMunicipio: 500,
    },
    retrato: {
      ano: '2025',
      fonte: {
        nome: 'MEC, Retrato da Educação Infantil: a Prefeitura informou ao MEC',
        url: 'https://mec.exemplo/retrato',
      },
      solicitacoesNaoAtendidas: 'Não há demanda',
      quantidadeNaLista: null,
      listaUnificada: 'Sim, cadastro único',
      listasDivulgadas: 'Sim',
      criteriosDePrioridade: 'Ordem de cadastro',
      idadeInicial: 'De 4 meses',
      foraDaPreEscola: 'Não se aplica',
      nivelDeOrleans: 'basico',
      distribuicaoEmSc: [
        { nivel: 'inicial', municipios: 40 },
        { nivel: 'elementar', municipios: 150 },
        { nivel: 'basico', municipios: 90 },
        { nivel: 'avancado', municipios: 20 },
      ],
    },
    ...trocas,
  });

export const acessoIndisponivel = () =>
  acesso({
    disponivel: false,
    faltando: ['ibge_educacao_censo', 'ibge_educacao_comparacao', 'ibge_rede_escolar', 'mec_retrato'],
    frequencia: null,
    matriculas: null,
    outroMunicipio: null,
    retrato: null,
  });

const SIOPE = { coluna: 'SIOPE', lado: 'no SIOPE', nome: 'SIOPE, Anexo 8', url: 'https://siope.exemplo/anexo8' };
const SICONFI = {
  coluna: 'SICONFI',
  lado: 'no SICONFI',
  nome: 'SICONFI, RREO Anexo 14',
  url: 'https://siconfi.exemplo/rreo',
};
const BETHA = { coluna: 'Betha', lado: 'na Betha', nome: 'Betha, consulta 57170', url: 'https://betha.exemplo/57170' };

const soValor = (valor: number) => ({ valor, percentual: null });

export const discrepanciasDeEducacao = (trocas: Partial<EducacaoDiscrepancias> = {}): EducacaoDiscrepancias =>
  educacaoDiscrepanciasSchema.parse({
    disponivel: true,
    faltando: [],
    grupos: [
      {
        id: 'indices',
        rotulo: 'Índices (exemplo)',
        explicacao: 'Explicação dos índices (exemplo).',
        fonteA: SIOPE,
        fonteB: SICONFI,
        casos: [
          {
            ano: 2020,
            item: 'Fundeb na remuneração',
            a: { valor: null, percentual: 80.66 },
            b: { valor: 800, percentual: 87.13 },
            diferenca: null,
            maior: null,
            nota: 'Uma das fontes não traz o valor deste ano, e só os percentuais ficam lado a lado.',
          },
          {
            ano: 2021,
            item: 'Aplicação em educação',
            a: { valor: 1000, percentual: 23.28 },
            b: { valor: 986.45, percentual: 23.28 },
            diferenca: 13.55,
            maior: 'a',
            nota: null,
          },
        ],
      },
      {
        id: 'gasto_total',
        rotulo: 'Gasto (exemplo)',
        explicacao: 'Explicação do gasto (exemplo).',
        fonteA: SIOPE,
        fonteB: SICONFI,
        casos: [
          {
            ano: 2023,
            item: 'Gasto liquidado',
            a: soValor(5000.01),
            b: soValor(5000),
            diferenca: 0.01,
            maior: 'a',
            nota: null,
          },
        ],
      },
      {
        id: 'gasto_acoes',
        rotulo: 'Função 12 (exemplo)',
        explicacao: 'Explicação da função 12 (exemplo).',
        fonteA: SICONFI,
        fonteB: BETHA,
        casos: [
          { ano: 2025, item: 'Pago', a: soValor(99.99), b: soValor(100), diferenca: 0.01, maior: 'b', nota: null },
        ],
      },
    ],
    ...trocas,
  });

const FONTE_DO_RENDIMENTO = { nome: 'INEP, taxas de rendimento', url: 'https://inep.exemplo/rendimento' };
const FONTE_DAS_MATRICULAS = { nome: 'IBGE, sinopse do Censo Escolar (INEP)', url: 'https://ibge.exemplo/pesquisas' };

type PorRede = Partial<Record<Rede, Tres>>;

const taxa = (indicador: string, etapa: string, ano: string, fonte: FonteDoBloco, por: PorRede) => ({
  indicador,
  etapa,
  ano,
  unidade: '%' as const,
  fonte,
  porRede: Object.fromEntries(Object.entries(por).map(([rede, tres]) => [rede, lugares(tres)])),
});

const etapaDoRendimento = (etapa: string, aprovacao: PorRede, reprovacao: PorRede, abandono: PorRede) => ({
  etapa,
  aprovacao: taxa('aprovacao', etapa, '2025', FONTE_DO_RENDIMENTO, aprovacao),
  reprovacao: taxa('reprovacao', etapa, '2025', FONTE_DO_RENDIMENTO, reprovacao),
  abandono: taxa('abandono', etapa, '2025', FONTE_DO_RENDIMENTO, abandono),
});

const SEM_MATRICULA = { publica: null, municipal: null, estadual: null, privada: null, todas: null };

const serieDoRendimento = (
  etapa: string,
  reprovacao: PorRede,
  abandono: PorRede,
  matriculas: Partial<Record<Rede, number>>,
) => ({
  etapa,
  reprovacao: taxa('reprovacao', etapa, '2025', FONTE_DO_RENDIMENTO, reprovacao),
  abandono: taxa('abandono', etapa, '2025', FONTE_DO_RENDIMENTO, abandono),
  matriculas: { ...SEM_MATRICULA, ...matriculas },
});

const FONTE_DA_DISTORCAO = { nome: 'INEP, distorção idade-série', url: 'https://inep.exemplo/distorcao' };
const FONTE_DA_TRANSICAO = { nome: 'INEP, taxas de transição', url: 'https://inep.exemplo/transicao' };

export const permanencia = (trocas: Partial<EducacaoPermanencia> = {}): EducacaoPermanencia =>
  educacaoPermanenciaSchema.parse({
    disponivel: true,
    faltando: [],
    rendimento: {
      ano: '2025',
      fonte: FONTE_DO_RENDIMENTO,
      etapas: [
        etapaDoRendimento(
          'anos_iniciais',
          { publica: [97.4, 98.1, 97.9], municipal: [96.3, 98.2, 98.3], privada: [100, 99.5, 99.2] },
          { publica: [2.6, 1.6, 1.7], municipal: [3.7, 1.8, 1.7], privada: [0, 0.5, 0.8] },
          { publica: [0, 0.3, 0.4], municipal: [0, 0, 0], privada: [0, 0, 0] },
        ),
        etapaDoRendimento(
          'anos_finais',
          { publica: [95.8, 96.1, 95.2], municipal: [93.8, 96.3, 95.6], privada: [100, 99.1, 99.3] },
          { publica: [4.2, 3.6, 3.9], municipal: [6.2, 3.7, 4.4], privada: [0, 0.9, 0.7] },
          { publica: [0, 0.3, 0.9], municipal: [0, 0, 0], privada: [0, 0, 0] },
        ),
        etapaDoRendimento(
          'medio',
          { publica: [85.1, 88.7, 94.3], municipal: [null, 80.5, 84.5], privada: [98.1, 99.1, 99.2] },
          { publica: [8.9, 7.4, 3.2], municipal: [null, 14.5, 11.5], privada: [1.9, 0.9, 0.8] },
          { publica: [6, 3.9, 2.5], municipal: [null, 5, 4], privada: [0, 0, 0] },
        ),
      ],
    },
    series: {
      ano: '2025',
      fonte: FONTE_DO_RENDIMENTO,
      fonteDasMatriculas: FONTE_DAS_MATRICULAS,
      series: [
        serieDoRendimento(
          'ano_2',
          { publica: [7.6, 2, 1.5], municipal: [10.1, 2.1, 1.3] },
          { publica: [0, 0, 0], municipal: [0, 0, 0] },
          { publica: 298, municipal: 177, estadual: 121, privada: 48, todas: 346 },
        ),
        serieDoRendimento(
          'ano_3',
          { municipal: [0, 0.5, 0.4] },
          { municipal: [0, 0, 0] },
          { publica: 254, municipal: 132, estadual: 122, privada: 55, todas: 309 },
        ),
        serieDoRendimento(
          'ano_4',
          { municipal: [3.8, 1, 1] },
          { municipal: [0, 0, 0] },
          { publica: 257, municipal: 144, estadual: 113, privada: 49, todas: 306 },
        ),
        serieDoRendimento(
          'ano_5',
          { municipal: [7.8, 2, 2] },
          { municipal: [0, 0, 0] },
          { publica: 237, municipal: 130, estadual: 107, privada: 38, todas: 275 },
        ),
        serieDoRendimento(
          'ano_6',
          { publica: [5.8, 4, 5], municipal: [11.8, 4.2, 5.8] },
          { publica: [0, 0, 0], municipal: [0, 0, 0] },
          { publica: 242, municipal: 52, estadual: 190, privada: 63, todas: 305 },
        ),
        // A maior taxa da rede estadual, sem matrícula: não vira "cerca de".
        serieDoRendimento('ano_7', { estadual: [30, 4, 5] }, { estadual: [0, 0, 0] }, { municipal: 51, privada: 31 }),
        serieDoRendimento(
          'serie_1',
          { publica: [19.7, 12.4, 4.2], estadual: [19.7, 12.5, 4.3], privada: [5.6, 3, 2] },
          { publica: [9.7, 4.1, 3], estadual: [9.6, 4.2, 3.1], privada: [0, 0, 0] },
          { publica: 224, estadual: 224, privada: 38, todas: 262 },
        ),
      ],
    },
    distorcao: {
      ano: '2025',
      fonte: FONTE_DA_DISTORCAO,
      etapas: [
        taxa('distorcao', 'anos_iniciais', '2025', FONTE_DA_DISTORCAO, {
          publica: [5.3, 5.4, 6.6],
          municipal: [5.5, 5.6, 6.7],
        }),
        taxa('distorcao', 'anos_finais', '2025', FONTE_DA_DISTORCAO, {
          publica: [14.5, 13.3, 14.4],
          municipal: [17.6, 13.4, 19.5],
        }),
        taxa('distorcao', 'medio', '2025', FONTE_DA_DISTORCAO, {
          publica: [19.2, 18.6, 17.6],
          municipal: [null, 20, 22],
        }),
      ],
    },
    evasao: {
      ano: '2021-2022',
      fonte: FONTE_DA_TRANSICAO,
      etapas: [
        taxa('evasao', 'anos_iniciais', '2021-2022', FONTE_DA_TRANSICAO, {
          publica: [0.8, 0.7, 1.2],
          municipal: [null, null, 1.3],
        }),
        taxa('evasao', 'anos_finais', '2021-2022', FONTE_DA_TRANSICAO, { publica: [3.6, 2.9, 4] }),
        taxa('evasao', 'medio', '2021-2022', FONTE_DA_TRANSICAO, {
          publica: [9.6, 13.5, 9.5],
          privada: [1.1, 1.5, 1],
        }),
      ],
    },
    ...trocas,
  });

export const permanenciaIndisponivel = () =>
  permanencia({
    disponivel: false,
    faltando: ['inep_rendimento', 'inep_distorcao', 'inep_transicao', 'ibge_rede_escolar'],
    rendimento: null,
    series: null,
    distorcao: null,
    evasao: null,
  });

const FONTE_DO_INEP = { nome: 'INEP, indicadores educacionais', url: 'https://inep.exemplo/indicadores' };
const FONTE_DO_SIOPE = {
  nome: 'SIOPE, Remuneração: profissionais declarados',
  url: 'https://siope.exemplo/remuneracao',
};

type PorRedeDaFabrica = Partial<Record<'publica' | 'municipal' | 'estadual' | 'privada' | 'todas', Tres>>;

const comparacaoDoInep = (
  indicador: string,
  etapa: string,
  unidade: ComparacaoDeEducacao['unidade'],
  porRede: PorRedeDaFabrica,
): ComparacaoDeEducacao => ({
  indicador,
  etapa,
  ano: '2025',
  unidade,
  fonte: FONTE_DO_INEP,
  porRede: Object.fromEntries(Object.entries(porRede).map(([rede, tres]) => [rede, lugares(tres)])),
});

const gruposDaEtapa = (etapa: string, publica: Tres[], municipal: Tres[]) => ({
  etapa,
  grupos: (['grupo_1', 'grupo_2', 'grupo_3', 'grupo_4', 'grupo_5'] as const).map((grupo, i) => ({
    grupo,
    comparacao: comparacaoDoInep(`adequacao_${grupo}`, etapa, '%', {
      publica: publica[i] as Tres,
      municipal: municipal[i] as Tres,
    }),
  })),
});

const nivelDeRegularidade = (nivel: 'baixa' | 'media_baixa' | 'media_alta' | 'alta', porRede: PorRedeDaFabrica) => ({
  nivel,
  comparacao: comparacaoDoInep(`regularidade_${nivel}`, '', '%', porRede),
});

const GRUPOS_NA_INFANTIL: Tres[] = [
  [37, 64, 69],
  [1, 0.5, 0.5],
  [42, 27, 17],
  [0, 3, 2.5],
  [20, 5.5, 11],
];

export const professores = (trocas: Partial<EducacaoProfessores> = {}): EducacaoProfessores =>
  educacaoProfessoresSchema.parse({
    disponivel: true,
    faltando: [],
    turmas: {
      ano: '2025',
      fonte: FONTE_DO_INEP,
      comparacoes: [
        comparacaoDoInep('alunos_por_turma', 'creche', 'alunos', { todas: [6.5, 10.5, 13.5] }),
        comparacaoDoInep('alunos_por_turma', 'anos_iniciais', 'alunos', {
          publica: [18, 22, 22.5],
          municipal: [15.5, 21.5, 22],
          estadual: [null, 22.5, 22.5],
        }),
      ],
    },
    horas: {
      ano: '2025',
      fonte: FONTE_DO_INEP,
      comparacoes: [comparacaoDoInep('horas_aula', 'creche', 'horas', { todas: [9.1, 9.1, 7.7] })],
    },
    formacao: {
      ano: '2025',
      fonte: FONTE_DO_INEP,
      etapas: [
        gruposDaEtapa('educacao_infantil', GRUPOS_NA_INFANTIL, GRUPOS_NA_INFANTIL),
        gruposDaEtapa('anos_iniciais', GRUPOS_NA_INFANTIL, GRUPOS_NA_INFANTIL),
        gruposDaEtapa('medio', GRUPOS_NA_INFANTIL, GRUPOS_NA_INFANTIL),
      ],
    },
    docentesSuperior: {
      ano: '2025',
      fonte: FONTE_DO_INEP,
      comparacoes: [comparacaoDoInep('docentes_superior', 'medio', '%', { publica: [92.5, 94.5, 96.5] })],
    },
    regularidade: {
      ano: '2025',
      fonte: FONTE_DO_INEP,
      niveis: [
        nivelDeRegularidade('baixa', {
          publica: [36.8, 33.7, 10.2],
          municipal: [21.4, 19.9, 10.3],
          estadual: [80, 76.6, 9.9],
        }),
        nivelDeRegularidade('media_baixa', {
          publica: [63.2, 47.3, 36.8],
          municipal: [78.6, 56.2, 35.2],
          estadual: [20, 21.6, 43],
        }),
        nivelDeRegularidade('media_alta', {
          publica: [0, 17.7, 43],
          municipal: [0, 22.4, 43.3],
          estadual: [0, 1.6, 40.8],
        }),
        nivelDeRegularidade('alta', { publica: [0, 1.3, 10], municipal: [0, 1.5, 11.2], estadual: [0, 0.2, 6.3] }),
      ],
    },
    alunosPorDocente: {
      fonte: {
        nome: 'IBGE, sinopse do Censo Escolar (INEP): matrículas ÷ docentes',
        url: 'https://ibge.exemplo/pesquisas',
      },
      rede: 'municipal',
      etapas: [
        {
          etapa: 'creche',
          anos: [
            { ano: '2024', matriculas: 450, docentes: 36, alunosPorDocente: 12.5 },
            { ano: '2025', matriculas: 472, docentes: 40, alunosPorDocente: 11.8 },
          ],
        },
        {
          etapa: 'pre_escola',
          anos: [
            { ano: '2024', matriculas: 500, docentes: null, alunosPorDocente: null },
            { ano: '2025', matriculas: 495, docentes: 45, alunosPorDocente: 11 },
          ],
        },
      ],
    },
    temporarios: {
      fonte: FONTE_DO_SIOPE,
      anos: [
        {
          periodo: '2024-05',
          magisterio: { cargaTemporaria: 10, profissionais: 110 },
          outros: { cargaTemporaria: 20, profissionais: 'menos de 5' },
        },
        {
          periodo: '2025-05',
          magisterio: { cargaTemporaria: 30, profissionais: 180 },
          outros: { cargaTemporaria: 0, profissionais: 50 },
        },
        {
          periodo: '2026-05',
          magisterio: { cargaTemporaria: 45, profissionais: 150 },
          outros: { cargaTemporaria: 60, profissionais: 70 },
        },
      ],
    },
    remuneracao: {
      fonte: FONTE_DO_SIOPE,
      anos: [
        {
          periodo: '2024-05',
          magisterio: { todos: 5000, efetivo: 5500, temporario: 4500 },
          outros: { todos: 2100, efetivo: 2200, temporario: 2000 },
        },
        {
          periodo: '2025-05',
          magisterio: { todos: 5800, efetivo: 6200, temporario: 5300 },
          outros: { todos: 2300, efetivo: 2400, temporario: null },
        },
        {
          periodo: '2026-05',
          magisterio: { todos: 6300, efetivo: 6600.5, temporario: 6100.25 },
          outros: { todos: 2400, efetivo: 2500, temporario: 2100 },
        },
      ],
    },
    rais: {
      ano: '2021',
      fonte: { nome: 'INEP, remuneração dos docentes, a partir da RAIS', url: 'https://inep.exemplo/remuneracao' },
      linhas: [
        { lugar: 'orleans', rede: 'municipal', mediaPor40h: 3900.5, docentes: 100 },
        { lugar: 'santaCatarina', rede: 'publica', mediaPor40h: 5300, docentes: 80000 },
        { lugar: 'brasil', rede: 'municipal', mediaPor40h: 5150.75, docentes: 1200000 },
      ],
    },
    ...trocas,
  });

export const professoresIndisponivel = () =>
  professores({
    disponivel: false,
    faltando: [
      'inep_turmas',
      'inep_horas',
      'inep_adequacao',
      'inep_docentes_superior',
      'inep_regularidade',
      'ibge_rede_escolar',
      'inep_remuneracao',
      'siope_remuneracao_carga',
      'siope_remuneracao',
    ],
    turmas: null,
    horas: null,
    formacao: null,
    docentesSuperior: null,
    regularidade: null,
    alunosPorDocente: null,
    temporarios: null,
    remuneracao: null,
    rais: null,
  });

const FONTE_DO_IDEB = { nome: 'IBGE, pesquisa 40 (IDEB do INEP)', url: 'https://ibge.exemplo/pesquisas' };
const FONTE_DO_ENEM = { nome: 'INEP, microdados do ENEM', url: 'https://inep.exemplo/enem' };

// De 2021 a 2025, nos três lugares. Lista vazia é o lugar sem linha naquela rede.
type TresAnos = [number | null, number | null, number | null];
const pontosDe = (valores: TresAnos | []) => valores.map((valor, i) => ({ ano: 2021 + 2 * i, valor }));
const serieDaRede = (orleans: TresAnos | [], santaCatarina: TresAnos | [], brasil: TresAnos | []) => ({
  orleans: pontosDe(orleans),
  santaCatarina: pontosDe(santaCatarina),
  brasil: pontosDe(brasil),
});
const etapaDoIdeb = (etapa: string, series: Partial<Record<Rede, ReturnType<typeof serieDaRede>>>) => ({
  etapa,
  series,
  comparacao: {
    indicador: 'ideb',
    etapa,
    ano: '2025',
    unidade: 'indice' as const,
    fonte: FONTE_DO_IDEB,
    porRede: Object.fromEntries(
      Object.entries(series).map(([rede, s]) => [
        rede,
        {
          orleans: s.orleans.at(-1)?.valor ?? null,
          santaCatarina: s.santaCatarina.at(-1)?.valor ?? null,
          brasil: s.brasil.at(-1)?.valor ?? null,
        },
      ]),
    ),
  },
});
const parcelaDoIdeb = (
  lugar: 'orleans' | 'santaCatarina' | 'brasil',
  rede: Rede,
  etapa: string,
  [ideb, rendimento, aprovacao, matematica, portugues]: [number, number, number, number, number],
) => ({ lugar, rede, etapa, ideb, rendimento, aprovacao, matematica, portugues });

const areaDoEnem = (indicador: string, porRede: Partial<Record<Rede, Tres>>) => ({
  indicador,
  etapa: 'medio',
  ano: '2025',
  unidade: 'nota' as const,
  fonte: FONTE_DO_ENEM,
  porRede: Object.fromEntries(Object.entries(porRede).map(([rede, tres]) => [rede, lugares(tres)])),
});
const NOTAS_DO_ENEM: Partial<Record<Rede, Tres>> = {
  publica: [523.64, 533, 505],
  municipal: [null, 500, 480],
  estadual: [523.64, 530, 495],
  privada: [614.02, 620, 610],
  todas: [544.35, 560, 530],
};

export const aprendizado = (trocas: Partial<EducacaoAprendizado> = {}): EducacaoAprendizado =>
  educacaoAprendizadoSchema.parse({
    disponivel: true,
    faltando: [],
    alfabetizacao: {
      ano: '2025',
      fonte: { nome: 'INEP, Indicador Criança Alfabetizada', url: 'https://inep.exemplo/alfabetizacao' },
      redes: { orleans: 'municipal', santaCatarina: 'publica', brasil: 'publica' },
      serie: [
        { ano: '2023', valores: lugares([66, 61, 56]) },
        { ano: '2024', valores: lugares([68, 62, 59]) },
        { ano: '2025', valores: lugares([65, 63, 66]) },
      ],
      metas: [
        { ano: '2025', orleans: 70, santaCatarina: 67, brasil: 64 },
        { ano: '2027', orleans: null, santaCatarina: 73, brasil: 71 },
        { ano: '2030', orleans: 80, santaCatarina: '> 80', brasil: '> 80' },
      ],
      participacao: lugares([84, 87.8, 89]),
    },
    ideb: {
      ano: '2025',
      fonte: FONTE_DO_IDEB,
      fonteDoInep: { nome: 'INEP, arquivo do IDEB', url: 'https://inep.exemplo/ideb' },
      etapas: [
        etapaDoIdeb('anos_iniciais', {
          publica: serieDaRede([6, 6.2, 6.6], [6.2, 6.2, 6.5], [5.5, 5.7, 6.1]),
          municipal: serieDaRede([5.9, 6.8, 6.4], [6.1, 6.3, 6.5], [5.5, 5.8, 6.1]),
          estadual: serieDaRede([6, 5.8, 6.7], [6.1, 5.8, 6.3], [5.9, 6, 6.4]),
          privada: serieDaRede([], [7.7, 7.8, 7.8], [7.1, 7.2, 7.1]),
          todas: serieDaRede([], [6.4, 6.4, 6.7], [5.8, 6, 6.3]),
        }),
        etapaDoIdeb('anos_finais', {
          publica: serieDaRede([4.9, 4.5, 5.3], [5, 4.9, 5.2], [4.9, null, 5]),
          municipal: serieDaRede([4.6, 3.7, 5.1], [4.8, 4.8, 5.1], [4.8, null, 4.9]),
          estadual: serieDaRede([4.9, 4.6, 5.3], [4.8, 4.6, 5], [5, null, 5.1]),
        }),
        etapaDoIdeb('medio', {
          publica: serieDaRede([null, null, 3.9], [3.6, 3.8, 4.3], [3.9, 4.1, 4.3]),
          estadual: serieDaRede([null, null, 3.9], [3.6, 3.8, 4.3], [3.9, 4.1, 4.3]),
          privada: serieDaRede([], [6, 6, 5.8], [5.6, 5.6, 5.8]),
        }),
      ],
      parcelas: [
        parcelaDoIdeb('orleans', 'publica', 'anos_iniciais', [6.6, 0.97, 97.4, 242.16, 229.6]),
        parcelaDoIdeb('orleans', 'municipal', 'anos_iniciais', [6.4, 0.96, 96.3, 239.84, 227.45]),
        parcelaDoIdeb('orleans', 'estadual', 'medio', [3.9, 0.84, 85.1, 268.96, 280.96]),
        parcelaDoIdeb('santaCatarina', 'municipal', 'anos_iniciais', [6.5, 0.98, 98, 235, 222]),
        parcelaDoIdeb('brasil', 'municipal', 'anos_iniciais', [6.1, 0.98, 98, 227.79, 210]),
      ],
    },
    inse: {
      ano: '2023',
      fonte: { nome: 'INEP, Indicador de Nível Socioeconômico', url: 'https://inep.exemplo/inse' },
      comparacao: {
        indicador: 'inse',
        etapa: '',
        ano: '2023',
        unidade: 'indice',
        fonte: { nome: 'INEP, Indicador de Nível Socioeconômico', url: 'https://inep.exemplo/inse' },
        porRede: { publica: lugares([5.58, 5.5, 4.92]), municipal: lugares([5.52, 5.48, 4.84]) },
      },
    },
    enem: {
      ano: '2025',
      fonte: FONTE_DO_ENEM,
      fonteDaTerceiraSerie: { nome: 'IBGE, sinopse do Censo Escolar (INEP)', url: 'https://ibge.exemplo/pesquisas' },
      anos: [
        {
          ano: '2024',
          // A rede privada foi retida neste ano: sem linha.
          redes: [
            {
              rede: 'publica',
              escolas: 2,
              inscritos: 113,
              presentes: 79,
              terceiraSerie: 181,
              presentesSobreTerceiraSerie: 43.6,
            },
          ],
          comparacoes: [areaDoEnem('enem_media_5_areas', NOTAS_DO_ENEM)],
        },
        {
          ano: '2025',
          redes: [
            {
              rede: 'publica',
              escolas: 2,
              inscritos: 106,
              presentes: 74,
              terceiraSerie: 167,
              presentesSobreTerceiraSerie: 44.3,
            },
            {
              rede: 'privada',
              escolas: 2,
              inscritos: 28,
              presentes: 22,
              terceiraSerie: 32,
              presentesSobreTerceiraSerie: 68.8,
            },
            {
              rede: 'todas',
              escolas: 4,
              inscritos: 134,
              presentes: 96,
              terceiraSerie: 199,
              presentesSobreTerceiraSerie: 48.2,
            },
          ],
          comparacoes: [
            areaDoEnem('enem_media_5_areas', NOTAS_DO_ENEM),
            areaDoEnem('enem_redacao', { publica: [584.39, 600, 570] }),
          ],
        },
      ],
    },
    ...trocas,
  });

export const aprendizadoIndisponivel = () =>
  aprendizado({
    disponivel: false,
    faltando: ['inep_alfabetizacao', 'ibge_rede_escolar', 'inep_ideb', 'inep_inse', 'inep_enem'],
    alfabetizacao: null,
    ideb: null,
    inse: null,
    enem: null,
  });

const FONTE_DO_SUPERIOR = { nome: 'INEP, Censo da Educação Superior', url: 'https://inep.exemplo/superior' };
const FONTE_DA_CIDADE = { nome: 'IBGE, Censo 2022', url: 'https://ibge.exemplo/agregados' };

const comparadaNoCenso = (
  indicador: string,
  etapa: string,
  [orleans, santaCatarina, brasil]: [number | null, number | null, number | null],
  unidade: '%' | 'anos' = '%',
) => ({
  indicador,
  etapa,
  ano: '2022',
  unidade,
  fonte: FONTE_DA_CIDADE,
  porRede: { todas: { orleans, santaCatarina, brasil } },
});

const grupoDaAlfabetizacao = (grupo: string, orleans: number) => ({
  grupo,
  comparacao: comparadaNoCenso('alfabetizacao', grupo, [orleans, 97, 90]),
});

const anosDeEstudo = (grupo: string, valores: [number, number, number]) => ({
  grupo,
  comparacao: comparadaNoCenso('anos_de_estudo', grupo, valores, 'anos'),
});

const curso = (
  nome: string,
  vagas: number,
  ingressantes: number | 'menos de 5',
  matriculas: number | 'menos de 5',
  concluintes: number | 'menos de 5',
  mulheres: number | null = null,
  noturno: number | null = null,
) => ({ curso: nome, vagas, ingressantes, matriculas, concluintes, mulheres, noturno });

export const cidade = (trocas: Partial<EducacaoCidade> = {}): EducacaoCidade =>
  educacaoCidadeSchema.parse({
    disponivel: true,
    faltando: [],
    alfabetizacao: {
      ano: '2022',
      fonte: FONTE_DA_CIDADE,
      total: comparadaNoCenso('alfabetizacao', '15 anos ou mais', [97.27, 97.33, 93.01]),
      naoAlfabetizados: 512,
      porGrupo: [
        grupoDaAlfabetizacao('Homens', 97.1),
        grupoDaAlfabetizacao('Mulheres', 97.4),
        grupoDaAlfabetizacao('Urbana', 97.5),
        grupoDaAlfabetizacao('Rural', 96.62),
      ],
      porIdade: [
        grupoDaAlfabetizacao('15 a 17 anos', 99.2),
        { grupo: '18 e 19 anos', comparacao: comparadaNoCenso('alfabetizacao', '18 e 19 anos', [null, null, null]) },
        grupoDaAlfabetizacao('65 anos ou mais', 92.4),
        grupoDaAlfabetizacao('75 anos ou mais', 88.75),
      ],
    },
    escolaridade: {
      ano: '2022',
      fonte: FONTE_DA_CIDADE,
      anosDeEstudo: [
        anosDeEstudo('25 anos ou mais', [9.5, 10.2, 9.4]),
        anosDeEstudo('18 a 24 anos', [11.9, 11.7, 11.3]),
      ],
      pessoasDe25AnosOuMais: 15000,
      niveis: [
        { nivel: 'medio_ou_mais', comparacao: comparadaNoCenso('instrucao_medio_ou_mais', '', [48.5, 53.5, 50.5]) },
        { nivel: 'superior', comparacao: comparadaNoCenso('instrucao_superior', '', [21.5, 22.5, 19.5]) },
        { nivel: 'sem_instrucao', comparacao: comparadaNoCenso('instrucao_sem_instrucao', '', [35.5, 31.5, 34.5]) },
      ],
    },
    moradores: {
      ano: '2022',
      fonte: FONTE_DA_CIDADE,
      graduacao: 580,
      emOrleans: 395,
      emOutroMunicipio: 186,
      noExterior: 0,
      posGraduacao: 110,
      posEmOutroMunicipio: 40,
      foraDoMunicipio: comparadaNoCenso('graduacao_em_outro_municipio', '', [32.1, 26.9, 27.2]),
    },
    oferta: {
      ano: '2024',
      fonte: FONTE_DO_SUPERIOR,
      instituicao: 'FICTICIA',
      natureza: 'Privada sem fins lucrativos',
      cursos: 5,
      vagas: 900,
      inscritos: 500,
      ingressantes: 480,
      matriculas: 1400,
      concluintes: 190,
      perfil: [
        { recorte: 'noturno', pessoas: 1232, percentual: 88 },
        { recorte: 'escola_publica', pessoas: 1000, percentual: 71.4 },
        { recorte: 'de_18_a_24', pessoas: 1050, percentual: 75 },
        { recorte: 'mulheres', pessoas: 840, percentual: 60 },
        { recorte: 'prouni', pessoas: 280, percentual: 20 },
        { recorte: 'fies', pessoas: 14, percentual: 1 },
      ],
      ead: { instituicoes: 6, matriculas: 11, ingressantes: 9 },
      docentes: { total: 150, doutores: 40, mestres: 70, especialistas: 40, tempoIntegral: 30 },
      tecnicos: 70,
    },
    igc: {
      ano: '2023',
      fonte: { nome: 'INEP, IGC', url: 'https://inep.exemplo/igc' },
      continuo: 2.41,
      faixa: 3,
      distribuicaoEmSc: [
        { faixa: 2, instituicoes: 8 },
        { faixa: 3, instituicoes: 50 },
        { faixa: 4, instituicoes: 22 },
      ],
      instituicoesEmSc: 80,
    },
    cursos: {
      ano: '2024',
      fonte: FONTE_DO_SUPERIOR,
      lista: [
        curso('Direito (bacharelado)', 90, 70, 230, 25, 150, 230),
        curso('Veterinária Fictícia (bacharelado)', 70, 40, 170, 30, 130, 0),
        curso('Design Fictício (tecnologico)', 40, 6, 16, 8, 14, 16),
        curso('Curso Pequeno (licenciatura)', 30, 6, 8, 6),
        curso('Curso Mínimo (bacharelado)', 3, 'menos de 5', 'menos de 5', 'menos de 5'),
      ],
    },
    ...trocas,
  });

export const cidadeIndisponivel = () =>
  cidade({
    disponivel: false,
    faltando: ['ibge_educacao_censo', 'ibge_educacao_comparacao', 'inep_superior'],
    alfabetizacao: null,
    escolaridade: null,
    moradores: null,
    oferta: null,
    igc: null,
    cursos: null,
  });

const FONTE_DO_ANEXO_8 = { nome: 'SIOPE, Anexo 8 do RREO', url: 'https://siope.exemplo/anexo8' };
const FONTE_DO_RREO = { nome: 'SICONFI, RREO Anexo 14', url: 'https://siconfi.exemplo/rreo' };

const indice = (
  ano: number,
  percentual: number,
  aplicado: number | null,
  minimo: number,
  siconfi: [number, number] | null,
  difereDoSiconfi = siconfi !== null,
) => ({
  ano,
  percentual,
  aplicado,
  minimo,
  siconfi: siconfi && { percentual: siconfi[0], valor: siconfi[1] },
  difereDoSiconfi,
});

const etapasDoGasto = (fundamental: number, infantil: number) => [
  { chave: 'fundamental' as const, valor: 20000000, percentual: fundamental },
  { chave: 'infantil' as const, valor: 15000000, percentual: infantil },
  { chave: 'outras' as const, valor: 1650000, percentual: 4.4 },
];

export const dinheiro = (trocas: Partial<EducacaoDinheiro> = {}): EducacaoDinheiro =>
  educacaoDinheiroSchema.parse({
    disponivel: true,
    faltando: [],
    valores: 'nominais',
    minimo: {
      fonte: FONTE_DO_ANEXO_8,
      fonteComparada: FONTE_DO_RREO,
      anos: [
        indice(2020, 28.08, 14000000, 25, [28.54, 14200000]),
        indice(2021, 23.28, 14604000, 25, [23.28, 14603900.5]),
        indice(2022, 27.62, 20900000, 25, [27.62, 20900000], false),
        indice(2025, 28.63, 30000000, 25, [28.31, 29700000]),
      ],
      emenda119: { diferencaEm2021: 1000000.5, complementadoEm2022: 1200000 },
    },
    fundebRemuneracao: {
      fonte: FONTE_DO_ANEXO_8,
      fonteComparada: FONTE_DO_RREO,
      anos: [
        indice(2020, 80.66, null, 60, [87.13, 8000000]),
        indice(2021, 78.12, 9000000, 70, [78.94, 9100000]),
        indice(2022, 86.03, 11000000, 70, [86.03, 11000000], false),
        indice(2025, 87.61, 15000000, 70, null),
      ],
    },
    gasto: {
      fonte: { nome: 'SICONFI, DCA Anexo I-E, função 12, valor liquidado', url: 'https://siconfi.exemplo/dca' },
      anos: [
        {
          ano: 2023,
          liquidado: 30000000,
          conferencia: 'sem_betha',
          igualAoAnexo8: false,
          anexo8: 30000000.01,
          divisor: { ano: 2022, populacao: 23000, tipo: 'censo' },
          porMorador: 1304.35,
          participacao: 25.5,
          etapas: etapasDoGasto(60.5, 34.9),
        },
        {
          ano: 2024,
          liquidado: 31500000,
          conferencia: 'conferido',
          igualAoAnexo8: true,
          anexo8: 31500000,
          divisor: { ano: 2024, populacao: 23800, tipo: 'estimativa' },
          porMorador: 1323.53,
          participacao: 22.4,
          etapas: etapasDoGasto(56.5, 38.8),
        },
        {
          ano: 2025,
          liquidado: 37500000,
          conferencia: 'conferido',
          igualAoAnexo8: true,
          anexo8: 37500000,
          divisor: { ano: 2025, populacao: 24000, tipo: 'estimativa' },
          porMorador: 1562.5,
          participacao: 25.6,
          etapas: etapasDoGasto(54.9, 39.6),
        },
      ],
      acoesNasEtapas: { ano: 2025, transporte: 3950000, merenda: 1650000 },
    },
    acoes: {
      fonte: { nome: 'Portal da Transparência (Betha), despesa por ação', url: 'https://betha.exemplo/despesas' },
      anos: [
        {
          ano: 2024,
          total: 31500000,
          totalConferido: true,
          acoes: [{ nome: 'Manutenção do Ensino Fundamental', liquidado: 13600000 }],
          naturezas: [
            { chave: 'pessoal', liquidado: 20160000, percentual: 64 },
            { chave: 'custeio', liquidado: 9828000, percentual: 31.2 },
            { chave: 'investimento', liquidado: 1512000, percentual: 4.8 },
          ],
        },
        {
          ano: 2025,
          total: 37500000,
          totalConferido: true,
          acoes: [
            { nome: 'Manutenção do Ensino Fundamental', liquidado: 16600000 },
            { nome: 'Manutenção do Transporte Escolar', liquidado: 3950000 },
            { nome: 'Aquisição de Veículo - Educação', liquidado: 0 },
          ],
          naturezas: [
            { chave: 'pessoal', liquidado: 25600000, percentual: 68.3 },
            { chave: 'custeio', liquidado: 11700000, percentual: 31.2 },
            { chave: 'investimento', liquidado: 200000, percentual: 0.5 },
          ],
        },
      ],
    },
    repasses: {
      fonte: { nome: 'Portal da Transparência (Betha), receita conferida', url: 'https://betha.exemplo/receitas' },
      anos: [
        {
          ano: 2024,
          rubricas: [{ rubrica: '17515001000000', nome: 'Fundeb', valor: 16300000 }],
          equivalencias: [
            { chave: 'transporte', gasto: 3540000, repasses: 1300000, percentual: 36.7 },
            { chave: 'merenda', gasto: 1120000, repasses: 323000, percentual: 28.8 },
          ],
        },
        {
          ano: 2025,
          rubricas: [
            { rubrica: '17515001000000', nome: 'Fundeb', valor: 17500000 },
            { rubrica: '17145201000000', nome: 'PNAE, alimentação escolar', valor: 330000 },
            { rubrica: '17149901040000', nome: 'Programa Escola em Tempo Integral', valor: null },
          ],
          equivalencias: [
            { chave: 'transporte', gasto: 3950000, repasses: 1400000, percentual: 35.5 },
            { chave: 'merenda', gasto: 1650000, repasses: 330000, percentual: 20.1 },
          ],
        },
      ],
    },
    contaDoFundeb: {
      fonte: FONTE_DO_ANEXO_8,
      anos: [
        {
          ano: 2023,
          recebido: null,
          contribuicao: 11600000,
          contribuicaoConferida: false,
          conta: null,
          resultado: 2600000,
          diferenca: null,
        },
        {
          ano: 2024,
          recebido: 16300000,
          contribuicao: 14200000,
          contribuicaoConferida: true,
          conta: 2100000,
          resultado: 2100000,
          diferenca: 0,
        },
        {
          ano: 2025,
          recebido: 17500000,
          contribuicao: 16000000,
          contribuicaoConferida: true,
          conta: 1500000,
          resultado: 1419999.5,
          diferenca: -80000.5,
        },
      ],
    },
    porAluno: {
      fonte: { nome: 'SIOPE, Relatório de Indicadores', url: 'https://siope.exemplo/indicadores' },
      anos: [
        { ano: 2022, infantil: 6600, fundamental: 18600, educacaoBasica: null },
        { ano: 2025, infantil: 13181, fundamental: 21028, educacaoBasica: 19269 },
      ],
    },
    ...trocas,
  });

export const dinheiroIndisponivel = (): EducacaoDinheiro =>
  dinheiro({
    disponivel: false,
    faltando: ['siope_anexo8'],
    minimo: null,
    fundebRemuneracao: null,
    gasto: null,
    acoes: null,
    repasses: null,
    contaDoFundeb: null,
    porAluno: null,
  });

const FONTE_DO_RESUMO = { nome: 'Fonte fictícia', url: 'https://fonte.exemplo' };

export const resumo = (trocas: Partial<EducacaoResumo> = {}): EducacaoResumo =>
  educacaoResumoSchema.parse({
    disponivel: true,
    faltando: [],
    alfabetizacao: {
      ano: '2025',
      fonte: { nome: 'INEP, alfabetização', url: 'https://inep.exemplo/alfabetizacao' },
      redes: { orleans: 'municipal', santaCatarina: 'publica', brasil: 'publica' },
      valores: lugares([71, 58, 62]),
      metaDeOrleans: 75,
    },
    creche: {
      ano: '2022',
      fonte: FONTE_DO_CENSO,
      rede: 'todas',
      valores: lugares([44.25, 41.75, 29.5]),
      anoAnterior: '2010',
      fonteAnterior: { nome: 'IBGE, Censo 2010', url: 'https://ibge.exemplo/2010' },
      orleansNoAnoAnterior: 30.5,
    },
    procuraPorCreche: { ano: '2025', fonte: FONTE_DO_RESUMO, solicitacoesNaoAtendidas: 'Sem fila informada' },
    abandono: {
      ano: '2025',
      fonte: FONTE_DO_RESUMO,
      rede: 'publica',
      valores: lugares([7.5, 4.5, 3.5]),
      anosIniciais: lugares([0, 0.1, 0.2]),
      anosFinais: lugares([0.4, 0.3, 1.5]),
    },
    ideb: { ano: '2025', fonte: FONTE_DO_RESUMO, rede: 'publica', valores: lugares([7.2, 6.9, 6.3]) },
    docentesSuperior: { ano: '2025', fonte: FONTE_DO_RESUMO, rede: 'publica', valores: lugares([93.5, 95.5, 89.5]) },
    turmas: { ano: '2025', fonte: FONTE_DO_RESUMO, rede: 'publica', valores: lugares([15.5, 20.5, 21.5]) },
    gasto: {
      ano: 2025,
      fonte: { nome: 'SICONFI, função 12', url: 'https://siconfi.exemplo' },
      liquidado: 41250000.5,
      conferencia: 'conferido',
      igualAoAnexo8: true,
      porMorador: 1650.5,
      divisor: { ano: 2025, populacao: 24992, tipo: 'estimativa' },
    },
    minimo: {
      ano: 2025,
      fonte: { nome: 'SIOPE, Anexo 8', url: 'https://siope.exemplo' },
      percentual: 27.75,
      aplicado: 30000000,
      minimo: 25,
      siconfi: { percentual: 27.25, valor: 29500000 },
      difereDoSiconfi: true,
    },
    matriculas: {
      ano: '2025',
      fonte: FONTE_DO_RESUMO,
      total: 3150,
      etapas: [
        { etapa: 'creche', total: 500, municipal: 400, estadual: null, federal: null, privada: 100 },
        { etapa: 'pre_escola', total: 450, municipal: 380, estadual: null, federal: null, privada: 70 },
        { etapa: 'fundamental', total: 1600, municipal: 600, estadual: 800, federal: null, privada: 200 },
        { etapa: 'medio', total: 600, municipal: null, estadual: 500, federal: null, privada: 100 },
      ],
    },
    alfabetizacaoDosMoradores: {
      ano: '2022',
      fonte: FONTE_DO_CENSO,
      rede: 'todas',
      valores: lugares([96.75, 97.25, 93.25]),
    },
    superior: {
      ano: '2024',
      fonte: FONTE_DO_RESUMO,
      instituicao: 'FACULDADE FICTÍCIA',
      natureza: 'Privada sem fins lucrativos',
    },
    ...trocas,
  });

export const resumoIndisponivel = (): EducacaoResumo =>
  resumo({
    disponivel: false,
    faltando: ['inep_rendimento'],
    alfabetizacao: null,
    creche: null,
    procuraPorCreche: null,
    abandono: null,
    ideb: null,
    docentesSuperior: null,
    turmas: null,
    gasto: null,
    minimo: null,
    matriculas: null,
    alfabetizacaoDosMoradores: null,
    superior: null,
  });
