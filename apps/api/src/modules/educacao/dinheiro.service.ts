// A aba Dinheiro: mínimo legal, gasto, ações, repasses, conta do Fundeb e valor por aluno. Só exercício encerrado, em
// reais nominais. Número principal é o SIOPE ou o conferido; o SICONFI só entra para o aviso de diferença.
import { populacaoDoAno, type EducacaoDinheiro, type PontoDaPopulacao } from '@orleans-em-dados/contracts';
import { ACOES_DE_EDUCACAO, conferirGastoEducacao, dadosConferidos } from '@orleans-em-dados/db/conferencias';
import { linhasDasFuncoes, totaisDasFuncoes } from '../funcoes/funcoes.dao';
import { populacaoPublicada } from '../municipio/municipio.service';
import {
  contribuicaoNoTce,
  financasDosLotes,
  liquidadoDasAcoes,
  type LinhaDaAcao,
  type LinhaDeFinanca,
} from './dinheiro.dao';
import {
  emPercentual,
  faltandoDe,
  fonteDoLote,
  lotesDeTodosOsAnos,
  NOME_DE_ORLEANS,
  valoresDoIbge,
  type LinhaDoCsv,
  type LoteDeEducacao,
} from './educacao.comum';
import { anoBase, corrigir, type MesDoIpca } from './inflacao';

const ANEXO_8 = 'siope_anexo8';
const INDICADORES = 'siope_indicadores_valores';
const RREO = 'siconfi_indices';
const DCA = 'siconfi_funcoes';
const ACOES_BETHA = 'despesas';
const RECEITAS = 'receitas';
const RECEITAS_TCE = 'tcesc_receitas';
const POPULACAO = 'ibge_populacao';
// O IPCA corrige, mas não é número da aba: sem ele, nada falta, só não há `corrigido`.
const IPCA = 'ibge_ipca';
const TABELA_DO_IPCA = '1737';
const CONSULTAS = [ANEXO_8, INDICADORES, RREO, DCA, ACOES_BETHA, RECEITAS, RECEITAS_TCE, POPULACAO];

const MINIMO_DA_EDUCACAO = 25;
// Lei 14.113/2020: 70% desde 2021; antes, 60%.
const minimoDoFundeb = (ano: number) => (ano <= 2020 ? 60 : 70);

// As contas da aba têm uma casa: de 54,899 para 54,90 e daí para 54,9, seriam dois arredondamentos.
const UMA_CASA = 1;
const emCentavos = (valor: number) => Math.round(valor * 100);
const deCentavos = (centavos: number) => centavos / 100;
const iguais = (a: number | null, b: number | null) => a !== null && b !== null && emCentavos(a) === emCentavos(b);
const somaExata = (valores: readonly number[]) => deCentavos(valores.reduce((soma, v) => soma + emCentavos(v), 0));

type Financas = readonly LinhaDeFinanca[];
const daLinha = (linhas: Financas, indicador: string, ano: number, recorte = '') =>
  linhas.find((l) => l.indicador === indicador && l.periodo === String(ano) && l.recorte === recorte);

const anosDe = (linhas: Financas, indicador: string, recorte = '') =>
  [
    ...new Set(linhas.filter((l) => l.indicador === indicador && l.recorte === recorte).map((l) => Number(l.periodo))),
  ].sort((a, b) => a - b);

function anosDoIndice(
  indicador: string,
  minimoDe: (ano: number) => number,
  anexo8: Financas,
  rreo: Financas,
): NonNullable<EducacaoDinheiro['fundebRemuneracao']>['anos'] {
  return anosDe(anexo8, indicador).map((ano) => {
    const siope = daLinha(anexo8, indicador, ano);
    const comparada = daLinha(rreo, indicador, ano);
    const percentual = siope?.percentual ?? null;
    const aplicado = siope?.valor ?? null;
    const siconfi = comparada ? { percentual: comparada.percentual, valor: comparada.valor } : null;
    // Igualdade do percentual não basta: R$ 13,55 em 2021 não mudam a segunda casa.
    const difereDoSiconfi =
      siconfi !== null &&
      (siconfi.percentual !== percentual ||
        (aplicado !== null && siconfi.valor !== null && !iguais(aplicado, siconfi.valor)));
    return { ano, percentual, aplicado, minimo: minimoDe(ano), siconfi, difereDoSiconfi };
  });
}

const ETAPAS_DA_DCA = [
  { subfuncao: '12.361', chave: 'fundamental' },
  { subfuncao: '12.365', chave: 'infantil' },
  { subfuncao: '12.364', chave: 'superior' },
  { subfuncao: 'FU12', chave: 'outras' },
] as const;

const TRANSPORTE = 'Manutenção do Transporte Escolar';
const MERENDA = 'Manutenção da Merenda Escolar';

const liquidadoDe = (acoes: readonly LinhaDaAcao[], ano: number, nome: string) =>
  acoes.find((a) => a.ano === ano && a.acao === nome)?.liquidado ?? null;
const totalDe = (acoes: readonly LinhaDaAcao[], ano: number) =>
  acoes.find((a) => a.ano === ano && a.acao === null && a.natureza === null)?.liquidado ?? null;

const porPessoa = (valor: number, populacao: number) => Math.round((valor * 100) / populacao) / 100;

type NivelDoGasto = 'conferido' | 'diferenca' | 'sem_betha';

async function gasto(
  lote: LoteDeEducacao,
  encerrado: (ano: number) => boolean,
  serie: readonly PontoDaPopulacao[],
  anexo8: Financas,
  acoes: readonly LinhaDaAcao[],
  niveis: Map<number, NivelDoGasto>,
  ipca: readonly MesDoIpca[],
): Promise<EducacaoDinheiro['gasto']> {
  const [linhas, totais] = await Promise.all([linhasDasFuncoes(null), totaisDasFuncoes(null)]);
  const anos = totais
    .filter((t) => encerrado(t.ano))
    .map((total) => {
      const ano = total.ano;
      const liquidado =
        linhas.find((l) => l.ano === ano && l.tipo === 'funcao' && l.codigo === '12')?.liquidado ?? null;
      const noAnexo8 = daLinha(anexo8, 'gasto_total', ano, 'liquidado')?.valor ?? null;
      const divisor = populacaoDoAno(serie, ano);
      return {
        ano,
        liquidado,
        conferencia: niveis.get(ano) ?? ('sem_betha' as const),
        igualAoAnexo8: iguais(liquidado, noAnexo8),
        anexo8: noAnexo8,
        divisor,
        porMorador: liquidado !== null && divisor ? porPessoa(liquidado, divisor.populacao) : null,
        corrigido: corrigir(liquidado, ano, ipca),
        participacao: emPercentual(liquidado, total.liquidado, UMA_CASA),
        etapas: ETAPAS_DA_DCA.flatMap(({ subfuncao, chave }) => {
          const linha = linhas.find(
            (l) => l.ano === ano && l.tipo === 'subfuncao' && l.codigo === '12' && l.subfuncao === subfuncao,
          );
          return linha
            ? [{ chave, valor: linha.liquidado, percentual: emPercentual(linha.liquidado, liquidado, UMA_CASA) }]
            : [];
        }),
      };
    });
  const comBetha = acoes.filter((a) => encerrado(a.ano)).at(-1)?.ano;
  return {
    fonte: fonteDoLote(lote, 'SICONFI, DCA Anexo I-E, função 12, valor liquidado'),
    anos,
    crescimentoReal: crescimentoReal(anos),
    acoesNasEtapas:
      comBetha === undefined
        ? null
        : {
            ano: comBetha,
            transporte: liquidadoDe(acoes, comBetha, TRANSPORTE),
            merenda: liquidadoDe(acoes, comBetha, MERENDA),
          },
  };
}

const NATUREZAS = ['pessoal', 'custeio', 'investimento', 'outras'] as const;

function blocoDasAcoes(
  lote: LoteDeEducacao,
  encerrado: (ano: number) => boolean,
  acoes: readonly LinhaDaAcao[],
  niveis: Map<number, NivelDoGasto>,
): EducacaoDinheiro['acoes'] {
  const anos = [...new Set(acoes.map((a) => a.ano))].filter(encerrado);
  return {
    fonte: fonteDoLote(lote, 'Portal da Transparência (Betha), despesa por ação, valor liquidado'),
    anos: anos.map((ano) => {
      const total = totalDe(acoes, ano);
      return {
        ano,
        total,
        totalConferido: niveis.get(ano) === 'conferido',
        acoes: acoes.flatMap((a) => (a.ano === ano && a.acao ? [{ nome: a.acao, liquidado: a.liquidado }] : [])),
        naturezas: NATUREZAS.flatMap((chave) => {
          const linha = acoes.find((a) => a.ano === ano && a.natureza === chave);
          return linha
            ? [{ chave, liquidado: linha.liquidado, percentual: emPercentual(linha.liquidado, total, UMA_CASA) }]
            : [];
        }),
      };
    }),
  };
}

// As rubricas de repasse à educação, na receita da Prefeitura. O rendimento de aplicação (1321…) não é repasse, e o
// convênio de "Transportes" (24149901040000, 24229901050000) não diz que é escolar: ficam de fora.
const PREFEITURA = '728';
const FUNDEB = '17515001000000';
const TRANSPORTE_DO_ESTADO = '17245101010000';
const PNATE = '17145301000000';
const PNAE = '17145201000000';
const RUBRICAS: readonly (readonly [rubrica: string, nome: string])[] = [
  [FUNDEB, 'Fundeb'],
  ['17155201000000', 'Complementação da União ao Fundeb, VAAR'],
  [TRANSPORTE_DO_ESTADO, 'Transporte escolar, repasse do Estado'],
  ['17145001000000', 'Salário-educação'],
  [PNAE, 'PNAE, alimentação escolar'],
  [PNATE, 'PNATE, transporte escolar'],
  ['17145101000000', 'PDDE, dinheiro direto na escola'],
  ['17149901040000', 'Programa Escola em Tempo Integral'],
  ['24145101000000', 'Convênio com a União, educação'],
  ['24229901080000', 'Convênio com o Estado, educação'],
];

const EQUIVALENCIAS = [
  { chave: 'transporte', acao: TRANSPORTE, rubricas: [TRANSPORTE_DO_ESTADO, PNATE] },
  { chave: 'merenda', acao: MERENDA, rubricas: [PNAE] },
] as const;

type NaturezaConferida = { codigoEntidade: string; natureza: string; nivel: 8 | 14; conferido: number };
type Conferido = { ano: number; naturezas: readonly NaturezaConferida[] };

/** Só linha de 14 dígitos é a rubrica inteira conferida. A de 8 junta rubricas e tem mês divergente: fica sem número. */
function valorDaRubrica(naturezas: readonly NaturezaConferida[], rubrica: string) {
  const daPrefeitura = naturezas.filter((n) => n.codigoEntidade === PREFEITURA);
  const inteira = daPrefeitura.find((n) => n.nivel === 14 && n.natureza === rubrica);
  if (inteira) return { valor: inteira.conferido };
  return daPrefeitura.some((n) => n.nivel === 8 && n.natureza === rubrica.slice(0, 8)) ? { valor: null } : null;
}

function anoDosRepasses({ ano, naturezas }: Conferido, acoes: readonly LinhaDaAcao[]) {
  const rubricas = RUBRICAS.flatMap(([rubrica, nome]) => {
    const achada = valorDaRubrica(naturezas, rubrica);
    return achada ? [{ rubrica, nome, valor: achada.valor }] : [];
  }).sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  return {
    ano,
    rubricas,
    equivalencias: EQUIVALENCIAS.map(({ chave, acao, rubricas: usadas }) => {
      const achadas = rubricas.filter((r) => (usadas as readonly string[]).includes(r.rubrica));
      const presentes = achadas.flatMap((r) => (r.valor === null ? [] : [r.valor]));
      const repasses = presentes.length && presentes.length === achadas.length ? somaExata(presentes) : null;
      const gastoDaAcao = liquidadoDe(acoes, ano, acao);
      return { chave, gasto: gastoDaAcao, repasses, percentual: emPercentual(repasses, gastoDaAcao, UMA_CASA) };
    }),
  };
}

function contaDoFundeb(
  lote: LoteDeEducacao,
  anexo8: Financas,
  conferidos: readonly Conferido[],
  deducoes: readonly { ano: number; contribuicao: number }[],
): EducacaoDinheiro['contaDoFundeb'] {
  const anos = [...new Set([...anosDe(anexo8, 'fundeb_resultado'), ...anosDe(anexo8, 'fundeb_contribuicao')])].sort(
    (a, b) => a - b,
  );
  return {
    fonte: fonteDoLote(lote, 'SIOPE, Anexo 8 do RREO'),
    anos: anos.map((ano) => {
      const conferido = conferidos.find((c) => c.ano === ano);
      const recebido = conferido ? (valorDaRubrica(conferido.naturezas, FUNDEB)?.valor ?? null) : null;
      const contribuicao = daLinha(anexo8, 'fundeb_contribuicao', ano)?.valor ?? null;
      const resultado = daLinha(anexo8, 'fundeb_resultado', ano)?.valor ?? null;
      const noTce = deducoes.find((d) => d.ano === ano)?.contribuicao ?? null;
      const conta =
        recebido !== null && contribuicao !== null ? deCentavos(emCentavos(recebido) - emCentavos(contribuicao)) : null;
      return {
        ano,
        recebido,
        contribuicao,
        contribuicaoConferida: conferido !== undefined && iguais(contribuicao, noTce),
        conta,
        resultado,
        diferenca: conta !== null && resultado !== null ? deCentavos(emCentavos(resultado) - emCentavos(conta)) : null,
      };
    }),
  };
}

/** Primeiro × último ano, os dois corrigidos: o quanto o gasto mudou acima (ou abaixo) da inflação. */
function crescimentoReal(anos: readonly { ano: number; corrigido: number | null }[]) {
  const [primeiro, ultimo] = [anos[0], anos.at(-1)];
  if (!primeiro || !ultimo || primeiro === ultimo || !primeiro.corrigido || ultimo.corrigido === null) return null;
  const percentual = emPercentual(ultimo.corrigido - primeiro.corrigido, primeiro.corrigido, UMA_CASA);
  return percentual === null ? null : { de: primeiro.ano, ate: ultimo.ano, percentual };
}

// O SIOPE não recomenda o indicador 4.8 nesses dois anos: fica acima das etapas.
const ANOS_SEM_EDUCACAO_BASICA = [2022, 2023];

function porAluno(lote: LoteDeEducacao, valores: Financas, ipca: readonly MesDoIpca[]): EducacaoDinheiro['porAluno'] {
  const anos = [
    ...new Set(valores.filter((l) => l.indicador.startsWith('siope_por_aluno_')).map((l) => Number(l.periodo))),
  ].sort((a, b) => a - b);
  const ler = (chave: string, ano: number) => daLinha(valores, `siope_por_aluno_${chave}`, ano)?.valor ?? null;
  return {
    fonte: fonteDoLote(lote, 'SIOPE, Relatório de Indicadores: investimento por aluno'),
    anos: anos.map((ano) => {
      const nominais = {
        infantil: ler('infantil', ano),
        fundamental: ler('fundamental', ano),
        educacaoBasica: ANOS_SEM_EDUCACAO_BASICA.includes(ano) ? null : ler('educacao_basica', ano),
      };
      const corrigido = ipca.length
        ? {
            infantil: corrigir(nominais.infantil, ano, ipca),
            fundamental: corrigir(nominais.fundamental, ano, ipca),
            educacaoBasica: corrigir(nominais.educacaoBasica, ano, ipca),
          }
        : null;
      return { ano, ...nominais, corrigido };
    }),
  };
}

export async function dinheiro(): Promise<EducacaoDinheiro> {
  const lotes = await lotesDeTodosOsAnos(CONSULTAS);
  // O SICONFI e o SIOPE podem ter o exercício em curso. A população, que é de 2026, não entra nesta regra.
  const anoCorrente = new Date().getFullYear();
  const encerrado = (ano: number) => ano < anoCorrente;
  const fechados = (chave: string) => lotes.filter((l) => l.chave === chave && encerrado(l.ano));

  const noAnexo8 = fechados(ANEXO_8);
  const noRreo = fechados(RREO);
  const nosIndicadores = fechados(INDICADORES);
  const financas = await financasDosLotes([...noAnexo8, ...noRreo, ...nosIndicadores].map((l) => l.coletaId));
  const dosLotes = (grupo: readonly LoteDeEducacao[]) =>
    financas.filter((f) => grupo.some((l) => Number(l.coletaId) === Number(f.coletaId)));
  const anexo8 = dosLotes(noAnexo8);
  const rreo = dosLotes(noRreo);

  const loteDaDca = fechados(DCA).at(-1);
  const loteDasAcoes = fechados(ACOES_BETHA).at(-1);
  const loteDoAnexo8 = noAnexo8.at(-1);
  const loteDoRreo = noRreo.at(-1);
  const loteDosIndicadores = nosIndicadores.at(-1);

  const acoes = loteDasAcoes ? await liquidadoDasAcoes(ACOES_DE_EDUCACAO) : [];
  const loteDoIpca = (await lotesDeTodosOsAnos([IPCA])).at(-1);
  const ipca: MesDoIpca[] = loteDoIpca
    ? (await valoresDoIbge([loteDoIpca], [TABELA_DO_IPCA])).map(({ periodo, valor }) => ({ periodo, valor }))
    : [];
  const base = anoBase(ipca);
  const anosDaDca = fechados(DCA).map((l) => l.ano);
  const niveis = new Map(
    await Promise.all(
      anosDaDca.map(async (ano) => {
        const { estado } = await conferirGastoEducacao(ano);
        return [ano, estado === 'sem_dca' ? 'sem_betha' : estado] as const;
      }),
    ),
  );

  // Conferido é só o exercício completo nas duas fontes: com o TCE-SC até dezembro.
  const anosDaReceita = fechados(RECEITAS).map((l) => l.ano);
  const conferidos: Conferido[] = (
    await Promise.all(
      anosDaReceita.map(async (ano) => {
        const dados = await dadosConferidos(ano);
        return dados.disponivel && !dados.parcial ? [{ ano, naturezas: dados.receita.naturezas }] : [];
      }),
    )
  ).flat();
  const loteDaReceita = fechados(RECEITAS).at(-1);
  const emRepasses = conferidos.map((c) => anoDosRepasses(c, acoes));

  const emenda = (recorte: string) =>
    anexo8.find((f) => f.indicador === 'emenda_119' && f.recorte === recorte)?.valor ?? null;
  const diferencaEm2021 = emenda('diferenca_a_menor_2021');
  const complementadoEm2022 = emenda('complementado_em_2022');
  const fonteDoSiope = loteDoAnexo8 ? fonteDoLote(loteDoAnexo8, 'SIOPE, Anexo 8 do RREO') : null;
  const fonteComparada = loteDoRreo ? fonteDoLote(loteDoRreo, 'SICONFI, RREO Anexo 14') : null;

  const corpo = {
    minimo: fonteDoSiope
      ? {
          fonte: fonteDoSiope,
          fonteComparada,
          anos: anosDoIndice('indice_educacao', () => MINIMO_DA_EDUCACAO, anexo8, rreo),
          emenda119:
            diferencaEm2021 === null && complementadoEm2022 === null ? null : { diferencaEm2021, complementadoEm2022 },
        }
      : null,
    fundebRemuneracao: fonteDoSiope
      ? {
          fonte: fonteDoSiope,
          fonteComparada,
          anos: anosDoIndice('fundeb_remuneracao', minimoDoFundeb, anexo8, rreo),
        }
      : null,
    gasto: loteDaDca
      ? await gasto(loteDaDca, encerrado, await populacaoPublicada(), anexo8, acoes, niveis, ipca)
      : null,
    acoes: loteDasAcoes ? blocoDasAcoes(loteDasAcoes, encerrado, acoes, niveis) : null,
    repasses:
      loteDaReceita && emRepasses.length
        ? {
            fonte: fonteDoLote(loteDaReceita, 'Portal da Transparência (Betha), receita conferida com o TCE-SC'),
            anos: emRepasses,
          }
        : null,
    contaDoFundeb: loteDoAnexo8
      ? contaDoFundeb(loteDoAnexo8, anexo8, conferidos, conferidos.length ? await contribuicaoNoTce() : [])
      : null,
    porAluno: loteDosIndicadores ? porAluno(loteDosIndicadores, dosLotes(nosIndicadores), ipca) : null,
  };
  const inflacao =
    loteDoIpca && base !== null
      ? {
          fonte: fonteDoLote(loteDoIpca, 'IBGE, IPCA (tabela 1737), média do ano'),
          anoBase: base,
          metodo: 'ipca_medio' as const,
        }
      : null;
  return {
    disponivel: Object.values(corpo).some((bloco) => bloco !== null),
    faltando: faltandoDe(CONSULTAS, lotes),
    valores: 'nominais',
    inflacao,
    ...corpo,
  };
}

const emOrleans = (
  indicador: string,
  ano: number,
  valor: number | null,
  unidade: string,
  fonte: string,
  etapa = '',
): LinhaDoCsv => ({
  indicador,
  lugar: NOME_DE_ORLEANS,
  rede: 'municipal',
  etapa,
  ano: String(ano),
  valor,
  unidade,
  fonte,
});

function linhasDoIndice(
  indicador: string,
  { fonte, fonteComparada, anos }: NonNullable<EducacaoDinheiro['fundebRemuneracao']>,
): LinhaDoCsv[] {
  return anos.flatMap(({ ano, percentual, aplicado, minimo, siconfi }) => [
    emOrleans(indicador, ano, percentual, '%', fonte.nome),
    emOrleans(`${indicador}_aplicado`, ano, aplicado, 'R$', fonte.nome),
    emOrleans(`${indicador}_minimo`, ano, minimo, '%', 'Lei'),
    ...(siconfi && fonteComparada
      ? [
          emOrleans(`${indicador}_siconfi`, ano, siconfi.percentual, '%', fonteComparada.nome),
          emOrleans(`${indicador}_siconfi_aplicado`, ano, siconfi.valor, 'R$', fonteComparada.nome),
        ]
      : []),
  ]);
}

const emReaisDe = (indicador: string, inflacao: NonNullable<EducacaoDinheiro['inflacao']>) =>
  `${indicador}_reais_de_${inflacao.anoBase}`;

function linhasDoGasto(
  { fonte, anos }: NonNullable<EducacaoDinheiro['gasto']>,
  inflacao: EducacaoDinheiro['inflacao'],
): LinhaDoCsv[] {
  return anos.flatMap(({ ano, liquidado, corrigido, porMorador, participacao, etapas }) => [
    emOrleans('gasto_educacao', ano, liquidado, 'R$', fonte.nome),
    ...(inflacao ? [emOrleans(emReaisDe('gasto_educacao', inflacao), ano, corrigido, 'R$', fonte.nome)] : []),
    emOrleans('gasto_por_morador', ano, porMorador, 'R$', fonte.nome),
    emOrleans('gasto_participacao', ano, participacao, '%', fonte.nome),
    ...etapas.flatMap(({ chave, valor, percentual }) => [
      emOrleans('gasto_por_etapa', ano, valor, 'R$', fonte.nome, chave),
      emOrleans('gasto_por_etapa_percentual', ano, percentual, '%', fonte.nome, chave),
    ]),
  ]);
}

function linhasDasAcoes({ fonte, anos }: NonNullable<EducacaoDinheiro['acoes']>): LinhaDoCsv[] {
  return anos.flatMap(({ ano, acoes, naturezas }) => [
    ...acoes.map(({ nome, liquidado }) => emOrleans('gasto_por_acao', ano, liquidado, 'R$', fonte.nome, nome)),
    ...naturezas.flatMap(({ chave, liquidado, percentual }) => [
      emOrleans('gasto_por_natureza', ano, liquidado, 'R$', fonte.nome, chave),
      emOrleans('gasto_por_natureza_percentual', ano, percentual, '%', fonte.nome, chave),
    ]),
  ]);
}

function linhasDosRepasses({ fonte, anos }: NonNullable<EducacaoDinheiro['repasses']>): LinhaDoCsv[] {
  return anos.flatMap(({ ano, rubricas, equivalencias }) => [
    ...rubricas.map(({ nome, valor }) => emOrleans('repasse_recebido', ano, valor, 'R$', fonte.nome, nome)),
    ...equivalencias.map(({ chave, percentual }) =>
      emOrleans('repasse_equivale_a_do_gasto', ano, percentual, '%', fonte.nome, chave),
    ),
  ]);
}

function linhasDaConta({ fonte, anos }: NonNullable<EducacaoDinheiro['contaDoFundeb']>): LinhaDoCsv[] {
  return anos.flatMap(({ ano, recebido, contribuicao, conta, resultado, diferenca }) => [
    emOrleans('fundeb_recebido', ano, recebido, 'R$', fonte.nome),
    emOrleans('fundeb_contribuicao', ano, contribuicao, 'R$', fonte.nome),
    emOrleans('fundeb_recebido_menos_contribuicao', ano, conta, 'R$', fonte.nome),
    emOrleans('fundeb_resultado', ano, resultado, 'R$', fonte.nome),
    emOrleans('fundeb_diferenca', ano, diferenca, 'R$', fonte.nome),
  ]);
}

const ETAPAS_DO_POR_ALUNO = [
  ['infantil', 'educacao_infantil'],
  ['fundamental', 'fundamental'],
  ['educacaoBasica', 'educacao_basica'],
] as const;

function linhasDoPorAluno(
  { fonte, anos }: NonNullable<EducacaoDinheiro['porAluno']>,
  inflacao: EducacaoDinheiro['inflacao'],
): LinhaDoCsv[] {
  return anos.flatMap((a) =>
    ETAPAS_DO_POR_ALUNO.flatMap(([campo, etapa]) => [
      emOrleans('por_aluno', a.ano, a[campo], 'R$', fonte.nome, etapa),
      ...(inflacao && a.corrigido
        ? [emOrleans(emReaisDe('por_aluno', inflacao), a.ano, a.corrigido[campo], 'R$', fonte.nome, etapa)]
        : []),
    ]),
  );
}

/** O CSV da aba, em formato longo: reais nominais e, com o IPCA, linhas `_reais_de_<ano-base>`. */
export function linhasDoDinheiro(d: EducacaoDinheiro): LinhaDoCsv[] {
  return [
    ...(d.minimo ? linhasDoIndice('indice_educacao', d.minimo) : []),
    ...(d.fundebRemuneracao ? linhasDoIndice('fundeb_remuneracao', d.fundebRemuneracao) : []),
    ...(d.gasto ? linhasDoGasto(d.gasto, d.inflacao) : []),
    ...(d.acoes ? linhasDasAcoes(d.acoes) : []),
    ...(d.repasses ? linhasDosRepasses(d.repasses) : []),
    ...(d.contaDoFundeb ? linhasDaConta(d.contaDoFundeb) : []),
    ...(d.porAluno ? linhasDoPorAluno(d.porAluno, d.inflacao) : []),
  ];
}
