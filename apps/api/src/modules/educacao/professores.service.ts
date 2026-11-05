// A aba Professores e turmas: turmas, horas, formação, regularidade, alunos por docente, temporários e remuneração.
// Só agregados: SIOPE por `magisterio` e `outros`, INEP por lugar e rede. Nenhum dado por pessoa ou por escola.
import {
  grupoDeAdequacaoSchema,
  nivelDeRegularidadeSchema,
  type ComparacaoDeEducacao,
  type EducacaoProfessores,
  type FonteDoBloco,
} from '@orleans-em-dados/contracts';
import {
  CODIGO_DO_LUGAR,
  comparacaoPorRede,
  faltandoDe,
  fonteDoLote,
  lerDoIbge,
  linhasDaComparacao,
  lotesDeMaiorAno,
  lotesDeTodosOsAnos,
  NOME_DE_ORLEANS,
  NOME_DE_SC,
  valoresDeEducacao,
  valoresDoIbge,
  type LinhaDeEducacao,
  type LinhaDoCsv,
  type LinhaDoIbge,
  type LoteDeEducacao,
} from './educacao.comum';
import { financasDosLotes, type LinhaDeFinancas } from './professores.dao';

const TURMAS = 'inep_turmas';
const HORAS = 'inep_horas';
const ADEQUACAO = 'inep_adequacao';
const SUPERIOR = 'inep_docentes_superior';
const REGULARIDADE = 'inep_regularidade';
const REDE_ESCOLAR = 'ibge_rede_escolar';
const CARGA = 'siope_remuneracao_carga';
const REMUNERACAO = 'siope_remuneracao';
const RAIS = 'inep_remuneracao';
const CONSULTAS_DE_UM_LOTE = [TURMAS, HORAS, ADEQUACAO, SUPERIOR, REGULARIDADE, REDE_ESCOLAR, RAIS];
const CONSULTAS_POR_ANO = [CARGA, REMUNERACAO];

const ETAPAS_DA_TURMA = ['creche', 'pre_escola', 'anos_iniciais', 'anos_finais', 'medio'];
const ETAPAS_DA_FORMACAO = ['educacao_infantil', 'anos_iniciais', 'anos_finais', 'medio'];

// Como `calculados.json`: antes de 2018, a pesquisa 13 tem quedas que parecem recorte da fonte (ver o plano, fase 3).
const PRIMEIRO_ANO_DOS_DOCENTES = 2018;
const ETAPAS_DOS_DOCENTES = [
  { etapa: 'creche', folha: 'Ensino infantil > Creche > Municipal' },
  { etapa: 'pre_escola', folha: 'Ensino infantil > Pré-escolar > Municipal' },
];

const LUGARES_DA_RAIS = [
  { lugar: 'orleans', rede: 'municipal' },
  // SC não tem linha municipal no arquivo.
  { lugar: 'santaCatarina', rede: 'publica' },
  { lugar: 'brasil', rede: 'municipal' },
] as const;

function blocoDeComparacoes(
  lote: LoteDeEducacao,
  linhas: readonly LinhaDeEducacao[],
  etapas: readonly string[],
  indicador: string,
  unidade: ComparacaoDeEducacao['unidade'],
  nome: string,
) {
  const ano = String(lote.ano);
  const fonte = fonteDoLote(lote, nome);
  return {
    ano,
    fonte,
    comparacoes: etapas.map((etapa) => comparacaoPorRede(linhas, { indicador, etapa, periodo: ano, unidade, fonte })),
  };
}

function formacao(lote: LoteDeEducacao, linhas: readonly LinhaDeEducacao[]): EducacaoProfessores['formacao'] {
  const ano = String(lote.ano);
  const fonte = fonteDoLote(lote, 'INEP, adequação da formação docente: conta aulas');
  return {
    ano,
    fonte,
    etapas: ETAPAS_DA_FORMACAO.map((etapa) => ({
      etapa,
      grupos: grupoDeAdequacaoSchema.options.map((grupo) => ({
        grupo,
        comparacao: {
          ...comparacaoPorRede(linhas, {
            indicador: 'adequacao',
            etapa,
            recorte: grupo,
            periodo: ano,
            unidade: '%',
            fonte,
          }),
          indicador: `adequacao_${grupo}`,
        },
      })),
    })),
  };
}

function regularidade(lote: LoteDeEducacao, linhas: readonly LinhaDeEducacao[]): EducacaoProfessores['regularidade'] {
  const ano = String(lote.ano);
  const fonte = fonteDoLote(lote, 'INEP, regularidade do corpo docente: percentual de escolas');
  return {
    ano,
    fonte,
    niveis: nivelDeRegularidadeSchema.options.map((nivel) => ({
      nivel,
      comparacao: {
        ...comparacaoPorRede(linhas, {
          indicador: 'regularidade',
          etapa: '',
          recorte: nivel,
          periodo: ano,
          unidade: '%',
          fonte,
        }),
        indicador: `regularidade_${nivel}`,
      },
    })),
  };
}

/** Sem matrícula ou sem docente, sem conta. Uma casa, como a tela mostra. */
const razao = (matriculas: number | null, docentes: number | null) =>
  matriculas === null || !docentes ? null : Math.round((matriculas / docentes) * 10) / 10;

function alunosPorDocente(
  lote: LoteDeEducacao,
  linhas: readonly LinhaDoIbge[],
): EducacaoProfessores['alunosPorDocente'] {
  const anosDe = (categoria: string) =>
    linhas
      .filter(
        (l) =>
          l.categoria === categoria &&
          l.localidade === CODIGO_DO_LUGAR.orleans &&
          l.valor !== null &&
          Number(l.periodo) >= PRIMEIRO_ANO_DOS_DOCENTES,
      )
      .map((l) => l.periodo);
  const ler = (categoria: string, periodo: string) => lerDoIbge(linhas, { tabela: 'pesquisa-13', categoria, periodo });
  return {
    fonte: fonteDoLote(lote, 'IBGE, sinopse do Censo Escolar (INEP): matrículas ÷ docentes'),
    rede: 'municipal',
    etapas: ETAPAS_DOS_DOCENTES.map(({ etapa, folha }) => ({
      etapa,
      anos: [...new Set(anosDe(`Matrículas > ${folha}`))].sort().map((ano) => {
        const matriculas = ler(`Matrículas > ${folha}`, ano);
        const docentes = ler(`Docentes > ${folha}`, ano);
        return { ano, matriculas, docentes, alunosPorDocente: razao(matriculas, docentes) };
      }),
    })),
  };
}

const periodosDe = (linhas: readonly { periodo: string }[]) => [...new Set(linhas.map((l) => l.periodo))].sort();

function temporarios(
  lotes: readonly LoteDeEducacao[],
  linhas: readonly LinhaDeEducacao[],
): EducacaoProfessores['temporarios'] {
  const [lote] = lotes;
  if (!lote) return null;
  const daCarga = linhas.filter((l) => ['carga_temporaria', 'profissionais'].includes(l.indicador));
  const ler = (indicador: string, recorte: string, periodo: string) =>
    daCarga.find((l) => l.indicador === indicador && l.recorte === recorte && l.periodo === periodo);
  const doGrupo = (grupo: string, periodo: string) => {
    const pessoas = ler('profissionais', `${grupo}:todos`, periodo);
    return {
      cargaTemporaria: ler('carga_temporaria', `${grupo}:temporario`, periodo)?.valor ?? null,
      profissionais: pessoas?.valor ?? pessoas?.texto ?? null,
    };
  };
  return {
    fonte: fonteDoLote(lote, 'SIOPE, Remuneração: profissionais declarados pela Prefeitura'),
    anos: periodosDe(daCarga).map((periodo) => ({
      periodo,
      magisterio: doGrupo('magisterio', periodo),
      outros: doGrupo('outros', periodo),
    })),
  };
}

function remuneracao(
  lotes: readonly LoteDeEducacao[],
  linhas: readonly LinhaDeFinancas[],
): EducacaoProfessores['remuneracao'] {
  const [lote] = lotes;
  if (!lote) return null;
  const medianas = linhas.filter((l) => l.indicador === 'mediana_40h');
  const doGrupo = (grupo: string, periodo: string) => {
    const ler = (vinculo: string) =>
      medianas.find((l) => l.recorte === `${grupo}:${vinculo}` && l.periodo === periodo)?.valor ?? null;
    return { todos: ler('todos'), efetivo: ler('efetivo'), temporario: ler('temporario') };
  };
  return {
    fonte: fonteDoLote(lote, 'SIOPE, Remuneração: profissionais declarados pela Prefeitura'),
    anos: periodosDe(medianas).map((periodo) => ({
      periodo,
      magisterio: doGrupo('magisterio', periodo),
      outros: doGrupo('outros', periodo),
    })),
  };
}

function rais(lote: LoteDeEducacao, linhas: readonly LinhaDeFinancas[]): EducacaoProfessores['rais'] {
  const ano = String(lote.ano);
  return {
    ano,
    fonte: fonteDoLote(lote, 'INEP, remuneração dos docentes, a partir da RAIS'),
    linhas: LUGARES_DA_RAIS.map(({ lugar, rede }) => {
      const ler = (medida: string) =>
        linhas.find(
          (l) =>
            l.indicador === 'remuneracao_rais' &&
            l.lugar === CODIGO_DO_LUGAR[lugar] &&
            l.rede === rede &&
            l.recorte === `total:${medida}` &&
            l.periodo === ano,
        )?.valor ?? null;
      return { lugar, rede, mediaPor40h: ler('media_40h'), docentes: ler('docentes') };
    }),
  };
}

export async function professores(): Promise<EducacaoProfessores> {
  const deUmLote = await lotesDeMaiorAno(CONSULTAS_DE_UM_LOTE);
  const porAno = await lotesDeTodosOsAnos(CONSULTAS_POR_ANO);
  const lote = (chave: string) => deUmLote.find((l) => l.chave === chave);
  const lotesDe = (chave: string) => porAno.filter((l) => l.chave === chave);

  const [turmasLote, horasLote, adequacaoLote, superiorLote, regularidadeLote, redeLote, raisLote] =
    CONSULTAS_DE_UM_LOTE.map(lote);
  const linhas = await valoresDeEducacao([...deUmLote.filter((l) => l.chave !== REDE_ESCOLAR), ...porAno]);
  const financas = await financasDosLotes([...(raisLote ? [raisLote] : []), ...lotesDe(REMUNERACAO)]);

  const corpo = {
    turmas: turmasLote
      ? blocoDeComparacoes(
          turmasLote,
          linhas,
          ETAPAS_DA_TURMA,
          'alunos_por_turma',
          'alunos',
          'INEP, média de alunos por turma',
        )
      : null,
    horas: horasLote
      ? blocoDeComparacoes(
          horasLote,
          linhas,
          ETAPAS_DA_TURMA,
          'horas_aula',
          'horas',
          'INEP, média de horas-aula por dia',
        )
      : null,
    formacao: adequacaoLote ? formacao(adequacaoLote, linhas) : null,
    docentesSuperior: superiorLote
      ? blocoDeComparacoes(
          superiorLote,
          linhas,
          ETAPAS_DA_FORMACAO,
          'docentes_superior',
          '%',
          'INEP, docentes com curso superior: conta pessoas',
        )
      : null,
    regularidade: regularidadeLote ? regularidade(regularidadeLote, linhas) : null,
    alunosPorDocente: redeLote ? alunosPorDocente(redeLote, await valoresDoIbge([redeLote], ['pesquisa-13'])) : null,
    temporarios: temporarios(lotesDe(CARGA), linhas),
    remuneracao: remuneracao(lotesDe(REMUNERACAO), financas),
    rais: raisLote ? rais(raisLote, financas) : null,
  };
  return {
    disponivel: Object.values(corpo).some((bloco) => bloco !== null),
    faltando: faltandoDe([...CONSULTAS_DE_UM_LOTE, ...CONSULTAS_POR_ANO], [...deUmLote, ...porAno]),
    ...corpo,
  };
}

const emOrleans = (
  fonte: FonteDoBloco,
  ano: string,
  indicador: string,
  etapa: string,
  valor: number | string | null,
  unidade: string,
): LinhaDoCsv => ({
  indicador,
  lugar: NOME_DE_ORLEANS,
  rede: 'municipal',
  etapa,
  ano,
  valor,
  unidade,
  fonte: fonte.nome,
});

const NOME_DA_RAIS = { orleans: NOME_DE_ORLEANS, santaCatarina: NOME_DE_SC, brasil: 'Brasil' };

/** O CSV da aba, em formato longo. O grupo, o nível e o vínculo ficam no nome do indicador. */
export function linhasDoProfessores(resposta: EducacaoProfessores): LinhaDoCsv[] {
  const { turmas, horas, formacao: f, docentesSuperior, regularidade: r } = resposta;
  const { alunosPorDocente: d, temporarios: t, remuneracao: m, rais: a } = resposta;
  return [
    ...[turmas, horas, docentesSuperior].flatMap(
      (bloco) => bloco?.comparacoes.flatMap((c) => linhasDaComparacao(c)) ?? [],
    ),
    ...(f?.etapas.flatMap((e) => e.grupos.flatMap((g) => linhasDaComparacao(g.comparacao))) ?? []),
    ...(r?.niveis.flatMap((n) => linhasDaComparacao(n.comparacao)) ?? []),
    ...(d?.etapas.flatMap(({ etapa, anos }) =>
      anos.flatMap(({ ano, matriculas, docentes, alunosPorDocente: conta }) => [
        emOrleans(d.fonte, ano, 'alunos_por_docente', etapa, conta, 'alunos'),
        emOrleans(d.fonte, ano, 'matriculas', etapa, matriculas, 'matriculas'),
        emOrleans(d.fonte, ano, 'docentes', etapa, docentes, 'docentes'),
      ]),
    ) ?? []),
    ...(t?.anos.flatMap(({ periodo, magisterio, outros }) =>
      (
        [
          ['magisterio', magisterio],
          ['outros', outros],
        ] as const
      ).flatMap(([grupo, dados]) => [
        emOrleans(t.fonte, periodo, `carga_temporaria_${grupo}`, '', dados.cargaTemporaria, '%'),
        emOrleans(t.fonte, periodo, `profissionais_${grupo}`, '', dados.profissionais, 'pessoas'),
      ]),
    ) ?? []),
    ...(m?.anos.flatMap(({ periodo, magisterio, outros }) =>
      (
        [
          ['magisterio', magisterio],
          ['outros', outros],
        ] as const
      ).flatMap(([grupo, dados]) =>
        (['todos', 'efetivo', 'temporario'] as const).map((vinculo) =>
          emOrleans(m.fonte, periodo, `mediana_40h_${grupo}_${vinculo}`, '', dados[vinculo], 'reais'),
        ),
      ),
    ) ?? []),
    ...(a?.linhas.flatMap(({ lugar, rede, mediaPor40h, docentes }) =>
      [
        { indicador: 'remuneracao_rais_media_40h', valor: mediaPor40h, unidade: 'reais' },
        { indicador: 'remuneracao_rais_docentes', valor: docentes, unidade: 'pessoas' },
      ].map((medida) => ({ ...medida, lugar: NOME_DA_RAIS[lugar], rede, etapa: '', ano: a.ano, fonte: a.fonte.nome })),
    ) ?? []),
  ];
}
