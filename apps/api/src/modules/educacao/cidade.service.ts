// A aba Cidade e ensino superior: escolaridade dos moradores (Censo 2022) e oferta de faculdade na cidade (INEP 2024).
// Os dois assuntos dividem a aba e nada mais: nenhuma conta junta moradores e oferta.
import type { ComparacaoDeEducacao, EducacaoCidade, NivelDeInstrucao } from '@orleans-em-dados/contracts';
import {
  CODIGO_DO_LUGAR,
  comparacaoDosLugares,
  emPercentual,
  faltandoDe,
  fonteDoLote,
  lerDoIbge,
  linhasDaComparacao,
  lotesDeMaiorAno,
  NOME_DE_ORLEANS,
  NOME_DE_SC,
  porLugar,
  somaDosPresentes,
  valoresDeEducacao,
  valoresDoIbge,
  type LinhaDeEducacao,
  type LinhaDoCsv,
  type LinhaDoIbge,
  type LoteDeEducacao,
} from './educacao.comum';

const CENSO = 'ibge_educacao_censo';
const COMPARACAO = 'ibge_educacao_comparacao';
const SUPERIOR = 'inep_superior';
const CONSULTAS = [CENSO, COMPARACAO, SUPERIOR];

const TABELAS_DO_CENSO = ['10091', '10092', '10061', '10062', '10324'];
const ANO_DO_CENSO = '2022';
const UMA_CASA = 1;
const POS_GRADUACAO = 'Especialização de nível superior, mestrado ou doutorado';

const GRUPOS_DA_ALFABETIZACAO = ['Homens', 'Mulheres', 'Urbana', 'Rural'];
const IDADES_DA_ALFABETIZACAO = [
  '15 a 17 anos',
  '18 e 19 anos',
  '20 a 24 anos',
  '25 a 34 anos',
  '35 a 44 anos',
  '45 a 54 anos',
  '55 a 64 anos',
  '65 anos ou mais',
  '75 anos ou mais',
];

function alfabetizacao(lote: LoteDeEducacao, linhas: readonly LinhaDoIbge[]): EducacaoCidade['alfabetizacao'] {
  const fonte = fonteDoLote(lote, `IBGE, Censo ${ANO_DO_CENSO}`);
  const comparacao = (categoria: string, etapa: string) =>
    comparacaoDosLugares(
      porLugar((localidade) =>
        lerDoIbge(linhas, { tabela: '10091', variavel: '2513', categoria, periodo: ANO_DO_CENSO, localidade }),
      ),
      { indicador: 'alfabetizacao', etapa, ano: ANO_DO_CENSO, unidade: '%', fonte },
    );
  const grupo = (nome: string) => ({ grupo: nome, comparacao: comparacao(nome, nome) });
  return {
    ano: ANO_DO_CENSO,
    fonte,
    total: comparacao('', '15 anos ou mais'),
    naoAlfabetizados: lerDoIbge(linhas, {
      tabela: '10092',
      variavel: '950',
      categoria: 'Não alfabetizadas',
      periodo: ANO_DO_CENSO,
    }),
    porGrupo: GRUPOS_DA_ALFABETIZACAO.map(grupo),
    porIdade: IDADES_DA_ALFABETIZACAO.map(grupo),
  };
}

// Só a variável 2667, em pessoas: a 1002667 da mesma tabela divide por todos os de 18 anos ou mais (ver ibge.md).
const CATEGORIAS_DO_NIVEL: Record<NivelDeInstrucao, readonly string[]> = {
  medio_ou_mais: ['Médio completo e superior incompleto|25 anos ou mais', 'Superior completo|25 anos ou mais'],
  superior: ['Superior completo|25 anos ou mais'],
  sem_instrucao: ['Sem instrução e fundamental incompleto|25 anos ou mais'],
};
const NIVEIS = Object.keys(CATEGORIAS_DO_NIVEL) as NivelDeInstrucao[];
const TOTAL_DA_INSTRUCAO = '25 anos ou mais';

function escolaridade(lote: LoteDeEducacao, linhas: readonly LinhaDoIbge[]): EducacaoCidade['escolaridade'] {
  const fonte = fonteDoLote(lote, `IBGE, Censo ${ANO_DO_CENSO}`);
  const pessoas = (categoria: string, localidade: string) =>
    lerDoIbge(linhas, { tabela: '10061', variavel: '2667', categoria, periodo: ANO_DO_CENSO, localidade });
  return {
    ano: ANO_DO_CENSO,
    fonte,
    anosDeEstudo: ['25 anos ou mais', '18 a 24 anos'].map((grupo) => ({
      grupo,
      comparacao: comparacaoDosLugares(
        porLugar((localidade) =>
          lerDoIbge(linhas, {
            tabela: '10062',
            variavel: '13285',
            categoria: grupo,
            periodo: ANO_DO_CENSO,
            localidade,
          }),
        ),
        { indicador: 'anos_de_estudo', etapa: grupo, ano: ANO_DO_CENSO, unidade: 'anos', fonte },
      ),
    })),
    pessoasDe25AnosOuMais: pessoas(TOTAL_DA_INSTRUCAO, CODIGO_DO_LUGAR.orleans),
    niveis: NIVEIS.map((nivel) => ({
      nivel,
      comparacao: comparacaoDosLugares(
        porLugar((lugar) => {
          const partes = CATEGORIAS_DO_NIVEL[nivel].map((categoria) => pessoas(categoria, lugar));
          // Uma parte sem número (`X`) deixaria o percentual menor do que é: sem ela, sem conta.
          const soma = partes.includes(null) ? null : somaDosPresentes(partes);
          return emPercentual(soma, pessoas(TOTAL_DA_INSTRUCAO, lugar), UMA_CASA);
        }),
        { indicador: `instrucao_${nivel}`, etapa: '', ano: ANO_DO_CENSO, unidade: '%', fonte },
      ),
    })),
  };
}

function moradores(lote: LoteDeEducacao, linhas: readonly LinhaDoIbge[]): EducacaoCidade['moradores'] {
  const fonte = fonteDoLote(lote, `IBGE, Censo ${ANO_DO_CENSO}`);
  const pessoas = (categoria: string, localidade: string = CODIGO_DO_LUGAR.orleans) =>
    lerDoIbge(linhas, { tabela: '10324', variavel: '2021', categoria, periodo: ANO_DO_CENSO, localidade });
  return {
    ano: ANO_DO_CENSO,
    fonte,
    graduacao: pessoas('Superior de graduação'),
    emOrleans: pessoas('Município de residência|Superior de graduação'),
    emOutroMunicipio: pessoas('Outro município|Superior de graduação'),
    noExterior: pessoas('País estrangeiro|Superior de graduação'),
    posGraduacao: pessoas(POS_GRADUACAO),
    posEmOutroMunicipio: pessoas(`Outro município|${POS_GRADUACAO}`),
    // O total da tabela é o divisor: em SC e no Brasil, ele passa um pouco da soma dos locais (ver ibge.md).
    foraDoMunicipio: comparacaoDosLugares(
      porLugar((lugar) =>
        emPercentual(
          pessoas('Outro município|Superior de graduação', lugar),
          pessoas('Superior de graduação', lugar),
          UMA_CASA,
        ),
      ),
      { indicador: 'graduacao_em_outro_municipio', etapa: '', ano: ANO_DO_CENSO, unidade: '%', fonte },
    ),
  };
}

const linhaDe = (
  linhas: readonly LinhaDeEducacao[],
  indicador: string,
  recorte = '',
  lugar = CODIGO_DO_LUGAR.orleans,
) => linhas.find((l) => l.indicador === indicador && l.recorte === recorte && l.lugar === lugar);

const MENOS_DE_5 = 'menos de 5';

/** Pessoas de 1 a 4 só existem como o texto `menos de 5`, gravado pelo extrator. */
function pessoasDe(linha: LinhaDeEducacao | undefined): number | typeof MENOS_DE_5 | null {
  if (!linha) return null;
  if (linha.valor !== null) return linha.valor;
  return linha.texto === MENOS_DE_5 ? MENOS_DE_5 : null;
}

// A lista fecha o que sai: cor ou raça e deficiência não aparecem, mesmo que venham no lote.
const RECORTES_DO_PERFIL = ['noturno', 'escola_publica', 'de_18_a_24', 'mulheres', 'prouni', 'fies'] as const;

function oferta(lote: LoteDeEducacao, linhas: readonly LinhaDeEducacao[]): EducacaoCidade['oferta'] {
  const numero = (indicador: string, recorte = '') => linhaDe(linhas, indicador, recorte)?.valor ?? null;
  const matriculas = numero('superior_matriculas');
  return {
    ano: String(lote.ano),
    fonte: fonteDoLote(lote, 'INEP, Censo da Educação Superior'),
    instituicao: linhaDe(linhas, 'superior_instituicao')?.texto ?? null,
    natureza: linhaDe(linhas, 'superior_natureza')?.texto ?? null,
    cursos: numero('superior_cursos'),
    vagas: numero('superior_vagas'),
    inscritos: numero('superior_inscritos'),
    ingressantes: numero('superior_ingressantes'),
    matriculas,
    concluintes: numero('superior_concluintes'),
    perfil: RECORTES_DO_PERFIL.map((recorte) => {
      const pessoas = pessoasDe(linhaDe(linhas, 'superior_perfil', recorte));
      return {
        recorte,
        pessoas,
        percentual: typeof pessoas === 'number' ? emPercentual(pessoas, matriculas, UMA_CASA) : null,
      };
    }),
    ead: {
      instituicoes: numero('superior_ead_instituicoes'),
      matriculas: pessoasDe(linhaDe(linhas, 'superior_ead_matriculas')),
      ingressantes: pessoasDe(linhaDe(linhas, 'superior_ead_ingressantes')),
    },
    docentes: {
      total: numero('superior_docentes'),
      doutores: numero('superior_docentes', 'doutores'),
      mestres: numero('superior_docentes', 'mestres'),
      especialistas: numero('superior_docentes', 'especialistas'),
      tempoIntegral: numero('superior_docentes', 'tempo_integral'),
    },
    tecnicos: numero('superior_tecnicos'),
  };
}

const PREFIXO_DA_FAIXA = 'faixa_';

function igc(lote: LoteDeEducacao, linhas: readonly LinhaDeEducacao[]): EducacaoCidade['igc'] {
  const faixa = linhaDe(linhas, 'superior_igc_faixa');
  const continuo = linhaDe(linhas, 'superior_igc_continuo');
  const referencia = faixa ?? continuo;
  if (!referencia) return null;
  const distribuicaoEmSc = linhas.flatMap((l) =>
    l.indicador === 'superior_igc_distribuicao' && l.lugar === CODIGO_DO_LUGAR.santaCatarina && l.valor !== null
      ? [{ faixa: Number(l.recorte.slice(PREFIXO_DA_FAIXA.length)), instituicoes: l.valor }]
      : [],
  );
  return {
    ano: referencia.periodo,
    fonte: fonteDoLote(lote, 'INEP, IGC'),
    continuo: continuo?.valor ?? null,
    faixa: faixa?.valor ?? null,
    distribuicaoEmSc: distribuicaoEmSc.sort((a, b) => a.faixa - b.faixa),
    instituicoesEmSc: somaDosPresentes(distribuicaoEmSc.map((d) => d.instituicoes)),
  };
}

const PREFIXO_DO_CURSO = 'superior_curso_';

// Número antes de `menos de 5`, e, entre os números, da maior matrícula para a menor.
const pesoDaMatricula = (matriculas: number | string | null) => (typeof matriculas === 'number' ? matriculas : -1);

function cursos(lote: LoteDeEducacao, linhas: readonly LinhaDeEducacao[]): EducacaoCidade['cursos'] {
  const nomes = [...new Set(linhas.filter((l) => l.indicador.startsWith(PREFIXO_DO_CURSO)).map((l) => l.recorte))];
  const campo = (medida: string, curso: string) => linhaDe(linhas, `${PREFIXO_DO_CURSO}${medida}`, curso);
  return {
    ano: String(lote.ano),
    fonte: fonteDoLote(lote, 'INEP, Censo da Educação Superior'),
    lista: nomes
      .map((curso) => ({
        curso,
        vagas: campo('vagas', curso)?.valor ?? null,
        ingressantes: pessoasDe(campo('ingressantes', curso)),
        matriculas: pessoasDe(campo('matriculas', curso)),
        concluintes: pessoasDe(campo('concluintes', curso)),
        mulheres: pessoasDe(campo('mulheres', curso)),
        noturno: pessoasDe(campo('noturno', curso)),
      }))
      .sort(
        (a, b) =>
          pesoDaMatricula(b.matriculas) - pesoDaMatricula(a.matriculas) || a.curso.localeCompare(b.curso, 'pt-BR'),
      ),
  };
}

export async function cidade(): Promise<EducacaoCidade> {
  const lotes = await lotesDeMaiorAno(CONSULTAS);
  const lote = (chave: string) => lotes.find((l) => l.chave === chave);
  const censo = lote(CENSO);
  const superior = lote(SUPERIOR);

  // Sem a comparação, Orleans segue, com SC e o Brasil nulos.
  const doCenso = censo
    ? await valoresDoIbge(
        lotes.filter((l) => [CENSO, COMPARACAO].includes(l.chave)),
        TABELAS_DO_CENSO,
      )
    : [];
  const doSuperior = superior ? await valoresDeEducacao([superior]) : [];
  const corpo = {
    alfabetizacao: censo ? alfabetizacao(censo, doCenso) : null,
    escolaridade: censo ? escolaridade(censo, doCenso) : null,
    moradores: censo ? moradores(censo, doCenso) : null,
    oferta: superior ? oferta(superior, doSuperior) : null,
    igc: superior ? igc(superior, doSuperior) : null,
    cursos: superior ? cursos(superior, doSuperior) : null,
  };
  return {
    disponivel: Object.values(corpo).some((bloco) => bloco !== null),
    faltando: faltandoDe(CONSULTAS, lotes),
    ...corpo,
  };
}

const naLinha = (
  indicador: string,
  valor: number | string | null,
  unidade: string,
  { ano, fonte }: { ano: string; fonte: { nome: string } },
  { etapa = '', lugar = NOME_DE_ORLEANS }: { etapa?: string; lugar?: string } = {},
): LinhaDoCsv => ({ indicador, lugar, rede: 'todas', etapa, ano, valor, unidade, fonte: fonte.nome });

const daComparacao = (comparacoes: readonly ComparacaoDeEducacao[]) =>
  comparacoes.flatMap((comparacao) => linhasDaComparacao(comparacao));

function linhasDosMoradores(m: NonNullable<EducacaoCidade['moradores']>): LinhaDoCsv[] {
  return [
    ...linhasDaComparacao(m.foraDoMunicipio),
    naLinha('moradores_graduacao', m.graduacao, 'pessoas', m),
    naLinha('moradores_graduacao_em_orleans', m.emOrleans, 'pessoas', m),
    naLinha('moradores_graduacao_em_outro_municipio', m.emOutroMunicipio, 'pessoas', m),
    naLinha('moradores_graduacao_no_exterior', m.noExterior, 'pessoas', m),
    naLinha('moradores_pos_graduacao', m.posGraduacao, 'pessoas', m),
    naLinha('moradores_pos_graduacao_em_outro_municipio', m.posEmOutroMunicipio, 'pessoas', m),
  ];
}

function linhasDaOferta(o: NonNullable<EducacaoCidade['oferta']>): LinhaDoCsv[] {
  const { ead, docentes } = o;
  return [
    naLinha('superior_instituicao', o.instituicao, 'texto', o),
    naLinha('superior_natureza', o.natureza, 'texto', o),
    naLinha('superior_cursos', o.cursos, 'cursos', o),
    naLinha('superior_vagas', o.vagas, 'vagas', o),
    naLinha('superior_inscritos', o.inscritos, 'pessoas', o),
    naLinha('superior_ingressantes', o.ingressantes, 'pessoas', o),
    naLinha('superior_matriculas', o.matriculas, 'pessoas', o),
    naLinha('superior_concluintes', o.concluintes, 'pessoas', o),
    ...o.perfil.flatMap(({ recorte, pessoas, percentual }) => [
      naLinha(`superior_perfil_${recorte}`, pessoas, 'pessoas', o),
      naLinha(`superior_perfil_${recorte}`, percentual, '%', o),
    ]),
    naLinha('superior_ead_instituicoes', ead.instituicoes, 'instituicoes', o),
    naLinha('superior_ead_matriculas', ead.matriculas, 'pessoas', o),
    naLinha('superior_ead_ingressantes', ead.ingressantes, 'pessoas', o),
    naLinha('superior_docentes', docentes.total, 'pessoas', o),
    naLinha('superior_docentes_doutores', docentes.doutores, 'pessoas', o),
    naLinha('superior_docentes_mestres', docentes.mestres, 'pessoas', o),
    naLinha('superior_docentes_especialistas', docentes.especialistas, 'pessoas', o),
    naLinha('superior_docentes_tempo_integral', docentes.tempoIntegral, 'pessoas', o),
    naLinha('superior_tecnicos', o.tecnicos, 'pessoas', o),
  ];
}

const linhasDoIgc = (i: NonNullable<EducacaoCidade['igc']>): LinhaDoCsv[] => [
  naLinha('superior_igc_continuo', i.continuo, 'indice', i),
  naLinha('superior_igc_faixa', i.faixa, 'indice', i),
  ...i.distribuicaoEmSc.map(({ faixa, instituicoes }) =>
    naLinha('superior_igc_distribuicao', instituicoes, 'instituicoes', i, {
      etapa: `${PREFIXO_DA_FAIXA}${faixa}`,
      lugar: NOME_DE_SC,
    }),
  ),
];

const linhasDosCursos = (c: NonNullable<EducacaoCidade['cursos']>): LinhaDoCsv[] =>
  c.lista.flatMap(({ curso, vagas, ingressantes, matriculas, concluintes, mulheres, noturno }) => {
    const doCurso = (medida: string, valor: number | string | null, unidade = 'pessoas') =>
      naLinha(`${PREFIXO_DO_CURSO}${medida}`, valor, unidade, c, { etapa: curso });
    return [
      doCurso('vagas', vagas, 'vagas'),
      doCurso('ingressantes', ingressantes),
      doCurso('matriculas', matriculas),
      doCurso('concluintes', concluintes),
      doCurso('mulheres', mulheres),
      doCurso('noturno', noturno),
    ];
  });

/** O CSV da aba, em formato longo. */
export function linhasDaCidade({
  alfabetizacao: a,
  escolaridade: e,
  moradores: m,
  oferta: o,
  igc: i,
  cursos: c,
}: EducacaoCidade) {
  return [
    ...(a
      ? [
          ...daComparacao([a.total, ...[...a.porGrupo, ...a.porIdade].map((g) => g.comparacao)]),
          naLinha('nao_alfabetizados', a.naoAlfabetizados, 'pessoas', a, { etapa: '15 anos ou mais' }),
        ]
      : []),
    ...(e
      ? [
          ...daComparacao([...e.anosDeEstudo, ...e.niveis].map((g) => g.comparacao)),
          naLinha('pessoas_de_25_anos_ou_mais', e.pessoasDe25AnosOuMais, 'pessoas', e),
        ]
      : []),
    ...(m ? linhasDosMoradores(m) : []),
    ...(o ? linhasDaOferta(o) : []),
    ...(i ? linhasDoIgc(i) : []),
    ...(c ? linhasDosCursos(c) : []),
  ];
}
