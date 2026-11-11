// A aba Resumo lê as outras abas pelos services delas, sem SQL próprio: o número aqui é sempre o número de lá.
// Um valor por pergunta, na rede pública, ou na rede que a fonte tem, escrita em `rede`. Rede sem Orleans dá cartão
// nulo, nunca o total das redes.
import type { ComparacaoDeEducacao, EducacaoResumo, FonteDoBloco, Rede } from '@orleans-em-dados/contracts';
import { acesso } from './acesso.service';
import { aprendizado } from './aprendizado.service';
import { cidade } from './cidade.service';
import { dinheiro } from './dinheiro.service';
import { linhasDaComparacao, NOME_DE_ORLEANS, NOME_DE_SC, type LinhaDoCsv } from './educacao.comum';
import { permanencia } from './permanencia.service';
import { professores } from './professores.service';

// Só o que muda um número desta aba: a falta do ENEM, por exemplo, não aparece aqui.
const CONSULTAS = [
  'inep_alfabetizacao',
  'ibge_educacao_censo',
  'ibge_educacao_comparacao',
  'mec_retrato',
  'ibge_rede_escolar',
  'inep_rendimento',
  'inep_ideb',
  'inep_docentes_superior',
  'inep_turmas',
  'siconfi_funcoes',
  'despesas',
  'ibge_populacao',
  'siope_anexo8',
  'siope_indicadores_valores',
  'siconfi_indices',
  'inep_superior',
];

const FAIXA_DA_CRECHE = '0 a 3 anos';
const REDE_DO_RESUMO: Rede = 'publica';

const naEtapa = (comparacoes: readonly ComparacaoDeEducacao[] | undefined, etapa: string) =>
  comparacoes?.find((c) => c.etapa === etapa);

function cartao(comparacao: ComparacaoDeEducacao | undefined, rede: Rede = REDE_DO_RESUMO) {
  const valores = comparacao?.porRede[rede];
  if (!comparacao || !valores || valores.orleans === null) return null;
  return { ano: comparacao.ano, fonte: comparacao.fonte, rede, valores };
}

function daAlfabetizacao({ alfabetizacao: bloco }: Awaited<ReturnType<typeof aprendizado>>) {
  if (!bloco) return null;
  const valores = bloco.serie.find((s) => s.ano === bloco.ano)?.valores;
  if (!valores || valores.orleans === null) return null;
  return {
    ano: bloco.ano,
    fonte: bloco.fonte,
    redes: bloco.redes,
    valores,
    metaDeOrleans: bloco.metas.find((m) => m.ano === bloco.ano)?.orleans ?? null,
  };
}

function daCreche({ frequencia }: Awaited<ReturnType<typeof acesso>>) {
  const faixa = frequencia?.faixas.find((f) => f.faixa === FAIXA_DA_CRECHE);
  const base = cartao(faixa?.comparacao, 'todas');
  if (!frequencia || !faixa || !base) return null;
  return {
    ...base,
    anoAnterior: frequencia.anoAnterior,
    fonteAnterior: frequencia.fonteAnterior,
    orleansNoAnoAnterior: faixa.noAnoAnterior.orleans,
  };
}

function doAbandono({ rendimento }: Awaited<ReturnType<typeof permanencia>>) {
  const naEtapaDoRendimento = (etapa: string) => rendimento?.etapas.find((e) => e.etapa === etapa)?.abandono;
  const base = cartao(naEtapaDoRendimento('medio'));
  if (!base) return null;
  return {
    ...base,
    anosIniciais: naEtapaDoRendimento('anos_iniciais')?.porRede[REDE_DO_RESUMO] ?? null,
    anosFinais: naEtapaDoRendimento('anos_finais')?.porRede[REDE_DO_RESUMO] ?? null,
  };
}

function doGasto({ gasto }: Awaited<ReturnType<typeof dinheiro>>) {
  const ano = gasto?.anos.filter((a) => a.liquidado !== null).at(-1);
  if (!gasto || !ano || ano.liquidado === null) return null;
  return {
    ano: ano.ano,
    fonte: gasto.fonte,
    liquidado: ano.liquidado,
    conferencia: ano.conferencia,
    igualAoAnexo8: ano.igualAoAnexo8,
    porMorador: ano.porMorador,
    divisor: ano.divisor,
  };
}

function doMinimo({ minimo }: Awaited<ReturnType<typeof dinheiro>>) {
  const ano = minimo?.anos.filter((a) => a.percentual !== null).at(-1);
  if (!minimo || !ano || ano.percentual === null) return null;
  return {
    ano: ano.ano,
    fonte: minimo.fonte,
    percentual: ano.percentual,
    aplicado: ano.aplicado,
    minimo: ano.minimo,
    siconfi: ano.siconfi,
    difereDoSiconfi: ano.difereDoSiconfi,
  };
}

/** O último ano do SIOPE com valor: educação básica (4.8) ou, sem ela, o fundamental (4.2), com a etapa dita. */
function doPorAluno({ porAluno }: Awaited<ReturnType<typeof dinheiro>>): EducacaoResumo['porAluno'] {
  const ano = porAluno?.anos.filter((a) => a.educacaoBasica !== null || a.fundamental !== null).at(-1);
  if (!porAluno || !ano) return null;
  return ano.educacaoBasica !== null
    ? { ano: ano.ano, fonte: porAluno.fonte, etapa: 'educacao_basica', valor: ano.educacaoBasica }
    : { ano: ano.ano, fonte: porAluno.fonte, etapa: 'fundamental', valor: ano.fundamental! };
}

function dasMatriculas({ matriculas }: Awaited<ReturnType<typeof acesso>>) {
  if (!matriculas || matriculas.total === null) return null;
  return { ano: matriculas.ano, fonte: matriculas.fonte, total: matriculas.total, etapas: matriculas.etapas };
}

function doSuperior({ oferta }: Awaited<ReturnType<typeof cidade>>) {
  if (!oferta?.instituicao) return null;
  return { ano: oferta.ano, fonte: oferta.fonte, instituicao: oferta.instituicao, natureza: oferta.natureza };
}

export async function resumo(): Promise<EducacaoResumo> {
  const [doAcesso, doAprendizado, daPermanencia, deProfessores, doDinheiro, daCidade] = await Promise.all([
    acesso(),
    aprendizado(),
    permanencia(),
    professores(),
    dinheiro(),
    cidade(),
  ]);
  const corpo = {
    alfabetizacao: daAlfabetizacao(doAprendizado),
    creche: daCreche(doAcesso),
    procuraPorCreche: doAcesso.retrato && {
      ano: doAcesso.retrato.ano,
      fonte: doAcesso.retrato.fonte,
      solicitacoesNaoAtendidas: doAcesso.retrato.solicitacoesNaoAtendidas,
    },
    abandono: doAbandono(daPermanencia),
    ideb: cartao(doAprendizado.ideb?.etapas.find((e) => e.etapa === 'anos_iniciais')?.comparacao),
    docentesSuperior: cartao(naEtapa(deProfessores.docentesSuperior?.comparacoes, 'anos_iniciais')),
    turmas: cartao(naEtapa(deProfessores.turmas?.comparacoes, 'anos_iniciais')),
    gasto: doGasto(doDinheiro),
    porAluno: doPorAluno(doDinheiro),
    minimo: doMinimo(doDinheiro),
    matriculas: dasMatriculas(doAcesso),
    alfabetizacaoDosMoradores: cartao(daCidade.alfabetizacao?.total, 'todas'),
    superior: doSuperior(daCidade),
  };
  const faltando = new Set(
    [doAcesso, doAprendizado, daPermanencia, deProfessores, doDinheiro, daCidade].flatMap((aba) => aba.faltando),
  );
  return {
    disponivel: Object.values(corpo).some((bloco) => bloco !== null),
    faltando: CONSULTAS.filter((chave) => faltando.has(chave)),
    ...corpo,
  };
}

type Cartao = { ano: string; fonte: FonteDoBloco; rede: Rede; valores: ComparacaoDeEducacao['porRede'][Rede] };

const linhasDoCartao = (
  indicador: string,
  etapa: string,
  unidade: ComparacaoDeEducacao['unidade'],
  bloco: Cartao | null,
): LinhaDoCsv[] =>
  bloco?.valores
    ? linhasDaComparacao({
        indicador,
        etapa,
        unidade,
        ano: bloco.ano,
        fonte: bloco.fonte,
        porRede: { [bloco.rede]: bloco.valores },
      })
    : [];

const NOME_DO_LUGAR_NO_CSV = { orleans: NOME_DE_ORLEANS, santaCatarina: NOME_DE_SC, brasil: 'Brasil' };

// Cada lugar com a própria rede: a comparação sai de uma rede por lugar.
function linhasDaAlfabetizacao(bloco: EducacaoResumo['alfabetizacao']): LinhaDoCsv[] {
  if (!bloco) return [];
  const { valores, redes } = bloco;
  return (['orleans', 'santaCatarina', 'brasil'] as const).flatMap((lugar) => {
    const rede = redes[lugar];
    return rede === null
      ? []
      : linhasDaComparacao({
          indicador: 'alfabetizacao_2o_ano',
          etapa: 'ano_2',
          unidade: '%',
          ano: bloco.ano,
          fonte: bloco.fonte,
          porRede: { [rede]: valores },
        }).filter((linha) => linha.lugar === NOME_DO_LUGAR_NO_CSV[lugar]);
  });
}

const emOrleans = (
  indicador: string,
  rede: string,
  etapa: string,
  ano: string | number,
  valor: number | string | null,
  unidade: string,
  fonte: FonteDoBloco,
): LinhaDoCsv => ({
  indicador,
  lugar: NOME_DE_ORLEANS,
  rede,
  etapa,
  ano: String(ano),
  valor,
  unidade,
  fonte: fonte.nome,
});

function linhasDasMatriculas(bloco: EducacaoResumo['matriculas']): LinhaDoCsv[] {
  if (!bloco) return [];
  const linha = (rede: string, etapa: string, valor: number | null) =>
    emOrleans('matriculas', rede, etapa, bloco.ano, valor, 'matriculas', bloco.fonte);
  return [
    linha('todas', 'total', bloco.total),
    ...bloco.etapas.flatMap(({ etapa, total, municipal, estadual, federal, privada }) => [
      linha('municipal', etapa, municipal),
      linha('estadual', etapa, estadual),
      linha('federal', etapa, federal),
      linha('privada', etapa, privada),
      linha('todas', etapa, total),
    ]),
  ];
}

function linhasDaMeta(bloco: EducacaoResumo['alfabetizacao']): LinhaDoCsv[] {
  if (bloco === null || bloco.metaDeOrleans === null) return [];
  const rede = bloco.redes.orleans ?? '';
  return [emOrleans('alfabetizacao_meta', rede, 'ano_2', bloco.ano, bloco.metaDeOrleans, '%', bloco.fonte)];
}

/** O CSV da aba, em formato longo. */
export function linhasDoResumo(r: EducacaoResumo): LinhaDoCsv[] {
  const { creche, abandono, gasto, minimo, superior, procuraPorCreche } = r;
  return [
    ...linhasDaAlfabetizacao(r.alfabetizacao),
    ...linhasDaMeta(r.alfabetizacao),
    ...linhasDoCartao('frequencia_escolar', FAIXA_DA_CRECHE, '%', creche),
    ...(creche
      ? [
          emOrleans(
            'frequencia_escolar',
            creche.rede,
            FAIXA_DA_CRECHE,
            creche.anoAnterior,
            creche.orleansNoAnoAnterior,
            '%',
            creche.fonteAnterior,
          ),
        ]
      : []),
    ...(procuraPorCreche
      ? [
          emOrleans(
            'retrato_solicitacoes_nao_atendidas_creche',
            'municipal',
            '',
            procuraPorCreche.ano,
            procuraPorCreche.solicitacoesNaoAtendidas,
            'texto',
            procuraPorCreche.fonte,
          ),
        ]
      : []),
    ...linhasDoCartao('abandono', 'medio', '%', abandono),
    ...(abandono
      ? linhasDoCartao('abandono', 'anos_iniciais', '%', { ...abandono, valores: abandono.anosIniciais ?? undefined })
      : []),
    ...(abandono
      ? linhasDoCartao('abandono', 'anos_finais', '%', { ...abandono, valores: abandono.anosFinais ?? undefined })
      : []),
    ...linhasDoCartao('ideb', 'anos_iniciais', 'indice', r.ideb),
    ...linhasDoCartao('docentes_superior', 'anos_iniciais', '%', r.docentesSuperior),
    ...linhasDoCartao('alunos_por_turma', 'anos_iniciais', 'alunos', r.turmas),
    ...(gasto
      ? [
          emOrleans('gasto_liquidado', 'municipal', '', gasto.ano, gasto.liquidado, 'reais', gasto.fonte),
          emOrleans('gasto_por_morador', 'municipal', '', gasto.ano, gasto.porMorador, 'reais', gasto.fonte),
        ]
      : []),
    ...(r.porAluno
      ? [
          emOrleans(
            'por_aluno',
            'municipal',
            r.porAluno.etapa,
            r.porAluno.ano,
            r.porAluno.valor,
            'reais',
            r.porAluno.fonte,
          ),
        ]
      : []),
    ...(minimo
      ? [emOrleans('indice_educacao', 'municipal', '', minimo.ano, minimo.percentual, '%', minimo.fonte)]
      : []),
    ...linhasDasMatriculas(r.matriculas),
    ...linhasDoCartao('alfabetizacao', '15 anos ou mais', '%', r.alfabetizacaoDosMoradores),
    ...(superior
      ? [
          emOrleans('superior_instituicao', 'todas', '', superior.ano, superior.instituicao, 'texto', superior.fonte),
          emOrleans('superior_natureza', 'todas', '', superior.ano, superior.natureza, 'texto', superior.fonte),
        ]
      : []),
  ];
}
