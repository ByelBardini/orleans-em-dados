// A aba Aprendizado: alfabetização, IDEB, nível socioeconômico e ENEM, por rede.
import type { ComparacaoDeEducacao, EducacaoAprendizado, Rede, ValoresDaRede } from '@orleans-em-dados/contracts';
import { redeSchema } from '@orleans-em-dados/contracts';
import {
  CODIGO_DO_LUGAR,
  comparacaoPorRede,
  emPercentual,
  faltandoDe,
  fonteDoLote,
  lerDoIbge,
  linhasDaComparacao,
  lotesDeMaiorAno,
  lotesDeTodosOsAnos,
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

const ALFABETIZACAO = 'inep_alfabetizacao';
const REDE_ESCOLAR = 'ibge_rede_escolar';
const ARQUIVO_DO_IDEB = 'inep_ideb';
const INSE = 'inep_inse';
const ENEM = 'inep_enem';
const CONSULTAS = [ALFABETIZACAO, REDE_ESCOLAR, ARQUIVO_DO_IDEB, INSE, ENEM];

const FONTE_DA_ALFABETIZACAO = 'INEP, Indicador Criança Alfabetizada';
const FONTE_DO_IDEB = 'IBGE, pesquisa 40 (IDEB do INEP)';
const FONTE_DO_ARQUIVO = 'INEP, arquivo do IDEB';
const FONTE_DO_INSE = 'INEP, Indicador de Nível Socioeconômico';
const FONTE_DO_ENEM = 'INEP, microdados do ENEM';
const FONTE_DA_TERCEIRA_SERIE = 'IBGE, sinopse do Censo Escolar (INEP)';

const UMA_CASA = 1;
const LUGARES = ['orleans', 'santaCatarina', 'brasil'] as const;
type Lugar = (typeof LUGARES)[number];
const NOME_DO_LUGAR: Record<Lugar, string> = { orleans: NOME_DE_ORLEANS, santaCatarina: NOME_DE_SC, brasil: 'Brasil' };

const anosEmOrdem = (linhas: readonly { periodo: string }[]) => [...new Set(linhas.map((l) => l.periodo))].sort();

function alfabetizacao(lote: LoteDeEducacao, linhas: readonly LinhaDeEducacao[]): EducacaoAprendizado['alfabetizacao'] {
  const doIndicador = (indicador: string) => linhas.filter((l) => l.indicador === indicador);
  const resultados = doIndicador('alfabetizacao_2o_ano');
  const anos = anosEmOrdem(resultados);
  const metas = doIndicador('alfabetizacao_meta');
  const rede = (lugar: string) => {
    const achada = resultados.find((l) => l.lugar === lugar)?.rede;
    return achada ? redeSchema.parse(achada) : null;
  };
  const valor = (de: readonly LinhaDeEducacao[], periodo: string) =>
    porLugar((lugar) => de.find((l) => l.lugar === lugar && l.periodo === periodo)?.valor ?? null);
  const metaEm = (lugar: string, periodo: string) => {
    const linha = metas.find((l) => l.lugar === lugar && l.periodo === periodo);
    return linha?.valor ?? linha?.texto ?? null;
  };
  const ano = anos.at(-1) ?? String(lote.ano);
  return {
    ano,
    fonte: fonteDoLote(lote, FONTE_DA_ALFABETIZACAO),
    redes: {
      orleans: rede(CODIGO_DO_LUGAR.orleans),
      santaCatarina: rede(CODIGO_DO_LUGAR.santaCatarina),
      brasil: rede(CODIGO_DO_LUGAR.brasil),
    },
    serie: anos.map((periodo) => ({ ano: periodo, valores: valor(resultados, periodo) })),
    metas: anosEmOrdem(metas).map((periodo) => ({
      ano: periodo,
      orleans: metaEm(CODIGO_DO_LUGAR.orleans, periodo),
      santaCatarina: metaEm(CODIGO_DO_LUGAR.santaCatarina, periodo),
      brasil: metaEm(CODIGO_DO_LUGAR.brasil, periodo),
    })),
    participacao: valor(doIndicador('alfabetizacao_participacao'), ano),
  };
}

const ETAPAS_DO_IDEB = [
  { etapa: 'anos_iniciais', categoria: 'Ensino fundamental > Anos iniciais' },
  { etapa: 'anos_finais', categoria: 'Ensino fundamental > Anos finais' },
  { etapa: 'medio', categoria: 'Ensino médio' },
];
const SUFIXO_DA_REDE: Record<Rede, string> = {
  publica: ' > Pública',
  municipal: ' > Pública > Municipal',
  estadual: ' > Pública > Estadual',
  privada: ' > Privada',
  todas: '',
};

// A fonte de SC não publica a pública do ensino médio: a linha é a estadual, nas duas fontes.
const redeNaFonte = (lugar: Lugar, rede: Rede, etapa: string): Rede =>
  lugar === 'santaCatarina' && rede === 'publica' && etapa === 'medio' ? 'estadual' : rede;

// IBGE para Orleans e SC; o arquivo do INEP para o Brasil e para SC na municipal, que o IBGE não publica.
const vemDoArquivo = (lugar: Lugar, rede: Rede) =>
  lugar === 'brasil' || (lugar === 'santaCatarina' && rede === 'municipal');

function ideb(
  lote: LoteDeEducacao,
  loteDoArquivo: LoteDeEducacao | undefined,
  doIbge: readonly LinhaDoIbge[],
  doArquivo: readonly LinhaDeEducacao[],
): EducacaoAprendizado['ideb'] {
  const pesquisa = doIbge.filter((l) => l.tabela === 'pesquisa-40');
  const series = doArquivo.filter((l) => l.indicador === 'ideb');
  const anosDeOrleans = pesquisa.filter((l) => l.localidade === CODIGO_DO_LUGAR.orleans && l.valor !== null);
  const ano = anosEmOrdem(anosDeOrleans).at(-1);
  if (!ano) return null;
  const anos = [...new Set([...pesquisa, ...series].map((l) => l.periodo))].sort();

  const pontos = (lugar: Lugar, rede: Rede, { etapa, categoria }: (typeof ETAPAS_DO_IDEB)[number]) => {
    const naFonte = redeNaFonte(lugar, rede, etapa);
    const local = CODIGO_DO_LUGAR[lugar];
    const linhas: readonly { periodo: string; valor: number | null }[] = vemDoArquivo(lugar, rede)
      ? series.filter((l) => l.lugar === local && l.rede === naFonte && l.etapa === etapa)
      : pesquisa.filter((l) => l.localidade === local && l.categoria === `${categoria}${SUFIXO_DA_REDE[naFonte]}`);
    const doLugar = new Map(linhas.map((l) => [l.periodo, l.valor]));
    return doLugar.size === 0
      ? []
      : anos
          .filter((periodo) => doLugar.has(periodo))
          .map((periodo) => ({ ano: Number(periodo), valor: doLugar.get(periodo) ?? null }));
  };
  const fonte = fonteDoLote(lote, FONTE_DO_IDEB);
  const emAno = (lista: readonly { ano: number; valor: number | null }[]) =>
    lista.find((p) => String(p.ano) === ano)?.valor ?? null;

  const etapas = ETAPAS_DO_IDEB.map((definicao) => {
    const porRede: ComparacaoDeEducacao['porRede'] = {};
    const dasRedes: NonNullable<EducacaoAprendizado['ideb']>['etapas'][number]['series'] = {};
    for (const rede of redeSchema.options) {
      const orleans = pontos('orleans', rede, definicao);
      const santaCatarina = pontos('santaCatarina', rede, definicao);
      const brasil = pontos('brasil', rede, definicao);
      if (![orleans, santaCatarina, brasil].flat().some((p) => p.valor !== null)) continue;
      dasRedes[rede] = { orleans, santaCatarina, brasil };
      const valores: ValoresDaRede = {
        orleans: emAno(orleans),
        santaCatarina: emAno(santaCatarina),
        brasil: emAno(brasil),
      };
      if (Object.values(valores).some((v) => v !== null)) porRede[rede] = valores;
    }
    return {
      etapa: definicao.etapa,
      comparacao: { indicador: 'ideb', etapa: definicao.etapa, ano, unidade: 'indice' as const, fonte, porRede },
      series: dasRedes,
    };
  });

  const parcela = (indicador: string, lugar: Lugar, rede: Rede, etapa: string) =>
    doArquivo.find(
      (l) =>
        l.indicador === indicador &&
        l.lugar === CODIGO_DO_LUGAR[lugar] &&
        l.rede === redeNaFonte(lugar, rede, etapa) &&
        l.etapa === etapa &&
        l.periodo === ano,
    )?.valor ?? null;
  const parcelas = etapas.flatMap(({ etapa, comparacao }) =>
    redeSchema.options.flatMap((rede) =>
      LUGARES.map((lugar) => ({
        lugar,
        rede,
        etapa,
        ideb: comparacao.porRede[rede]?.[lugar] ?? null,
        rendimento: parcela('ideb_rendimento', lugar, rede, etapa),
        aprovacao: parcela('ideb_aprovacao', lugar, rede, etapa),
        matematica: parcela('ideb_matematica', lugar, rede, etapa),
        portugues: parcela('ideb_portugues', lugar, rede, etapa),
      })).filter(({ lugar: _lugar, rede: _rede, etapa: _etapa, ...numeros }) =>
        Object.values(numeros).some((v) => v !== null),
      ),
    ),
  );

  return {
    ano,
    fonte,
    fonteDoInep: loteDoArquivo ? fonteDoLote(loteDoArquivo, FONTE_DO_ARQUIVO) : null,
    etapas,
    parcelas,
  };
}

function inse(lote: LoteDeEducacao, linhas: readonly LinhaDeEducacao[]): EducacaoAprendizado['inse'] {
  const ano = String(lote.ano);
  const fonte = fonteDoLote(lote, FONTE_DO_INSE);
  return {
    ano,
    fonte,
    comparacao: comparacaoPorRede(linhas, { indicador: 'inse', etapa: '', periodo: ano, unidade: 'indice', fonte }),
  };
}

const AREAS_DO_ENEM = [
  'enem_media_5_areas',
  'enem_natureza',
  'enem_humanas',
  'enem_linguagens',
  'enem_matematica',
  'enem_redacao',
];
const REDES_PUBLICAS = ['Municipal', 'Estadual', 'Federal'];
const FOLHA_DA_REDE: Partial<Record<Rede, readonly string[]>> = {
  publica: REDES_PUBLICAS,
  municipal: ['Municipal'],
  estadual: ['Estadual'],
  privada: ['Privado'],
};

// A fonte escreve "3º série". Sem a rede, o total da série; a pública soma as folhas públicas.
function terceiraSerie(linhas: readonly LinhaDoIbge[], rede: Rede, periodo: string) {
  const CATEGORIA = 'Matrículas > Ensino médio > 3º série';
  const ler = (categoria: string) => lerDoIbge(linhas, { tabela: 'pesquisa-13', categoria, periodo });
  const folhas = FOLHA_DA_REDE[rede];
  return folhas ? somaDosPresentes(folhas.map((folha) => ler(`${CATEGORIA} > ${folha}`))) : ler(CATEGORIA);
}

function enem(
  lotes: readonly LoteDeEducacao[],
  linhas: readonly LinhaDeEducacao[],
  doIbge: readonly LinhaDoIbge[],
  loteDaRedeEscolar: LoteDeEducacao | undefined,
): EducacaoAprendizado['enem'] {
  const ultimo = lotes.at(-1);
  if (!ultimo) return null;
  const fonte = fonteDoLote(ultimo, FONTE_DO_ENEM);
  const anos = lotes.map((lote) => {
    const ano = String(lote.ano);
    const deOrleans = (indicador: string, rede: Rede) =>
      linhas.find(
        (l) =>
          l.indicador === indicador &&
          l.lugar === CODIGO_DO_LUGAR.orleans &&
          l.rede === rede &&
          l.recorte === '' &&
          l.periodo === ano,
      )?.valor ?? null;
    const redes = redeSchema.options.flatMap((rede) => {
      const inscritos = deOrleans('enem_inscritos', rede);
      const presentes = deOrleans('enem_presentes', rede);
      // A coleta retém a rede com menos de 2 escolas: sem número, sem linha.
      if (inscritos === null && presentes === null) return [];
      const naSerie = terceiraSerie(doIbge, rede, ano);
      return [
        {
          rede,
          escolas: deOrleans('enem_escolas', rede),
          inscritos,
          presentes,
          terceiraSerie: naSerie,
          presentesSobreTerceiraSerie: emPercentual(presentes, naSerie, UMA_CASA),
        },
      ];
    });
    return {
      ano,
      redes,
      comparacoes: AREAS_DO_ENEM.map((indicador) =>
        comparacaoPorRede(linhas, { indicador, etapa: 'medio', periodo: ano, unidade: 'nota', fonte }),
      ),
    };
  });
  return {
    ano: String(ultimo.ano),
    fonte,
    fonteDaTerceiraSerie: loteDaRedeEscolar ? fonteDoLote(loteDaRedeEscolar, FONTE_DA_TERCEIRA_SERIE) : null,
    anos,
  };
}

export async function aprendizado(): Promise<EducacaoAprendizado> {
  const lotes = await lotesDeMaiorAno([ALFABETIZACAO, REDE_ESCOLAR, ARQUIVO_DO_IDEB, INSE]);
  const lotesDoEnem = await lotesDeTodosOsAnos([ENEM]);
  const lote = (chave: string) => lotes.find((l) => l.chave === chave);
  const doAlfabetizacao = lote(ALFABETIZACAO);
  const redeEscolar = lote(REDE_ESCOLAR);
  const arquivo = lote(ARQUIVO_DO_IDEB);
  const doInse = lote(INSE);

  const doIbge = redeEscolar ? await valoresDoIbge([redeEscolar], ['pesquisa-40', 'pesquisa-13']) : [];
  const corpo = {
    alfabetizacao: doAlfabetizacao ? alfabetizacao(doAlfabetizacao, await valoresDeEducacao([doAlfabetizacao])) : null,
    ideb: redeEscolar ? ideb(redeEscolar, arquivo, doIbge, arquivo ? await valoresDeEducacao([arquivo]) : []) : null,
    inse: doInse ? inse(doInse, await valoresDeEducacao([doInse])) : null,
    enem: enem(lotesDoEnem, lotesDoEnem.length ? await valoresDeEducacao(lotesDoEnem) : [], doIbge, redeEscolar),
  };
  return {
    disponivel: Object.values(corpo).some((bloco) => bloco !== null),
    faltando: faltandoDe(CONSULTAS, [...lotes, ...lotesDoEnem]),
    ...corpo,
  };
}

function linhasDaAlfabetizacao(bloco: NonNullable<EducacaoAprendizado['alfabetizacao']>): LinhaDoCsv[] {
  const linha = (indicador: string, lugar: Lugar, ano: string, valor: number | string | null) => ({
    indicador,
    lugar: NOME_DO_LUGAR[lugar],
    rede: bloco.redes[lugar] ?? '',
    etapa: 'ano_2',
    ano,
    valor,
    unidade: '%',
    fonte: bloco.fonte.nome,
  });
  return LUGARES.flatMap((lugar) => [
    ...bloco.serie.map(({ ano, valores }) => linha('alfabetizacao_2o_ano', lugar, ano, valores[lugar])),
    ...bloco.metas.map((meta) => linha('alfabetizacao_meta', lugar, meta.ano, meta[lugar])),
    linha('alfabetizacao_participacao', lugar, bloco.ano, bloco.participacao[lugar]),
  ]);
}

function linhasDoIdeb(bloco: NonNullable<EducacaoAprendizado['ideb']>): LinhaDoCsv[] {
  const fonteDoLugar = (lugar: Lugar, rede: Rede) =>
    vemDoArquivo(lugar, rede) ? (bloco.fonteDoInep?.nome ?? '') : bloco.fonte.nome;
  const dasSeries = bloco.etapas.flatMap(({ etapa, series }) =>
    (Object.entries(series) as [Rede, Record<Lugar, { ano: number; valor: number | null }[]>][]).flatMap(
      ([rede, deCadaLugar]) =>
        LUGARES.flatMap((lugar) =>
          deCadaLugar[lugar].map(({ ano, valor }) => ({
            indicador: 'ideb',
            lugar: NOME_DO_LUGAR[lugar],
            rede,
            etapa,
            ano: String(ano),
            valor,
            unidade: 'indice',
            fonte: fonteDoLugar(lugar, rede),
          })),
        ),
    ),
  );
  const PARCELAS = [
    ['ideb_rendimento', 'rendimento', 'indice'],
    ['ideb_aprovacao', 'aprovacao', '%'],
    ['ideb_matematica', 'matematica', 'nota'],
    ['ideb_portugues', 'portugues', 'nota'],
  ] as const;
  const dasParcelas = bloco.parcelas.flatMap((p) =>
    PARCELAS.flatMap(([indicador, campo, unidade]) =>
      p[campo] === null
        ? []
        : [
            {
              indicador,
              lugar: NOME_DO_LUGAR[p.lugar],
              rede: p.rede,
              etapa: p.etapa,
              ano: bloco.ano,
              valor: p[campo],
              unidade,
              fonte: bloco.fonteDoInep?.nome ?? '',
            },
          ],
    ),
  );
  return [...dasSeries, ...dasParcelas];
}

function linhasDoEnem(bloco: NonNullable<EducacaoAprendizado['enem']>): LinhaDoCsv[] {
  return bloco.anos.flatMap(({ ano, redes, comparacoes }) => [
    ...redes.flatMap((linha) => {
      const emOrleans = (indicador: string, valor: number | null, unidade: string, fonte = bloco.fonte.nome) => ({
        indicador,
        lugar: NOME_DE_ORLEANS,
        rede: linha.rede,
        etapa: 'medio',
        ano,
        valor,
        unidade,
        fonte,
      });
      return [
        emOrleans('enem_escolas', linha.escolas, 'escolas'),
        emOrleans('enem_inscritos', linha.inscritos, 'pessoas'),
        emOrleans('enem_presentes', linha.presentes, 'pessoas'),
        emOrleans('matriculas_3a_serie', linha.terceiraSerie, 'matriculas', bloco.fonteDaTerceiraSerie?.nome),
        emOrleans('enem_presentes_sobre_3a_serie', linha.presentesSobreTerceiraSerie, '%'),
      ];
    }),
    ...comparacoes.flatMap((comparacao) => linhasDaComparacao(comparacao)),
  ]);
}

/** O CSV da aba, em formato longo. */
export function linhasDoAprendizado({ alfabetizacao: a, ideb: i, inse: s, enem: e }: EducacaoAprendizado) {
  return [
    ...(a ? linhasDaAlfabetizacao(a) : []),
    ...(i ? linhasDoIdeb(i) : []),
    ...(s ? linhasDaComparacao(s.comparacao) : []),
    ...(e ? linhasDoEnem(e) : []),
  ];
}
