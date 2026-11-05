// A aba Acesso: frequência por idade, matrículas por rede, quem estuda em outra cidade e o Retrato do MEC.
import type { EducacaoAcesso, NivelDeGestao } from '@orleans-em-dados/contracts';
import { matriculasPorRede } from './acesso.dao';
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
const REDE_ESCOLAR = 'ibge_rede_escolar';
const RETRATO = 'mec_retrato';
const CONSULTAS = [CENSO, COMPARACAO, REDE_ESCOLAR, RETRATO];

const ANO_DO_CENSO = '2022';
const ANO_ANTERIOR = '2010';
// As contas da aba têm uma casa: de 23,548 para 23,55 e daí para 23,6, seriam dois arredondamentos.
const UMA_CASA = 1;

// Lei 15.388/2026, publicada em 15/04/2026, com 10 anos de vigência: meta 1.a até o fim (2036), 1.c até o 2º ano
// (2028), 4.a até o 3º ano (2029). A 4.a é uma só, de 6 a 17 anos: a linha aparece nas duas faixas.
const META_DE_6_A_17 = {
  valor: 100,
  referencia: 'até 2029, para toda a faixa de 6 a 17 anos, no Plano Nacional de Educação',
};
const FAIXAS = [
  {
    faixa: '0 a 3 anos',
    em2010: ['0 a 3 anos'],
    meta: { valor: 60, referencia: 'até 2036, no Plano Nacional de Educação' },
  },
  {
    faixa: '4 a 5 anos',
    em2010: ['4 ou 5 anos'],
    meta: { valor: 100, referencia: 'até 2028, no Plano Nacional de Educação' },
  },
  { faixa: '6 a 14 anos', em2010: ['6 anos', '7 a 14 anos'], meta: META_DE_6_A_17 },
  { faixa: '15 a 17 anos', em2010: ['15 a 17 anos'], meta: META_DE_6_A_17 },
  { faixa: '18 a 24 anos', em2010: ['18 ou 19 anos', '20 a 24 anos'] },
];

function frequencia(lote: LoteDeEducacao, linhas: readonly LinhaDoIbge[]): EducacaoAcesso['frequencia'] {
  const fonte = fonteDoLote(lote, `IBGE, Censo ${ANO_DO_CENSO}`);
  // Censo 2010, tabela 1549: quem frequentava (364) ÷ população (93), somando as categorias da faixa.
  const somaEm2010 = (variavel: string, categorias: readonly string[], localidade: string) =>
    somaDosPresentes(
      categorias.map((categoria) =>
        lerDoIbge(linhas, { tabela: '1549', variavel, categoria, periodo: ANO_ANTERIOR, localidade }),
      ),
    );
  return {
    ano: ANO_DO_CENSO,
    anoAnterior: ANO_ANTERIOR,
    fonte,
    fonteAnterior: fonteDoLote(lote, `IBGE, Censo ${ANO_ANTERIOR}: quem frequentava ÷ população`),
    faixas: FAIXAS.map(({ faixa, em2010, meta }) => ({
      faixa,
      comparacao: comparacaoDosLugares(
        porLugar((localidade) =>
          lerDoIbge(linhas, { tabela: '10056', variavel: '3795', categoria: faixa, periodo: ANO_DO_CENSO, localidade }),
        ),
        {
          indicador: 'frequencia_escolar',
          etapa: faixa,
          ano: ANO_DO_CENSO,
          unidade: '%',
          fonte,
          ...(meta ? { meta } : {}),
        },
      ),
      noAnoAnterior: porLugar((lugar) =>
        emPercentual(somaEm2010('364', em2010, lugar), somaEm2010('93', em2010, lugar), UMA_CASA),
      ),
    })),
  };
}

function outroMunicipio(lote: LoteDeEducacao, linhas: readonly LinhaDoIbge[]): EducacaoAcesso['outroMunicipio'] {
  const pessoas = (localidade: string, categoria = '') =>
    lerDoIbge(linhas, { tabela: '10324', variavel: '2021', categoria, periodo: ANO_DO_CENSO, localidade });
  return {
    ano: ANO_DO_CENSO,
    fonte: fonteDoLote(lote, `IBGE, Censo ${ANO_DO_CENSO}`),
    // O total da tabela é o divisor: em SC e no Brasil, ele passa um pouco da soma dos locais (ver ibge.md).
    comparacao: comparacaoDosLugares(
      porLugar((lugar) => emPercentual(pessoas(lugar, 'Outro município'), pessoas(lugar), UMA_CASA)),
      {
        indicador: 'estudam_em_outro_municipio',
        etapa: '',
        ano: ANO_DO_CENSO,
        unidade: '%',
        fonte: fonteDoLote(lote, `IBGE, Censo ${ANO_DO_CENSO}`),
      },
    ),
    estudantes: pessoas(CODIGO_DO_LUGAR.orleans),
    emOutroMunicipio: pessoas(CODIGO_DO_LUGAR.orleans, 'Outro município'),
  };
}

const ETAPAS_DA_MATRICULA = [
  { etapa: 'creche', categoria: 'Matrículas > Ensino infantil > Creche', folha: 'Creche' },
  { etapa: 'pre_escola', categoria: 'Matrículas > Ensino infantil > Pré-escolar', folha: 'Pré-escolar' },
  { etapa: 'fundamental', categoria: 'Matrículas > Ensino fundamental', folha: 'Ensino fundamental' },
  { etapa: 'medio', categoria: 'Matrículas > Ensino médio', folha: 'Ensino médio' },
];
const ETAPAS_DA_REDE_ESCOLAR = [
  { etapa: 'educacao_infantil', nome: 'Ensino infantil' },
  { etapa: 'fundamental', nome: 'Ensino fundamental' },
  { etapa: 'medio', nome: 'Ensino médio' },
];

async function matriculas(lote: LoteDeEducacao, linhas: readonly LinhaDoIbge[]): Promise<EducacaoAcesso['matriculas']> {
  const anos = linhas
    .filter(
      (l) =>
        l.categoria === 'Matrículas > Ensino fundamental' &&
        l.localidade === CODIGO_DO_LUGAR.orleans &&
        l.valor !== null,
    )
    .map((l) => l.periodo)
    .sort();
  const ano = anos.at(-1);
  if (!ano) return null;

  const lerPesquisa = (categoria: string) => lerDoIbge(linhas, { tabela: 'pesquisa-13', categoria, periodo: ano });
  const porRede = await matriculasPorRede(lote.coletaId, CODIGO_DO_LUGAR.orleans, ano);
  const naFolha = (folha: string, rede: string) =>
    porRede.find((l) => l.etapa === folha && l.rede === rede)?.valor ?? null;
  const etapas = ETAPAS_DA_MATRICULA.map(({ etapa, categoria, folha }) => ({
    etapa,
    total: lerPesquisa(categoria),
    municipal: naFolha(folha, 'Municipal'),
    estadual: naFolha(folha, 'Estadual'),
    federal: naFolha(folha, 'Federal'),
    privada: naFolha(folha, 'Privado'),
  }));
  return {
    ano,
    fonte: fonteDoLote(lote, 'IBGE, sinopse do Censo Escolar (INEP)'),
    total: somaDosPresentes(etapas.map((e) => e.total)),
    etapas,
    escolasEDocentes: ETAPAS_DA_REDE_ESCOLAR.map(({ etapa, nome }) => ({
      etapa,
      escolas: lerPesquisa(`Escolas > ${nome}`),
      docentes: lerPesquisa(`Docentes > ${nome}`),
    })),
  };
}

const NIVEIS: readonly NivelDeGestao[] = ['inicial', 'elementar', 'basico', 'avancado'];
const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function retrato(lote: LoteDeEducacao, linhas: readonly LinhaDeEducacao[]): EducacaoAcesso['retrato'] {
  const deOrleans = (chave: string) =>
    linhas.find((l) => l.indicador === `retrato_${chave}` && l.lugar === CODIGO_DO_LUGAR.orleans);
  const resposta = (chave: string) => deOrleans(chave)?.texto ?? null;
  const nivel = semAcento(resposta('nivel_de_gestao_da_demanda') ?? '');
  return {
    ano: String(lote.ano),
    fonte: fonteDoLote(lote, 'MEC, Retrato da Educação Infantil: a Prefeitura informou ao MEC'),
    solicitacoesNaoAtendidas: resposta('solicitacoes_nao_atendidas_creche'),
    quantidadeNaLista: deOrleans('quantidade_na_lista_de_espera')?.valor ?? null,
    listaUnificada: resposta('lista_unificada'),
    listasDivulgadas: resposta('listas_divulgadas_ao_publico'),
    criteriosDePrioridade: resposta('criterios_de_prioridade'),
    idadeInicial: resposta('idade_inicial_creche'),
    foraDaPreEscola: resposta('criancas_fora_da_pre_escola_por_falta_de_vaga'),
    nivelDeOrleans: NIVEIS.find((n) => nivel.startsWith(n)) ?? null,
    distribuicaoEmSc: NIVEIS.map((n) => ({
      nivel: n,
      municipios:
        linhas.find(
          (l) => l.indicador === 'retrato_distribuicao' && l.lugar === CODIGO_DO_LUGAR.santaCatarina && l.recorte === n,
        )?.valor ?? null,
    })),
  };
}

const TABELAS_DO_CENSO = ['10056', '1549', '10324'];

export async function acesso(): Promise<EducacaoAcesso> {
  const lotes = await lotesDeMaiorAno(CONSULTAS);
  const lote = (chave: string) => lotes.find((l) => l.chave === chave);
  const censo = lote(CENSO);
  const redeEscolar = lote(REDE_ESCOLAR);
  const doRetrato = lote(RETRATO);

  // Sem a comparação, Orleans segue, com SC e o Brasil nulos.
  const doCenso = censo
    ? await valoresDoIbge(
        lotes.filter((l) => [CENSO, COMPARACAO].includes(l.chave)),
        TABELAS_DO_CENSO,
      )
    : [];
  const corpo = {
    frequencia: censo ? frequencia(censo, doCenso) : null,
    matriculas: redeEscolar ? await matriculas(redeEscolar, await valoresDoIbge([redeEscolar], ['pesquisa-13'])) : null,
    outroMunicipio: censo ? outroMunicipio(censo, doCenso) : null,
    retrato: doRetrato ? retrato(doRetrato, await valoresDeEducacao([doRetrato])) : null,
  };
  return {
    disponivel: Object.values(corpo).some((bloco) => bloco !== null),
    faltando: faltandoDe(CONSULTAS, lotes),
    ...corpo,
  };
}

function linhasDaFrequencia(bloco: NonNullable<EducacaoAcesso['frequencia']>): LinhaDoCsv[] {
  return bloco.faixas.flatMap(({ faixa, comparacao, noAnoAnterior }) => [
    ...linhasDaComparacao(comparacao),
    ...linhasDaComparacao({
      ...comparacao,
      ano: bloco.anoAnterior,
      fonte: bloco.fonteAnterior,
      etapa: faixa,
      porRede: { todas: noAnoAnterior },
    }),
  ]);
}

function linhasDasMatriculas(bloco: NonNullable<EducacaoAcesso['matriculas']>): LinhaDoCsv[] {
  const emOrleans = (indicador: string, rede: string, etapa: string, valor: number | null, unidade: string) => ({
    indicador,
    lugar: NOME_DE_ORLEANS,
    rede,
    etapa,
    ano: bloco.ano,
    valor,
    unidade,
    fonte: bloco.fonte.nome,
  });
  return [
    ...bloco.etapas.flatMap(({ etapa, total, municipal, estadual, federal, privada }) => [
      emOrleans('matriculas', 'municipal', etapa, municipal, 'matriculas'),
      emOrleans('matriculas', 'estadual', etapa, estadual, 'matriculas'),
      emOrleans('matriculas', 'federal', etapa, federal, 'matriculas'),
      emOrleans('matriculas', 'privada', etapa, privada, 'matriculas'),
      emOrleans('matriculas', 'todas', etapa, total, 'matriculas'),
    ]),
    ...bloco.escolasEDocentes.flatMap(({ etapa, escolas, docentes }) => [
      emOrleans('escolas', 'todas', etapa, escolas, 'escolas'),
      emOrleans('docentes', 'todas', etapa, docentes, 'docentes'),
    ]),
  ];
}

function linhasDoRetrato(bloco: NonNullable<EducacaoAcesso['retrato']>): LinhaDoCsv[] {
  const linha = (indicador: string, lugar: string, valor: number | string | null, unidade: string) => ({
    indicador,
    lugar,
    rede: 'municipal',
    etapa: '',
    ano: bloco.ano,
    valor,
    unidade,
    fonte: bloco.fonte.nome,
  });
  const resposta = (indicador: string, texto: string | null) => linha(indicador, NOME_DE_ORLEANS, texto, 'texto');
  return [
    resposta('retrato_solicitacoes_nao_atendidas_creche', bloco.solicitacoesNaoAtendidas),
    linha('retrato_quantidade_na_lista_de_espera', NOME_DE_ORLEANS, bloco.quantidadeNaLista, 'criancas'),
    resposta('retrato_lista_unificada', bloco.listaUnificada),
    resposta('retrato_listas_divulgadas_ao_publico', bloco.listasDivulgadas),
    resposta('retrato_criterios_de_prioridade', bloco.criteriosDePrioridade),
    resposta('retrato_idade_inicial_creche', bloco.idadeInicial),
    resposta('retrato_criancas_fora_da_pre_escola_por_falta_de_vaga', bloco.foraDaPreEscola),
    resposta('retrato_nivel_de_gestao_da_demanda', bloco.nivelDeOrleans),
    ...bloco.distribuicaoEmSc.map(({ nivel, municipios }) =>
      linha(`retrato_distribuicao_${nivel}`, NOME_DE_SC, municipios, 'municipios'),
    ),
  ];
}

/** O CSV da aba, em formato longo. */
export function linhasDoAcesso({ frequencia: f, matriculas: m, outroMunicipio: o, retrato: r }: EducacaoAcesso) {
  return [
    ...(f ? linhasDaFrequencia(f) : []),
    ...(m ? linhasDasMatriculas(m) : []),
    ...(o
      ? [
          ...linhasDaComparacao(o.comparacao),
          ...[
            ['estudantes_moradores', o.estudantes],
            ['estudantes_em_outro_municipio', o.emOutroMunicipio],
          ].map(([indicador, valor]) => ({
            indicador: indicador as string,
            lugar: NOME_DE_ORLEANS,
            rede: 'todas',
            etapa: '',
            ano: o.ano,
            valor: valor as number | null,
            unidade: 'pessoas',
            fonte: o.fonte.nome,
          })),
        ]
      : []),
    ...(r ? linhasDoRetrato(r) : []),
  ];
}
