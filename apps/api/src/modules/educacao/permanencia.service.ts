// A aba Permanência: como termina o ano, por série, distorção idade-série e evasão, sempre rede com rede.
import type { ComparacaoDeEducacao, EducacaoPermanencia, FonteDoBloco } from '@orleans-em-dados/contracts';
import {
  CODIGO_DO_LUGAR,
  comparacaoPorRede,
  faltandoDe,
  fonteDoLote,
  lerDoIbge,
  linhasDaComparacao,
  lotesDeMaiorAno,
  NOME_DE_ORLEANS,
  somaDosPresentes,
  valoresDeEducacao,
  valoresDoIbge,
  type LinhaDeEducacao,
  type LinhaDoCsv,
  type LinhaDoIbge,
  type LoteDeEducacao,
} from './educacao.comum';

const RENDIMENTO = 'inep_rendimento';
const DISTORCAO = 'inep_distorcao';
const TRANSICAO = 'inep_transicao';
const REDE_ESCOLAR = 'ibge_rede_escolar';
const CONSULTAS = [RENDIMENTO, DISTORCAO, TRANSICAO, REDE_ESCOLAR];

const ETAPAS = ['anos_iniciais', 'anos_finais', 'medio'];
// A categoria é a da pesquisa 13, que escreve "1º série".
const SERIES = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    etapa: `ano_${n}`,
    categoria: `Matrículas > Ensino fundamental > ${n}º ano`,
  })),
  ...[1, 2, 3, 4].map((n) => ({ etapa: `serie_${n}`, categoria: `Matrículas > Ensino médio > ${n}º série` })),
];

type Leitura = { linhas: readonly LinhaDeEducacao[]; periodo: string; fonte: FonteDoBloco };

const comparar = ({ linhas, periodo, fonte }: Leitura, indicador: string, etapa: string): ComparacaoDeEducacao =>
  comparacaoPorRede(linhas, { indicador, etapa, periodo, unidade: '%', fonte });

function rendimento(leitura: Leitura): EducacaoPermanencia['rendimento'] {
  return {
    ano: leitura.periodo,
    fonte: leitura.fonte,
    etapas: ETAPAS.map((etapa) => ({
      etapa,
      aprovacao: comparar(leitura, 'aprovacao', etapa),
      reprovacao: comparar(leitura, 'reprovacao', etapa),
      abandono: comparar(leitura, 'abandono', etapa),
    })),
  };
}

// A matrícula é a do ano da taxa: outro ano daria uma conta com dois retratos.
function matriculasDaSerie(linhas: readonly LinhaDoIbge[], categoria: string, periodo: string) {
  const ler = (folha: string) =>
    lerDoIbge(linhas, {
      tabela: 'pesquisa-13',
      categoria: folha,
      periodo,
      localidade: CODIGO_DO_LUGAR.orleans,
    });
  const municipal = ler(`${categoria} > Municipal`);
  const estadual = ler(`${categoria} > Estadual`);
  return {
    publica: somaDosPresentes([municipal, estadual, ler(`${categoria} > Federal`)]),
    municipal,
    estadual,
    privada: ler(`${categoria} > Privado`),
    todas: ler(categoria),
  };
}

function series(
  leitura: Leitura,
  loteDaRede: LoteDeEducacao,
  doIbge: readonly LinhaDoIbge[],
): EducacaoPermanencia['series'] {
  return {
    ano: leitura.periodo,
    fonte: leitura.fonte,
    fonteDasMatriculas: fonteDoLote(loteDaRede, 'IBGE, sinopse do Censo Escolar (INEP)'),
    series: SERIES.map(({ etapa, categoria }) => ({
      etapa,
      reprovacao: comparar(leitura, 'reprovacao', etapa),
      abandono: comparar(leitura, 'abandono', etapa),
      matriculas: matriculasDaSerie(doIbge, categoria, leitura.periodo),
    })),
  };
}

const porEtapa = (leitura: Leitura, indicador: string) => ({
  ano: leitura.periodo,
  fonte: leitura.fonte,
  etapas: ETAPAS.map((etapa) => comparar(leitura, indicador, etapa)),
});

export async function permanencia(): Promise<EducacaoPermanencia> {
  const lotes = await lotesDeMaiorAno(CONSULTAS);
  const lote = (chave: string) => lotes.find((l) => l.chave === chave);
  const doRendimento = lote(RENDIMENTO);
  const daDistorcao = lote(DISTORCAO);
  const daTransicao = lote(TRANSICAO);
  const daRede = lote(REDE_ESCOLAR);

  const linhas = await valoresDeEducacao(lotes.filter((l) => l.chave !== REDE_ESCOLAR));
  const leituraDoRendimento = doRendimento && {
    linhas,
    periodo: String(doRendimento.ano),
    fonte: fonteDoLote(doRendimento, 'INEP, taxas de rendimento'),
  };
  const corpo = {
    rendimento: leituraDoRendimento ? rendimento(leituraDoRendimento) : null,
    series:
      leituraDoRendimento && daRede
        ? series(leituraDoRendimento, daRede, await valoresDoIbge([daRede], ['pesquisa-13']))
        : null,
    distorcao: daDistorcao
      ? porEtapa(
          { linhas, periodo: String(daDistorcao.ano), fonte: fonteDoLote(daDistorcao, 'INEP, distorção idade-série') },
          'distorcao',
        )
      : null,
    // O lote da transição leva o ano de chegada: 2022 é a passagem de 2021 para 2022.
    evasao: daTransicao
      ? porEtapa(
          {
            linhas,
            periodo: `${daTransicao.ano - 1}-${daTransicao.ano}`,
            fonte: fonteDoLote(daTransicao, 'INEP, taxas de transição'),
          },
          'evasao',
        )
      : null,
  };
  return {
    // A matrícula sozinha não diz nada sobre permanência: sem taxa, a aba não tem o que mostrar.
    disponivel: Object.values(corpo).some((bloco) => bloco !== null),
    faltando: faltandoDe(CONSULTAS, lotes),
    ...corpo,
  };
}

const linhasDasEtapas = (etapas: readonly ComparacaoDeEducacao[]) => etapas.flatMap((c) => linhasDaComparacao(c));

const REDES_DA_MATRICULA = ['publica', 'municipal', 'estadual', 'privada', 'todas'] as const;

function linhasDasSeries(bloco: NonNullable<EducacaoPermanencia['series']>): LinhaDoCsv[] {
  return bloco.series.flatMap(({ etapa, reprovacao, abandono, matriculas }) => [
    ...linhasDasEtapas([reprovacao, abandono]),
    ...REDES_DA_MATRICULA.map((rede) => ({
      indicador: 'matriculas',
      lugar: NOME_DE_ORLEANS,
      rede,
      etapa,
      ano: bloco.ano,
      valor: matriculas[rede],
      unidade: 'matriculas',
      fonte: bloco.fonteDasMatriculas.nome,
    })),
  ]);
}

/** O CSV da aba, em formato longo. "Cerca de N" é conta da tela: aqui ficam a taxa e a matrícula. */
export function linhasDaPermanencia({ rendimento: r, series: s, distorcao: d, evasao: e }: EducacaoPermanencia) {
  return [
    ...(r ? r.etapas.flatMap((c) => linhasDasEtapas([c.aprovacao, c.reprovacao, c.abandono])) : []),
    ...(s ? linhasDasSeries(s) : []),
    ...(d ? linhasDasEtapas(d.etapas) : []),
    ...(e ? linhasDasEtapas(e.etapas) : []),
  ];
}
