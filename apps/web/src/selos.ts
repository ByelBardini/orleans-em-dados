// A regra dos selos da conferência Betha × TCE-SC, sem DOM.
// Linguagem: "provável"/"possível" quando a causa não foi comprovada.
import { INDICADORES, situacaoDaAtualizacao, type Conferencia, type Importacoes } from '@orleans-em-dados/contracts';
import { data, dataCurta, MESES_LONGOS, moeda, numero } from './format';

export type DadosDoSelo = { estado: 'confere' | 'diverge' | 'pendente'; titulo: string; motivo?: string | null };

const N = Number;
const centavos = (v: number | null | undefined) => Math.round(N(v ?? 0) * 100);
// Diferença Betha − TCE por extenso, sem sinal: o leitor não precisa saber a ordem da subtração.
const sinal = (v: number) => `${moeda(Math.abs(v))} a mais ${v > 0 ? 'na Betha' : 'no TCE-SC'}`;
const mesDaReceita = (conf: Conferencia) => MESES_LONGOS[(conf.limites.mesReceita ?? 1) - 1];

// No ano em curso, o TCE ainda não recebeu os últimos meses: isso é pendência, não divergência.
const pendencia = (conf: Conferencia, tipo: 'receitas' | 'empenhos') =>
  !conf.parcial
    ? null
    : `${tipo === 'empenhos' ? `Empenhos após ${data(conf.limites.dataEmpenho)}` : `Meses após ${mesDaReceita(conf)}`} ainda não conferidos: o TCE-SC recebe os dados com atraso.`;

const doRecorte = <L extends { codigoEntidade: string | null }>(linhas: readonly L[], entidade: string) =>
  entidade ? linhas.filter((l) => l.codigoEntidade === entidade) : linhas;

// Receita arrecadada da entidade (ou de todas) contra o TCE, com a maior causa apontada.
export function seloReceita(conf: Conferencia | null, entidade: string): DadosDoSelo | null {
  if (!conf) return null;
  const linhas = doRecorte(conf.receitaPorEntidade, entidade);
  if (!linhas.length) return null;
  const dif = linhas.reduce((s, l) => s + centavos(l.diferenca), 0) / 100;
  const ate = conf.parcial ? ` até ${mesDaReceita(conf)}` : '';
  if (dif === 0) {
    return { estado: 'confere', titulo: `Confere com o TCE-SC${ate}`, motivo: pendencia(conf, 'receitas') };
  }
  const rubricas = doRecorte(conf.receitaPorNatureza, entidade);
  const [maior] = rubricas;
  const outras = rubricas.length - 1;
  return {
    estado: 'diverge',
    titulo: `Difere do TCE-SC: ${sinal(dif)}${ate}`,
    motivo: [
      maior &&
        `Maior diferença: rubrica ${maior.natureza} (${maior.entidade}), ${sinal(maior.diferenca)}. ${maior.nota}`,
      outras > 0 && `Há mais ${outras} rubrica${outras > 1 ? 's' : ''} com diferença.`,
      pendencia(conf, 'receitas'),
    ]
      .filter(Boolean)
      .join(' '),
  };
}

// Empenhos (57140) da entidade contra o TCE, registro a registro.
export function seloEmpenhos(conf: Conferencia | null, entidade: string): DadosDoSelo | null {
  if (!conf) return null;
  const linhas = doRecorte(conf.empenhos, entidade);
  if (!linhas.length) return null;
  const soma = (k: 'soBetha' | 'soTce' | 'casados' | 'valorSoBetha' | 'valorSoTce') =>
    linhas.reduce((s, l) => s + N(l[k]), 0);
  const soBetha = soma('soBetha');
  const soTce = soma('soTce');
  const ate = conf.parcial ? ` até ${data(conf.limites.dataEmpenho)}` : '';
  if (!soBetha && !soTce) {
    return {
      estado: 'confere',
      titulo: `Todos os ${numero(soma('casados'))} empenhos constam no TCE-SC${ate}`,
      motivo: pendencia(conf, 'empenhos'),
    };
  }
  const semPar = doRecorte(conf.empenhosSemPar, entidade).filter((e) => e.fonte === 'betha');
  const antigos = semPar.filter((e) => e.numeroNaOutra || e.ocorrencia > 1).length;
  return {
    estado: 'diverge',
    titulo: soBetha
      ? `${numero(soBetha)} empenhos não constam no TCE-SC (${moeda(soma('valorSoBetha'))})`
      : `${numero(soTce)} empenhos do TCE-SC não aparecem aqui`,
    motivo: [
      antigos &&
        `${numero(antigos)} deles parecem versões antigas de empenhos renumerados ou registros repetidos: aparecem na lista, mas ficam fora das somas desta página.`,
      soBetha &&
        soTce &&
        `Outros ${numero(soTce)} empenhos do TCE-SC (${moeda(soma('valorSoTce'))}) não aparecem na Betha.`,
      pendencia(conf, 'empenhos'),
    ]
      .filter(Boolean)
      .join(' '),
  };
}

// Despesa orçamentária (57170) contra o TCE-SC por entidade, nas três etapas.
// No ano em curso o TCE está incompleto: o selo usa a conferência empenho a empenho.
export function seloDespesa(conf: Conferencia | null, entidade: string): DadosDoSelo | null {
  if (!conf) return null;
  if (conf.parcial) return seloEmpenhos(conf, entidade);
  const linhas = conf.despesaPorEntidade.filter((l) => l.comparavel && (!entidade || l.entidadeBetha === entidade));
  if (!linhas.length) return null;
  const dif = (k: 'difEmpenhado' | 'difLiquidado' | 'difPago') => linhas.reduce((s, l) => s + centavos(l[k]), 0) / 100;
  const [e, l, p] = [dif('difEmpenhado'), dif('difLiquidado'), dif('difPago')];
  if (!e && !l && !p) {
    return {
      estado: 'confere',
      titulo: 'Confere com o TCE-SC',
      motivo: 'Empenhado, liquidado e pago iguais ao centavo.',
    };
  }
  const divergentes = linhas.filter((x) => x.difEmpenhado || x.difLiquidado || x.difPago).map((x) => x.sigla);
  const empenhos = seloEmpenhos(conf, entidade);
  // Cada etapa por extenso; a primeira que diverge vai para o título.
  const etapas: [string, number][] = [
    ['Empenhado', e],
    ['Liquidado', l],
    ['Pago', p],
  ];
  const [nome, valor] = etapas.find(([, v]) => v !== 0) as [string, number];
  const demais = etapas
    .filter(([n]) => n !== nome)
    .map(([n, v], i): [string, number] => [i ? n.toLocaleLowerCase('pt-BR') : n, v])
    .map(([n, v]) => (v === 0 ? `${n} igual` : `${n}: ${sinal(v)}`));
  return {
    estado: 'diverge',
    titulo: `${nome} difere do TCE-SC: ${sinal(valor)}`,
    motivo: [
      `${demais.join('; ')}. Diferença em: ${divergentes.join(', ')}.`,
      empenhos?.estado === 'diverge' &&
        `Na comparação empenho a empenho: ${empenhos.titulo.charAt(0).toLocaleLowerCase('pt-BR') + empenhos.titulo.slice(1)}.`,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

// Selo de uma rubrica da Betha (código de 14 dígitos), comparada no nível de 8 dígitos.
export function seloRubrica(
  conf: Conferencia | null,
  rubrica: string,
  siglas: ReadonlySet<string | null>,
): DadosDoSelo | null {
  const d = conf?.receitaPorNatureza.find((n) => n.natureza === rubrica.slice(0, 8) && siglas.has(n.entidade));
  if (!conf || !d) return null;
  const ate = conf.parcial ? ` até ${mesDaReceita(conf)}` : '';
  return {
    estado: 'diverge',
    titulo: `Difere do TCE-SC: ${sinal(d.diferenca)}${ate}`,
    motivo: `Grupo ${d.natureza} (${d.entidade}): Betha ${moeda(d.betha ?? 0)}, TCE ${d.tce === null ? 'não consta' : moeda(d.tce)}. ${d.nota}`,
  };
}

// Selo de um empenho da lista, pelo ID Betha.
export function seloEmpenho(conf: Conferencia | null, id: string): DadosDoSelo | null {
  const e = conf?.empenhosSemPar.find((x) => x.fonte === 'betha' && x.id === id);
  if (!e) return null;
  return { estado: 'diverge', titulo: 'Não consta no TCE-SC', motivo: e.nota };
}

// Dado que passou da periodicidade do indicador: fica ao lado do selo de conferência, não no lugar dele.
export function seloDeAtraso(
  importacoes: Importacoes | null,
  idDoIndicador: string,
  ano: number,
  agora: Date,
): DadosDoSelo | null {
  const indicador = INDICADORES.find((i) => i.id === idDoIndicador);
  const importador = importacoes?.importadores.find((i) => i.id === indicador?.importador);
  if (!indicador || !importador) return null;
  const ultimaExtracao = importador.exercicios.find((e) => e.ano === ano)?.atualizadoEm ?? null;
  const { situacao } = situacaoDaAtualizacao(indicador.periodicidade, ano, ultimaExtracao, agora);
  if (situacao !== 'atrasado') return null;
  return { estado: 'pendente', titulo: 'Dado atrasado', motivo: `Última atualização em ${dataCurta(ultimaExtracao)}.` };
}
