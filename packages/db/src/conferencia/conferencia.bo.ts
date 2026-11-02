// A regra da conferência Betha × TCE-SC, sem banco: classifica cada diferença e
// aponta padrões verificáveis nos próprios números. As notas apontam padrões
// (duplicidade, renumeração, reclassificação); não são explicações contábeis.

export type LinhaNatureza = {
  ent: string | null;
  entidade: string | null;
  natureza: string;
  descricao: string | null;
  betha: number | null;
  tce: number | null;
  diferenca: number;
};

export type ReceitaRepetida = { ent: string; nat: string; outra: string; mes: number; v: number };
export type ReceitaIncoerente = { ent: string; nat: string; mes: number; excesso: number };
export type ReceitaRepetidaMeses = { ent: string; nat: string; mes: number; outroMes: number; v: number };
export type ParcelaDoMes = { mes: number; ent: string; entidade: string; natureza: string; diferenca: number };
export type DivergenciaEmOutroAno = { ano: number; diferenca: number; parcial: boolean };
export type DivergenciasEmOutrosAnos = ReadonlyMap<string, readonly DivergenciaEmOutroAno[]>;

export type EmpenhoSemPar = {
  fonte: 'betha' | 'tce';
  entidade: string | null;
  codigoEntidade: string | null;
  numero: number | null;
  data: string | null;
  valor: number | null;
  liquidado: number | null;
  ocorrencia: number;
  numeroNaOutra: number | null;
  id: string;
};

/** Só o que a classificação usa. O SQL compara credor e histórico sem devolvê-los: a seção é pública. */
export type EmpenhoParaClassificar = {
  fonte: 'betha' | 'tce';
  entidade: string | null;
  codigoEntidade: string | null;
  numero: number | null;
  data: string | null;
  valor: number | null;
  ocorrencia: number;
  numeroNaOutra: number | null;
  /** O mesmo número aparece na outra fonte, com outra data ou outro valor. */
  numeroExisteNaOutra: boolean;
  /** Na Betha: liquidado, pago e saldo a pagar nulos. */
  semExecucao: boolean;
  id: string;
};

/** Um empenho casado 1:1: o id da Betha, o do TCE-SC e a execução do TCE-SC. */
export type EmpenhoConferido = {
  id: string;
  idTce: string;
  codigoEntidade: string;
  empenhado: number | null;
  liquidado: number | null;
  pago: number | null;
};

export type Limites = { mesReceita: number | null; dataEmpenho: string | null };

export type ColetaDaConferencia = {
  chave: string;
  fonte: string;
  nome: string;
  coleta: string;
  coletadoEm: Date;
  linhas: number;
  recargaTce: string | null;
};

export type DespesaPorEntidade = {
  sigla: string;
  nome: string;
  poder: string;
  entidadeBetha: string | null;
  bethaEmpenhado: number | null;
  tceEmpenhado: number | null;
  difEmpenhado: number | null;
  bethaLiquidado: number | null;
  tceLiquidado: number | null;
  difLiquidado: number | null;
  bethaPago: number | null;
  tcePago: number | null;
  difPago: number | null;
};

export type ReceitaPorEntidade = {
  sigla: string;
  codigoEntidade: string | null;
  betha: number | null;
  tce: number | null;
  diferenca: number;
};

export type ReceitaPorMes = { mes: number | null; betha: number | null; tce: number | null; diferenca: number | null };

export type EmpenhosPorEntidade = {
  entidade: string | null;
  codigoEntidade: string | null;
  betha: number;
  tce: number;
  casados: number;
  soBetha: number;
  valorSoBetha: number;
  soTce: number;
  valorSoTce: number;
};

export type CamaraDaConferencia = {
  empenhos: number;
  empenhado: number | null;
  liquidado: number | null;
  pago: number | null;
  ultimo: string | null;
};

export type DadosDaConferencia = {
  coletas: ColetaDaConferencia[];
  limites: Limites;
  despesa: DespesaPorEntidade[];
  receitaEnt: ReceitaPorEntidade[];
  receitaMes: ReceitaPorMes[];
  naturezas: LinhaNatureza[];
  repetidas: ReceitaRepetida[];
  incoerentes: ReceitaIncoerente[];
  repetidasMeses: ReceitaRepetidaMeses[];
  mesPorRubrica: ParcelaDoMes[];
  outrosAnos: DivergenciasEmOutrosAnos;
  empenhos: EmpenhosPorEntidade[];
  semPar: EmpenhoSemPar[];
  camara: CamaraDaConferencia;
};

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const centavos = (v: number) => Math.round(v * 100);
const igual = (a: number, b: number) => centavos(a) === centavos(b);
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const somaEmCentavos = <T>(lista: readonly T[], valor: (item: T) => number) =>
  lista.reduce((soma, item) => soma + centavos(valor(item)), 0) / 100;

type PistasDoAcumulado = {
  repetidas: readonly ReceitaRepetida[];
  incoerentes: readonly ReceitaIncoerente[];
  repetidasMeses: readonly ReceitaRepetidaMeses[];
};

/** O que os próprios números dizem de uma natureza: quanto o acumulado desconsidera, se a diferença
 *  é o mesmo valor em outra rubrica do mês ou em dois meses, e se outra rubrica a compensa. */
function pistasDaNatureza(
  r: Pick<LinhaNatureza, 'ent' | 'natureza' | 'diferenca'>,
  linhas: readonly LinhaNatureza[],
  { repetidas, incoerentes, repetidasMeses }: PistasDoAcumulado,
) {
  const incoerencias = incoerentes.filter((i) => i.ent === r.ent && i.nat === r.natureza);
  const mesmoValor = (d: { ent: string; nat: string; v: number }) =>
    d.ent === r.ent && d.nat === r.natureza && igual(d.v, r.diferenca);
  const grupo = r.natureza.slice(0, 6);
  return {
    incoerencias,
    excesso: somaEmCentavos(incoerencias, (i) => i.excesso),
    duplicada: r.diferenca > 0 ? repetidas.find(mesmoValor) : null,
    emDoisMeses: r.diferenca > 0 ? repetidasMeses.find(mesmoValor) : null,
    compensa: linhas.find(
      (o) => o.ent === r.ent && o.natureza !== r.natureza && o.diferenca !== 0 && igual(o.diferenca, -r.diferenca),
    ),
    grupo,
    // No grupo de 6 dígitos as fontes batem: a diferença é só de classificação entre rubricas.
    somaGrupo: linhas
      .filter((o) => o.ent === r.ent && o.natureza.startsWith(grupo))
      .reduce((soma, o) => soma + centavos(o.diferenca), 0),
  };
}

export function anotarNaturezas(
  linhas: readonly LinhaNatureza[],
  repetidas: readonly ReceitaRepetida[],
  incoerentes: readonly ReceitaIncoerente[],
  repetidasMeses: readonly ReceitaRepetidaMeses[] = [],
) {
  return linhas
    .filter((r) => r.diferenca !== 0)
    .map((r) => {
      const tipo = r.betha === null ? ('soTce' as const) : r.tce === null ? ('soBetha' as const) : ('valor' as const);
      const { incoerencias, excesso, duplicada, emDoisMeses, compensa, grupo, somaGrupo } = pistasDaNatureza(
        r,
        linhas,
        {
          repetidas,
          incoerentes,
          repetidasMeses,
        },
      );

      let nota: string;
      let causa: string | null = null;
      if (excesso !== 0) {
        const porMes = new Map<number, number>();
        for (const i of incoerencias) porMes.set(i.mes, (porMes.get(i.mes) ?? 0) + centavos(i.excesso));
        const meses = [...porMes].map(([m, v]) => `${MESES[m - 1]} (${fmt(v / 100)})`).join(', ');
        const resto = centavos(r.diferenca) - centavos(excesso);
        nota = `Na própria Betha, o arrecadado no mês não fecha com o acumulado da rubrica em ${meses}: é onde a conta desencontra. A linha que o acumulado provavelmente desconsidera pode ser de outro mês. `;
        nota += resto === 0 ? 'Explica toda a diferença.' : `Explica ${fmt(excesso)}; restam ${fmt(resto / 100)}.`;
        // Explicação parcial deixa um resto sem causa: a rubrica continua em aberto.
        if (resto === 0) causa = 'Lançamento fora do acumulado';
      } else if (duplicada) {
        causa = 'Possível duplicidade';
        const outraBate = linhas.some((o) => o.ent === r.ent && o.natureza === duplicada.outra && o.diferenca === 0);
        nota = `Em ${MESES[duplicada.mes - 1]}, o mesmo valor (${fmt(duplicada.v)}) também foi lançado na rubrica ${duplicada.outra}${outraBate ? ', que bate com o TCE' : ''}: possível lançamento em duplicidade na Betha.`;
      } else if (emDoisMeses) {
        causa = 'Possível duplicidade';
        nota = `O mesmo valor (${fmt(emDoisMeses.v)}) aparece em ${MESES[emDoisMeses.mes - 1]} e em ${MESES[emDoisMeses.outroMes - 1]} na Betha, e uma vez só no TCE: possível lançamento em duplicidade.`;
      } else if (compensa) {
        causa = 'Provável reclassificação';
        nota = `Compensa exatamente a diferença da rubrica ${compensa.natureza}: provável reclassificação entre rubricas, sem efeito no total.`;
      } else if (somaGrupo === 0) {
        causa = 'Provável reclassificação';
        nota = `No grupo ${grupo}, as duas fontes somam o mesmo valor: a diferença está só na classificação entre as rubricas do grupo.`;
      } else if (tipo === 'soTce') {
        nota = 'Registrado no TCE, sem lançamento correspondente na Betha.';
      } else if (tipo === 'soBetha') {
        nota =
          'Lançado na Betha, sem correspondente no TCE neste código (pode estar classificado em outro nível de detalhe).';
      } else {
        nota =
          r.diferenca > 0
            ? 'A Betha registra mais que o TCE nesta rubrica.'
            : 'O TCE registra mais que a Betha nesta rubrica.';
      }
      const { ent, ...resto } = r;
      // Explicada: um padrão nos números aponta a causa provável. As demais são o foco da conferência.
      return { ...resto, codigoEntidade: ent, tipo, incoerenciaBetha: excesso, nota, causa, explicada: causa !== null };
    });
}

type RubricaAnotada = ReturnType<typeof anotarNaturezas>[number] & { conhecida?: true; recorrenteEm?: number[] };

const listaDeAnos = (anos: readonly number[]) =>
  anos.length > 1 ? `${anos.slice(0, -1).join(', ')} e ${anos.at(-1)}` : `${anos[0]}`;

/** Rubrica sem padrão: aponta os meses da diferença e, se ela se repete do mesmo lado em
 *  outro exercício, marca como conhecida. Conhecida sai do destaque sem virar "explicada". */
export function completarRubricas(
  rubricas: readonly RubricaAnotada[],
  mesPorRubrica: readonly ParcelaDoMes[],
  outrosAnos: DivergenciasEmOutrosAnos,
  ano: number,
): RubricaAnotada[] {
  return rubricas.map((r) => {
    if (r.explicada) return r;
    const meses = mesPorRubrica.filter((m) => m.ent === r.codigoEntidade && m.natureza === r.natureza);
    let nota = r.nota;
    if (meses.length > 6) {
      nota += ` A diferença se repete em ${meses.length} meses do ano.`;
    } else if (meses.length) {
      const lista = meses.map(
        (m) => `${MESES[m.mes - 1]} (${fmt(Math.abs(m.diferenca))} a mais ${m.diferenca > 0 ? 'na Betha' : 'no TCE'})`,
      );
      const texto = lista.length > 1 ? `${lista.slice(0, -1).join(', ')} e ${lista.at(-1)}` : lista[0];
      nota += ` A diferença aparece em ${texto}.`;
    }
    const mesmoLado = (outrosAnos.get(`${r.codigoEntidade}|${r.natureza}`) ?? []).filter(
      (o) => Math.sign(o.diferenca) === Math.sign(r.diferenca),
    );
    if (!mesmoLado.length) return { ...r, nota };
    const anos = [...mesmoLado.map((o) => o.ano), ano].sort();
    const outros = mesmoLado.map((o) => `${o.ano}: ${fmt(Math.abs(o.diferenca))}${o.parcial ? ', ano em curso' : ''}`);
    return {
      ...r,
      conhecida: true as const,
      causa: 'Conhecida e recorrente',
      recorrenteEm: anos,
      nota: `${nota} Diverge do mesmo lado em ${listaDeAnos(anos)} (${outros.join('; ')}). Causa ainda não confirmada.`,
    };
  });
}

export function anotarEmpenho(e: EmpenhoSemPar) {
  let nota: string;
  let causa: string | null = null;
  if (e.ocorrencia > 1) {
    causa = 'Registro repetido';
    nota = 'Registro repetido: mesmo número, data e valor de outro empenho.';
  } else if (e.numeroNaOutra) {
    causa = 'Provável renumeração';
    nota = `Na outra fonte, o empenho com esta data e valor é o nº ${e.numeroNaOutra}: provável renumeração.`;
  } else nota = e.fonte === 'betha' ? 'Sem correspondente no TCE.' : 'Sem correspondente na Betha.';
  if (e.fonte === 'betha' && e.liquidado === null) nota += ' Não tem liquidação registrada.';
  return { ...e, nota, causa, explicada: causa !== null };
}

type DespesaComparada = DespesaPorEntidade & { comparavel: boolean };

/** O que sobra sem explicação, já no nível da causa: rubricas e empenhos sem padrão, e
 *  entidades cuja despesa total diverge (a 57170 não desce ao empenho). */
export function listarSemExplicacao(
  despesas: readonly DespesaComparada[],
  rubricas: readonly RubricaAnotada[],
  empenhos: readonly ReturnType<typeof anotarEmpenho>[],
) {
  return [
    ...despesas
      .filter((r) => r.comparavel && (r.difEmpenhado !== 0 || r.difLiquidado !== 0 || r.difPago !== 0))
      .map((r) => ({
        onde: 'despesa' as const,
        entidade: r.sigla,
        codigoEntidade: r.entidadeBetha,
        titulo: 'Despesa orçamentária (57170)',
        betha: r.bethaEmpenhado,
        tce: r.tceEmpenhado,
        diferenca: r.difEmpenhado,
        nota: `Empenhado, liquidado ou pago diferem do TCE (liquidado: ${fmt(r.difLiquidado ?? 0)}; pago: ${fmt(r.difPago ?? 0)}, Betha − TCE). A consulta 57170 não detalha empenho a empenho; veja os empenhos sem par da entidade.`,
      })),
    ...rubricas
      .filter((r) => !r.explicada && !r.conhecida)
      .map((r) => ({ onde: 'receita' as const, ...r, titulo: `Rubrica ${r.natureza}` })),
    ...empenhos
      .filter((e) => !e.explicada)
      .map((e) => ({
        onde: 'empenho' as const,
        ...e,
        titulo: `Empenho nº ${e.numero}`,
        betha: e.fonte === 'betha' ? e.valor : null,
        tce: e.fonte === 'tce' ? e.valor : null,
        diferenca: e.fonte === 'betha' ? (e.valor ?? 0) : -(e.valor ?? 0),
      })),
  ];
}

/** Empenhos Betha que a conferência aponta como versões antigas de empenhos
 *  renumerados ou registros repetidos: saem das somas. */
export function empenhosForaDaSoma(semPar: readonly EmpenhoSemPar[]): string[] {
  return semPar.filter((e) => e.fonte === 'betha' && (e.ocorrencia > 1 || e.numeroNaOutra)).map((e) => e.id);
}

/** Exercício completo no TCE-SC quando a receita já chega a dezembro. */
export const ehParcial = (limites: Limites) => (limites.mesReceita ?? 0) < 12;

export function montarConferencia(ano: number, dados: DadosDaConferencia, agora: Date) {
  const {
    coletas,
    limites,
    despesa,
    receitaEnt,
    receitaMes,
    naturezas,
    repetidas,
    incoerentes,
    repetidasMeses,
    mesPorRubrica,
    outrosAnos,
    empenhos,
    semPar,
    camara,
  } = dados;
  const parcial = ehParcial(limites);
  const despesaPorEntidade = despesa.map((r) => ({
    ...r,
    comparavel: !parcial && r.bethaEmpenhado !== null && r.tceEmpenhado !== null,
  }));
  const comparadas = despesaPorEntidade.filter((r) => r.comparavel);
  const totalEmpenhos = (campo: 'betha' | 'tce' | 'casados') => empenhos.reduce((soma, e) => soma + e[campo], 0);
  const rubricas = completarRubricas(
    anotarNaturezas(naturezas, repetidas, incoerentes, repetidasMeses),
    mesPorRubrica,
    outrosAnos,
    ano,
  );
  const empenhosSemPar = semPar.map(anotarEmpenho);
  const semExplicacao = listarSemExplicacao(despesaPorEntidade, rubricas, empenhosSemPar);

  return {
    ano,
    disponivel: true as const,
    geradoEm: agora.toISOString(),
    parcial,
    limites,
    coletas,
    camara,
    despesaPorEntidade,
    receitaPorEntidade: receitaEnt.map((r) => ({
      ...r,
      incoerenciaBetha: somaEmCentavos(
        incoerentes.filter((i) => i.ent === r.codigoEntidade),
        (i) => i.excesso,
      ),
    })),
    receitaPorMes: receitaMes.map((m) => ({ ...m, parcelas: mesPorRubrica.filter((r) => r.mes === m.mes) })),
    receitaPorNatureza: rubricas,
    receitaIncoerente: incoerentes,
    empenhos,
    empenhosSemPar,
    semExplicacao,
    resumo: {
      despesaEntidadesComparadas: comparadas.length,
      despesaEntidadesIguais: comparadas.filter((r) => r.difEmpenhado === 0 && r.difLiquidado === 0 && r.difPago === 0)
        .length,
      receitaBetha: somaEmCentavos(receitaEnt, (r) => r.betha ?? 0),
      receitaTce: somaEmCentavos(receitaEnt, (r) => r.tce ?? 0),
      receitaDiferenca: somaEmCentavos(receitaEnt, (r) => r.diferenca),
      receitaIncoerenteBetha: somaEmCentavos(incoerentes, (i) => i.excesso),
      naturezasComparadas: naturezas.length,
      naturezasIguais: naturezas.filter((r) => r.diferenca === 0).length,
      empenhosBetha: totalEmpenhos('betha'),
      empenhosTce: totalEmpenhos('tce'),
      empenhosCasados: totalEmpenhos('casados'),
      semExplicacao: semExplicacao.length,
      comCausaProvavel: rubricas.filter((r) => r.explicada).length + empenhosSemPar.filter((e) => e.explicada).length,
      conhecidas: rubricas.filter((r) => r.conhecida).length,
    },
  };
}

// --- Separação da receita: cada cruzamento vira parte conferida + diferença. ---

export type TipoDiscrepancia =
  | 'fora_do_acumulado'
  | 'duas_rubricas'
  | 'mes_diferente'
  | 'so_tce'
  | 'reclassificacao'
  | 'mes_repetido'
  | 'empenho_fantasma'
  | 'empenho_repetido'
  | 'empenho_renumerado'
  | 'empenho_ausente'
  | 'despesa_duplicada'
  | 'aguardando_tce'
  | 'sem_causa';

/** Um cruzamento entidade × natureza de 8 dígitos × mês. `null` é "a fonte não tem a linha". */
export type CruzamentoReceita = {
  ent: string;
  entidade: string;
  natureza: string;
  descricao: string | null;
  mes: number | null;
  betha: number | null;
  tce: number | null;
};

/** Uma linha da 57153 cujo valor aparece, no mesmo mês e entidade, em outra natureza. */
export type LinhaDeReceita = { id: string; ent: string; nat: string; mes: number; v: number };

export type PistasDaReceita = {
  linhasRepetidas: readonly LinhaDeReceita[];
  incoerentes: readonly ReceitaIncoerente[];
  repetidasMeses: readonly ReceitaRepetidaMeses[];
};

/** A parte comum às duas fontes: o valor de menor módulo, se têm o mesmo sinal; senão, nada.
 *  Sempre vale: conferido + diferencaBetha = Betha, e conferido + diferencaTce = TCE. */
export function separarValores(betha: number | null, tce: number | null) {
  const b = centavos(betha ?? 0);
  const t = centavos(tce ?? 0);
  const comum = Math.sign(b) === Math.sign(t) ? Math.sign(b) * Math.min(Math.abs(b), Math.abs(t)) : 0;
  return { conferido: comum / 100, diferencaBetha: (b - comum) / 100, diferencaTce: (t - comum) / 100 };
}

const temDiferenca = (l: { diferencaBetha: number; diferencaTce: number }) =>
  l.diferencaBetha !== 0 || l.diferencaTce !== 0;

type TipoDaNatureza = Exclude<TipoDiscrepancia, 'despesa_duplicada' | 'aguardando_tce'>;
/** Uma fatia da diferença da natureza. As fatias somam, em centavos, a diferença inteira.
 *  A nota, quando existe, substitui a de `anotarNaturezas`, que não vê as linhas casadas. */
type ParteDaNatureza = { tipo: TipoDaNatureza; valor: number; nota?: string };

type LinhasCasadas = { linhas: LinhaDeReceita[]; outras: Set<string>; centavos: number };

/** Casa 1:1, por entidade, mês e valor, linhas de naturezas diferentes. Só a natureza que a Betha tem
 *  a mais pode reclamar uma linha, e a linha precisa caber no que sobra da natureza no mês e no ano:
 *  linha de mês em que as fontes batem não é sobra. Prefere par em natureza que bate com o TCE-SC. */
function casarLinhas(
  comparados: readonly CruzamentoReceita[],
  naturezas: readonly LinhaNatureza[],
  linhasRepetidas: readonly LinhaDeReceita[],
) {
  const noAno = new Map(naturezas.map((n) => [chaveNatureza(n), centavos(n.diferenca)]));
  const noMes = new Map<string, number>();
  const chaveDoMes = (ent: string | null, nat: string, mes: number | null) => `${ent}|${nat}|${mes}`;
  for (const c of comparados) {
    const chave = chaveDoMes(c.ent, c.natureza, c.mes);
    noMes.set(chave, (noMes.get(chave) ?? 0) + centavos(c.betha ?? 0) - centavos(c.tce ?? 0));
  }
  const bate = (l: LinhaDeReceita) => noAno.get(`${l.ent}|${l.nat}`) === 0;
  const grupoDe = (l: LinhaDeReceita) => `${l.ent}|${l.mes}|${centavos(l.v)}`;
  const grupos = agrupar(linhasRepetidas, grupoDe);
  const usadas = new Set<string>();
  const casadas = new Map<string, LinhasCasadas>();
  const ordem = [...linhasRepetidas].sort(
    (a, b) => b.v - a.v || a.nat.localeCompare(b.nat) || a.id.localeCompare(b.id),
  );

  for (const linha of ordem) {
    const chave = `${linha.ent}|${linha.nat}`;
    const mes = chaveDoMes(linha.ent, linha.nat, linha.mes);
    const valor = centavos(linha.v);
    if (usadas.has(linha.id) || (noAno.get(chave) ?? 0) < valor || (noMes.get(mes) ?? 0) < valor) continue;
    const candidatas = (grupos.get(grupoDe(linha)) ?? []).filter((o) => o.nat !== linha.nat && !usadas.has(o.id));
    const par = candidatas.find(bate) ?? candidatas[0];
    if (!par) continue;
    usadas.add(linha.id).add(par.id);
    noAno.set(chave, (noAno.get(chave) ?? 0) - valor);
    noMes.set(mes, (noMes.get(mes) ?? 0) - valor);
    const atual = casadas.get(chave) ?? { linhas: [], outras: new Set<string>(), centavos: 0 };
    atual.linhas.push(linha);
    atual.outras.add(par.nat);
    atual.centavos += valor;
    casadas.set(chave, atual);
  }
  return casadas;
}

function notaDasLinhas(casadas: LinhasCasadas, naturezas: readonly LinhaNatureza[], ent: string | null, resto: number) {
  const outras = [...casadas.outras].sort();
  const todasBatem = outras.every((o) => naturezas.some((n) => n.ent === ent && n.natureza === o && n.diferenca === 0));
  const rubricas = `${outras.length > 1 ? 'nas rubricas' : 'na rubrica'} ${outras.join(', ')}`;
  const [unica] = casadas.linhas;
  const inicio =
    casadas.linhas.length === 1 && unica
      ? `Em ${MESES[unica.mes - 1]}, o mesmo valor (${fmt(unica.v)}) também foi lançado ${rubricas}`
      : `${casadas.linhas.length} linhas de ${[...new Set(casadas.linhas.map((l) => l.mes))]
          .sort((a, b) => a - b)
          .map((m) => MESES[m - 1])
          .join(', ')} (${fmt(casadas.centavos / 100)}) têm o mesmo valor, no mesmo mês, ${rubricas}`;
  const fim = resto === 0 ? '' : ` Restam ${fmt(resto / 100)} sem padrão.`;
  return `${inicio}${todasBatem ? `, que ${outras.length > 1 ? 'batem' : 'bate'} com o TCE` : ''}: possível lançamento em duplicidade na Betha.${fim}`;
}

/** O acumulado explica parte da diferença: só divide se excesso e resto têm o sinal dela. */
function partesDoAcumulado(diferenca: number, excesso: number): ParteDaNatureza[] {
  if (igual(excesso, diferenca)) return [{ tipo: 'fora_do_acumulado', valor: diferenca }];
  const resto = (centavos(diferenca) - centavos(excesso)) / 100;
  const sinal = Math.sign(diferenca);
  return Math.sign(excesso) === sinal && Math.sign(resto) === sinal
    ? [
        { tipo: 'fora_do_acumulado', valor: excesso },
        { tipo: 'sem_causa', valor: resto },
      ]
    : [{ tipo: 'sem_causa', valor: diferenca }];
}

/** A ordem das explicações é a de `anotarNaturezas`, depois do mês trocado (soma zero no ano). */
function partesDaNatureza(
  r: LinhaNatureza,
  linhas: readonly LinhaNatureza[],
  pistas: PistasDaReceita,
  casadas: LinhasCasadas | undefined,
): ParteDaNatureza[] {
  if (r.diferenca === 0) return [{ tipo: 'mes_diferente', valor: 0 }];
  const { excesso, emDoisMeses, compensa, somaGrupo } = pistasDaNatureza(r, linhas, { ...pistas, repetidas: [] });
  if (excesso !== 0) return partesDoAcumulado(r.diferenca, excesso);
  const inteira = (tipo: TipoDaNatureza): ParteDaNatureza[] => [{ tipo, valor: r.diferenca }];
  // Uma explicação da natureza inteira vence as linhas que explicam só parte dela.
  const resto = casadas ? centavos(r.diferenca) - casadas.centavos : null;
  if (casadas && resto === 0) {
    return [{ tipo: 'duas_rubricas', valor: r.diferenca, nota: notaDasLinhas(casadas, linhas, r.ent, 0) }];
  }
  if (emDoisMeses) return inteira('mes_repetido');
  if (compensa || somaGrupo === 0) return inteira('reclassificacao');
  if (casadas && resto !== null) {
    const nota = notaDasLinhas(casadas, linhas, r.ent, resto);
    return [
      { tipo: 'duas_rubricas', valor: casadas.centavos / 100, nota },
      { tipo: 'sem_causa', valor: resto / 100, nota },
    ];
  }
  return inteira(r.betha === null ? 'so_tce' : 'sem_causa');
}

/** Divide a diferença de cada lado entre as partes: a parte fica do lado que a comporta, e a
 *  última leva o que sobra. Assim a soma das partes é a diferença da natureza nos dois lados. */
function ladosDasPartes(partes: readonly ParteDaNatureza[], diferencaBetha: number, diferencaTce: number) {
  let betha = centavos(diferencaBetha);
  let tce = centavos(diferencaTce);
  return partes.map((parte, i) => {
    if (i === partes.length - 1) return { diferencaBetha: betha / 100, diferencaTce: tce / 100 };
    const valor = centavos(parte.valor);
    if (Math.sign(betha) === Math.sign(valor) && Math.abs(betha) >= Math.abs(valor)) {
      betha -= valor;
      return { diferencaBetha: valor / 100, diferencaTce: 0 };
    }
    tce += valor;
    return { diferencaBetha: 0, diferencaTce: -valor / 100 };
  });
}

const chaveNatureza = (l: { ent: string | null; natureza: string }) => `${l.ent}|${l.natureza}`;

const agrupar = <T>(lista: readonly T[], chave: (item: T) => string) => {
  const grupos = new Map<string, T[]>();
  for (const item of lista) grupos.set(chave(item), [...(grupos.get(chave(item)) ?? []), item]);
  return grupos;
};

/** A natureza no ano, até o corte: a soma dos meses de cada fonte. */
function naturezaDoAno(linhas: readonly CruzamentoReceita[]): LinhaNatureza {
  const [primeira] = linhas;
  if (!primeira) throw new Error('Natureza sem nenhum cruzamento');
  const soma = (fonte: 'betha' | 'tce') =>
    linhas.some((l) => l[fonte] !== null) ? somaEmCentavos(linhas, (l) => l[fonte] ?? 0) : null;
  const betha = soma('betha');
  const tce = soma('tce');
  return {
    ent: primeira.ent,
    entidade: primeira.entidade,
    natureza: primeira.natureza,
    descricao: primeira.descricao,
    betha,
    tce,
    diferenca: (centavos(betha ?? 0) - centavos(tce ?? 0)) / 100,
  };
}

/** Separa os cruzamentos até `mesLimite` (o último mês que o TCE-SC recebeu) e deixa os
 *  meses seguintes como pendência. O tipo é decidido por natureza, não por mês: o mês em que o
 *  acumulado desencontra pode não ser o da linha sobrando. */
export function separarReceita(
  cruzamentos: readonly CruzamentoReceita[],
  pistas: PistasDaReceita,
  mesLimite: number | null,
) {
  const aguarda = (c: CruzamentoReceita) => c.mes !== null && c.mes > (mesLimite ?? 0);
  const comparados = cruzamentos.filter((c) => !aguarda(c));
  const naturezas = [...agrupar(comparados, chaveNatureza).values()].map(naturezaDoAno);
  const casadas = casarLinhas(comparados, naturezas, pistas.linhasRepetidas);
  const partes = new Map(
    naturezas.map((n) => [chaveNatureza(n), partesDaNatureza(n, naturezas, pistas, casadas.get(chaveNatureza(n)))]),
  );
  // A natureza dividida tem um resto em aberto: na linha, fica sem_causa.
  const tipoDaLinha = (c: CruzamentoReceita) => {
    const daNatureza = partes.get(chaveNatureza(c)) ?? [];
    return daNatureza.length === 1 ? (daNatureza[0]?.tipo ?? null) : 'sem_causa';
  };
  return {
    partes,
    linhas: comparados.map((c) => {
      const separado = separarValores(c.betha, c.tce);
      return { ...c, ...separado, tipo: temDiferenca(separado) ? tipoDaLinha(c) : null };
    }),
    aguardando: cruzamentos.filter(aguarda).map((c) => ({ ...c, mes: c.mes as number, valor: c.betha ?? 0 })),
  };
}

// --- A receita conferida: as agregações e as discrepâncias que saem da separação. ---

export type Discrepancia = {
  area: 'receita' | 'despesa' | 'empenho';
  tipo: TipoDiscrepancia;
  entidade: string;
  codigoEntidade: string | null;
  natureza?: string;
  descricao?: string | null;
  /** Mês em que as fontes diferem, quando é um só. O mês do desencontro do acumulado fica só na nota. */
  mes?: number;
  meses?: { mes: number | null; betha: number | null; tce: number | null; diferenca: number }[];
  betha: number | null;
  tce: number | null;
  /** Betha − TCE. Em `mes_diferente` é zero: a conta com o total usa `diferencaBetha` e `diferencaTce`. */
  diferenca: number;
  diferencaBetha?: number;
  diferencaTce?: number;
  /** Natureza dividida em partes: a diferença inteira dela. `betha` e `tce` também são da natureza. */
  diferencaDaNatureza?: number;
  /** Despesa: Betha, TCE e diferença em cada etapa. `betha`, `tce` e `diferenca` são do empenhado. */
  etapas?: Record<
    'empenhado' | 'liquidado' | 'pago',
    { betha: number | null; tce: number | null; diferenca: number | null }
  >;
  /** Despesa em empenhos: quantos empenhos a linha resume. */
  quantidade?: number;
  /** Empenho: de qual fonte é a linha, e como achá-la. Nunca credor nem histórico. */
  fonte?: 'betha' | 'tce';
  numero?: number | null;
  dataEmpenho?: string | null;
  id?: string;
  nota: string;
};

export type RubricaDaReceita = { ent: string; rubrica: string; descricao: string | null; valor: number };
export type TotaisDasFontes = { totalBetha: number | null; totalTce: number | null };

export type LinhaNaturezaConferida = {
  codigoEntidade: string;
  entidade: string;
  /** 14 dígitos quando todos os meses batem; 8 quando algum mês diverge. */
  natureza: string;
  nivel: 8 | 14;
  descricao: string | null;
  betha: number | null;
  tce: number | null;
  conferido: number;
  diferencaBetha: number;
  diferencaTce: number;
  tipo: TipoDiscrepancia | null;
};

type LinhaSeparada = ReturnType<typeof separarReceita>['linhas'][number];
type LinhaAguardando = ReturnType<typeof separarReceita>['aguardando'][number];

const somaDasPartes = (linhas: readonly LinhaSeparada[]) => ({
  conferido: somaEmCentavos(linhas, (l) => l.conferido),
  diferencaBetha: somaEmCentavos(linhas, (l) => l.diferencaBetha),
  diferencaTce: somaEmCentavos(linhas, (l) => l.diferencaTce),
});

const somaDaFonte = (linhas: readonly CruzamentoReceita[], fonte: 'betha' | 'tce') =>
  linhas.some((l) => l[fonte] !== null) ? somaEmCentavos(linhas, (l) => l[fonte] ?? 0) : null;

const aguardandoEm = (aguardando: readonly LinhaAguardando[], filtro: (l: LinhaAguardando) => boolean) =>
  somaEmCentavos(aguardando.filter(filtro), (l) => l.valor);

const porConferido = <T extends { conferido: number }>(a: T, b: T) => b.conferido - a.conferido;

/** O formato misto: 14 dígitos quando todos os meses da natureza batem (o TCE só desce a 8);
 *  com qualquer mês divergente, uma linha de 8 dígitos, sem inventar rateio entre as rubricas. */
function naturezasMistas(
  linhas: readonly LinhaSeparada[],
  rubricas: readonly RubricaDaReceita[],
): LinhaNaturezaConferida[] {
  return [...agrupar(linhas, chaveNatureza).values()]
    .flatMap((grupo): LinhaNaturezaConferida[] => {
      const [primeira] = grupo;
      if (!primeira) return [];
      const base = { codigoEntidade: primeira.ent, entidade: primeira.entidade };
      if (grupo.some(temDiferenca)) {
        const tipo = grupo.find((l) => l.tipo)?.tipo ?? null;
        return [
          {
            ...base,
            natureza: primeira.natureza,
            nivel: 8,
            descricao: primeira.descricao,
            betha: somaDaFonte(grupo, 'betha'),
            tce: somaDaFonte(grupo, 'tce'),
            ...somaDasPartes(grupo),
            tipo,
          },
        ];
      }
      return rubricas
        .filter((r) => r.ent === primeira.ent && r.rubrica.startsWith(primeira.natureza) && r.valor !== 0)
        .map((r) => ({
          ...base,
          natureza: r.rubrica,
          nivel: 14,
          descricao: r.descricao,
          betha: r.valor,
          tce: null,
          conferido: r.valor,
          diferencaBetha: 0,
          diferencaTce: 0,
          tipo: null,
        }));
    })
    .sort(porConferido);
}

function discrepanciasDaReceita(
  linhas: readonly LinhaSeparada[],
  partes: ReadonlyMap<string, readonly ParteDaNatureza[]>,
  aguardando: readonly LinhaAguardando[],
  pistas: PistasDaReceita,
  outrosAnos: DivergenciasEmOutrosAnos,
  ano: number,
): Discrepancia[] {
  const parcelas: ParcelaDoMes[] = linhas.flatMap((l) =>
    l.mes !== null && temDiferenca(l)
      ? [
          {
            mes: l.mes,
            ent: l.ent,
            entidade: l.entidade,
            natureza: l.natureza,
            diferenca: somaEmCentavos([l], (x) => x.diferencaBetha - x.diferencaTce),
          },
        ]
      : [],
  );
  const grupos = [...agrupar(linhas, chaveNatureza).values()];
  const notas = new Map(
    completarRubricas(
      anotarNaturezas(grupos.map(naturezaDoAno), [], pistas.incoerentes, pistas.repetidasMeses),
      parcelas,
      outrosAnos,
      ano,
    ).map((r) => [`${r.codigoEntidade}|${r.natureza}`, r.nota]),
  );

  const daNatureza = grupos.flatMap((grupo): Discrepancia[] => {
    const divergentes = grupo.filter(temDiferenca);
    const [primeira] = divergentes;
    if (!primeira?.tipo) return [];
    const { betha, tce, diferenca, descricao } = naturezaDoAno(grupo);
    const { diferencaBetha, diferencaTce } = somaDasPartes(grupo);
    const mes = divergentes.length === 1 && primeira.mes !== null ? primeira.mes : undefined;
    const fatias = partes.get(chaveNatureza(primeira)) ?? [];
    const lados = ladosDasPartes(fatias, diferencaBetha, diferencaTce);
    return fatias.map((parte, i): Discrepancia => ({
      area: 'receita',
      tipo: parte.tipo,
      entidade: primeira.entidade,
      codigoEntidade: primeira.ent,
      natureza: primeira.natureza,
      descricao,
      ...(mes === undefined ? {} : { mes }),
      meses: divergentes.map((l) => ({
        mes: l.mes,
        betha: l.betha,
        tce: l.tce,
        diferenca: somaEmCentavos([l], (x) => x.diferencaBetha - x.diferencaTce),
      })),
      betha,
      tce,
      diferenca: parte.valor,
      ...lados[i],
      ...(fatias.length > 1 ? { diferencaDaNatureza: diferenca } : {}),
      nota:
        parte.nota ??
        notas.get(chaveNatureza(primeira)) ??
        'A soma do ano é igual nas duas fontes: o valor só está em meses diferentes.',
    }));
  });

  const pendentes = [...agrupar(aguardando, (l) => `${l.ent}|${l.mes}`).values()].flatMap((grupo): Discrepancia[] => {
    const [primeira] = grupo;
    const valor = somaEmCentavos(grupo, (l) => l.valor);
    if (!primeira || valor === 0) return [];
    return [
      {
        area: 'receita',
        tipo: 'aguardando_tce',
        entidade: primeira.entidade,
        codigoEntidade: primeira.ent,
        mes: primeira.mes,
        betha: valor,
        tce: null,
        diferenca: valor,
        nota: `O TCE-SC ainda não recebeu ${MESES[primeira.mes - 1]}: o valor da Betha fica fora do conferido até a remessa chegar.`,
      },
    ];
  });

  return [...daNatureza, ...pendentes];
}

export type DadosDaReceitaConferida = {
  cruzamentos: readonly CruzamentoReceita[];
  rubricas: readonly RubricaDaReceita[];
  totais: TotaisDasFontes;
  pistas: PistasDaReceita;
  outrosAnos: DivergenciasEmOutrosAnos;
};

export function montarReceitaConferida(ano: number, mesLimite: number | null, dados: DadosDaReceitaConferida) {
  const { cruzamentos, rubricas, totais, pistas, outrosAnos } = dados;
  const { linhas, partes, aguardando } = separarReceita(cruzamentos, pistas, mesLimite);

  const meses = [...new Set([...linhas, ...aguardando].map((l) => l.mes))].sort((a, b) => (a ?? 13) - (b ?? 13));
  const entidades = agrupar<CruzamentoReceita>([...linhas, ...aguardando], (l) => l.ent);
  const origens = [...new Set([...linhas, ...aguardando].map((l) => l.natureza.slice(0, 2)))];

  const porMes = meses.map((mes) => {
    const doMes = linhas.filter((l) => l.mes === mes);
    const aguardandoDoMes = aguardando.filter((l) => l.mes === mes);
    return {
      mes,
      betha: somaDaFonte([...doMes, ...aguardandoDoMes], 'betha'),
      tce: somaDaFonte(doMes, 'tce'),
      ...somaDasPartes(doMes),
      aguardandoTce: somaEmCentavos(aguardandoDoMes, (l) => l.valor),
    };
  });
  const porEntidade = [...entidades.values()]
    .flatMap((grupo) => {
      const [primeira] = grupo;
      if (!primeira) return [];
      return [
        {
          codigoEntidade: primeira.ent,
          entidade: primeira.entidade,
          ...somaDasPartes(linhas.filter((l) => l.ent === primeira.ent)),
          aguardandoTce: aguardandoEm(aguardando, (l) => l.ent === primeira.ent),
          totalBetha: somaEmCentavos(grupo, (l) => l.betha ?? 0),
          totalTce: somaEmCentavos(grupo, (l) => l.tce ?? 0),
        },
      ];
    })
    .sort(porConferido);
  const porOrigem = origens
    .map((origem) => ({
      origem,
      ...somaDasPartes(linhas.filter((l) => l.natureza.startsWith(origem))),
      aguardandoTce: aguardandoEm(aguardando, (l) => l.natureza.startsWith(origem)),
    }))
    .sort(porConferido);

  return {
    receita: {
      porMes,
      porEntidade,
      porOrigem,
      naturezas: naturezasMistas(linhas, rubricas),
      totais: {
        ...somaDasPartes(linhas),
        aguardandoTce: somaEmCentavos(aguardando, (l) => l.valor),
        totalBetha: totais.totalBetha ?? 0,
        totalTce: totais.totalTce ?? 0,
      },
    },
    discrepancias: discrepanciasDaReceita(linhas, partes, aguardando, pistas, outrosAnos, ano),
  };
}

// --- A despesa conferida: um valor por entidade, ou a entidade sai para as discrepâncias. ---

type Etapas = { empenhado: number; liquidado: number; pago: number };
export type Modalidade71 = Etapas & { ent: string; linhas: number };
export type DespesaCasada = Etapas & { ent: string; casados: number };
export type EmpenhosAguardando = { ent: string; quantidade: number; valor: number };

export type DespesaConferida = {
  entidade: string;
  nome: string;
  codigoEntidade: string | null;
  empenhado: number | null;
  liquidado: number | null;
  pago: number | null;
  fonte: 'betha_57170' | 'tce' | null;
  conferida: boolean;
  tipo: TipoDiscrepancia | null;
  aguardandoTce: number;
  dataCorte?: string;
};

const ETAPAS = ['Empenhado', 'Liquidado', 'Pago'] as const;

const etapasDaLinha = (l: DespesaPorEntidade) => ({
  empenhado: { betha: l.bethaEmpenhado, tce: l.tceEmpenhado, diferenca: l.difEmpenhado },
  liquidado: { betha: l.bethaLiquidado, tce: l.tceLiquidado, diferenca: l.difLiquidado },
  pago: { betha: l.bethaPago, tce: l.tcePago, diferenca: l.difPago },
});

const discrepanciaDeDespesa = (l: DespesaPorEntidade, tipo: TipoDiscrepancia, nota: string): Discrepancia => ({
  area: 'despesa',
  tipo,
  entidade: l.sigla,
  codigoEntidade: l.entidadeBetha,
  betha: l.bethaEmpenhado,
  tce: l.tceEmpenhado,
  diferenca: l.difEmpenhado ?? (centavos(l.bethaEmpenhado ?? 0) - centavos(l.tceEmpenhado ?? 0)) / 100,
  etapas: etapasDaLinha(l),
  nota,
});

/** Exercício completo: o valor da 57170 se bate com o TCE-SC nas três etapas. Se a diferença é
 *  exatamente a modalidade 71 nas três, sai só essa parte. Qualquer outra diferença tira a entidade. */
export function conferirDespesaEncerrada(l: DespesaPorEntidade, modalidade71: Modalidade71 | undefined) {
  const base = {
    entidade: l.sigla,
    nome: l.nome,
    codigoEntidade: l.entidadeBetha,
    aguardandoTce: 0,
  };
  const diferencas = [l.difEmpenhado, l.difLiquidado, l.difPago];
  const comparavel = diferencas.every((d) => d !== null);
  const iguais = comparavel && diferencas.every((d) => d === 0);
  const etapas71 = modalidade71 ? [modalidade71.empenhado, modalidade71.liquidado, modalidade71.pago] : null;
  const fechaCom71 = comparavel && etapas71 !== null && diferencas.every((d, i) => igual(d ?? 0, etapas71[i] ?? 0));

  if (iguais || fechaCom71) {
    const sem71 = (betha: number | null, linhas71: number) =>
      (centavos(betha ?? 0) - (iguais ? 0 : centavos(linhas71))) / 100;
    const entidade: DespesaConferida = {
      ...base,
      empenhado: sem71(l.bethaEmpenhado, modalidade71?.empenhado ?? 0),
      liquidado: sem71(l.bethaLiquidado, modalidade71?.liquidado ?? 0),
      pago: sem71(l.bethaPago, modalidade71?.pago ?? 0),
      fonte: 'betha_57170',
      conferida: true,
      tipo: iguais ? null : 'despesa_duplicada',
    };
    const discrepancia = iguais
      ? null
      : discrepanciaDeDespesa(
          l,
          'despesa_duplicada',
          `As linhas de modalidade 71 da 57170 somam exatamente a diferença com o TCE nas três etapas: provável duplicidade de consórcio na Betha. O valor conferido fica sem essas linhas (empenhado: ${fmt(modalidade71?.empenhado ?? 0)}; liquidado: ${fmt(modalidade71?.liquidado ?? 0)}; pago: ${fmt(modalidade71?.pago ?? 0)}).`,
        );
    return { entidade, discrepancia };
  }

  const nota = comparavel
    ? `Fora do conferido: ${ETAPAS.map((e, i) => `${e.toLowerCase()} difere em ${fmt(diferencas[i] ?? 0)}`).join('; ')} (Betha − TCE), sem padrão que explique as três etapas.`
    : `Fora do conferido: a entidade só tem despesa em ${l.bethaEmpenhado === null ? 'TCE-SC' : 'Betha'}, sem o que comparar.`;
  const entidade: DespesaConferida = {
    ...base,
    empenhado: null,
    liquidado: null,
    pago: null,
    fonte: null,
    conferida: false,
    tipo: 'sem_causa',
  };
  return { entidade, discrepancia: discrepanciaDeDespesa(l, 'sem_causa', nota) };
}

const dataBr = (data: string) => data.split('-').reverse().join('/');

/** Ano em curso: a 57170 não tem data, então a soma é a do líquido do TCE-SC nos empenhos casados
 *  com a Betha até o corte. O que não casa sai um a um (`discrepanciasDeEmpenhos`); o que vem
 *  depois do corte é pendência. */
function conferirDespesaEmCurso(
  l: DespesaPorEntidade,
  corte: string | null,
  casada: DespesaCasada | undefined,
  aguardando: EmpenhosAguardando | undefined,
) {
  const casou = (casada?.casados ?? 0) > 0;
  const entidade: DespesaConferida = {
    entidade: l.sigla,
    nome: l.nome,
    codigoEntidade: l.entidadeBetha,
    empenhado: casou ? (casada?.empenhado ?? 0) : null,
    liquidado: casou ? (casada?.liquidado ?? 0) : null,
    pago: casou ? (casada?.pago ?? 0) : null,
    fonte: casou ? 'tce' : null,
    conferida: casou,
    tipo: null,
    aguardandoTce: aguardando?.valor ?? 0,
    ...(corte ? { dataCorte: corte } : {}),
  };
  const discrepancias: Discrepancia[] = [];
  if (aguardando) {
    discrepancias.push({
      area: 'despesa',
      tipo: 'aguardando_tce',
      entidade: l.sigla,
      codigoEntidade: l.entidadeBetha,
      betha: aguardando.valor,
      tce: null,
      diferenca: aguardando.valor,
      quantidade: aguardando.quantidade,
      nota: corte
        ? `${aguardando.quantidade} empenho(s) da Betha depois de ${dataBr(corte)}, último que o TCE-SC recebeu: ficam fora do conferido até a remessa chegar.`
        : `${aguardando.quantidade} empenho(s) da Betha: o TCE-SC ainda não recebeu empenhos deste exercício, e eles ficam fora do conferido até a remessa chegar.`,
    });
  }
  return { entidade, discrepancias };
}

export type DadosDaDespesaConferida = {
  despesa: readonly DespesaPorEntidade[];
  modalidade71: readonly Modalidade71[];
  casadas: readonly DespesaCasada[];
  aguardando: readonly EmpenhosAguardando[];
  camara: CamaraDaConferencia;
};

export function montarDespesaConferida(parcial: boolean, limites: Limites, dados: DadosDaDespesaConferida) {
  const { despesa, modalidade71, casadas, aguardando, camara } = dados;
  // A Câmara só existe no TCE-SC: é fonte única, sempre à parte.
  const resultados = despesa
    .filter((l) => l.entidadeBetha !== null)
    .map((l) => {
      const ent = l.entidadeBetha;
      if (!parcial) {
        const { entidade, discrepancia } = conferirDespesaEncerrada(
          l,
          modalidade71.find((m) => m.ent === ent),
        );
        return { entidade, discrepancias: discrepancia ? [discrepancia] : [] };
      }
      return conferirDespesaEmCurso(
        l,
        limites.dataEmpenho,
        casadas.find((c) => c.ent === ent),
        aguardando.find((a) => a.ent === ent),
      );
    });
  const porEntidade = resultados.map((r) => r.entidade);
  const conferidas = porEntidade.filter((e) => e.conferida);
  return {
    despesa: {
      porEntidade,
      camara: { ...camara, fonte: 'tce' as const, conferida: false as const },
      totais: {
        empenhado: somaEmCentavos(conferidas, (e) => e.empenhado ?? 0),
        liquidado: somaEmCentavos(conferidas, (e) => e.liquidado ?? 0),
        pago: somaEmCentavos(conferidas, (e) => e.pago ?? 0),
        aguardandoTce: somaEmCentavos(porEntidade, (e) => e.aguardandoTce),
        entidadesConferidas: conferidas.length,
        entidadesFora: porEntidade.filter((e) => e.tipo !== null && !e.conferida).length,
      },
    },
    discrepancias: resultados.flatMap((r) => r.discrepancias),
  };
}

// --- Os empenhos sem par: um a um, sem nome de credor nem histórico. ---

export type ExercicioDoEmpenho = { parcial: boolean; corte: string | null };
type TipoDoEmpenho = Extract<
  TipoDiscrepancia,
  'empenho_fantasma' | 'empenho_repetido' | 'empenho_renumerado' | 'empenho_ausente' | 'aguardando_tce' | 'sem_causa'
>;

/** Repetido e renumerado vêm antes de fantasma: as cópias antigas da 57140 também não têm execução.
 *  Só o exercício encerrado permite dizer que um empenho da Betha nunca chegou ao TCE-SC. */
export function classificarEmpenho(e: EmpenhoParaClassificar, { parcial, corte }: ExercicioDoEmpenho): TipoDoEmpenho {
  if (parcial && (corte === null || (e.data !== null && e.data > corte))) return 'aguardando_tce';
  if (e.ocorrencia > 1) return 'empenho_repetido';
  if (e.numeroNaOutra) return 'empenho_renumerado';
  if (e.fonte === 'tce') return e.numeroExisteNaOutra ? 'sem_causa' : 'empenho_ausente';
  return !parcial && e.semExecucao ? 'empenho_fantasma' : 'sem_causa';
}

function notaDoEmpenho(e: EmpenhoParaClassificar, tipo: TipoDoEmpenho) {
  switch (tipo) {
    case 'empenho_repetido':
      return 'Registro repetido: mesmo número, data e valor de outro empenho.';
    case 'empenho_renumerado':
      return `Na outra fonte, o empenho com esta data, este valor e a mesma identificação é o nº ${e.numeroNaOutra}: provável renumeração.`;
    case 'empenho_fantasma':
      return 'Na Betha, sem correspondente no TCE-SC e sem nenhum campo de execução (liquidado, pago ou saldo a pagar).';
    case 'empenho_ausente':
      return 'Registrado no TCE; o número não aparece na Betha.';
    default:
      if (e.fonte === 'tce') return 'Registrado no TCE; o número existe na Betha, com outra data ou valor.';
      return e.semExecucao
        ? 'Na Betha, sem correspondente no TCE até a data de corte.'
        : 'Na Betha, com execução registrada e sem correspondente no TCE.';
  }
}

/** O que aguarda o TCE-SC já está na pendência por entidade: não sai um a um. */
export function discrepanciasDeEmpenhos(
  semPar: readonly EmpenhoParaClassificar[],
  exercicio: ExercicioDoEmpenho,
): Discrepancia[] {
  return semPar.flatMap((e): Discrepancia[] => {
    const tipo = classificarEmpenho(e, exercicio);
    if (tipo === 'aguardando_tce') return [];
    const valor = e.valor ?? 0;
    return [
      {
        area: 'empenho',
        tipo,
        entidade: e.entidade ?? e.codigoEntidade ?? '',
        codigoEntidade: e.codigoEntidade,
        fonte: e.fonte,
        numero: e.numero,
        dataEmpenho: e.data,
        id: e.id,
        betha: e.fonte === 'betha' ? valor : null,
        tce: e.fonte === 'tce' ? valor : null,
        diferenca: e.fonte === 'betha' ? valor : -valor,
        nota: notaDoEmpenho(e, tipo),
      },
    ];
  });
}

const ORDEM_DOS_TIPOS: readonly TipoDiscrepancia[] = [
  'fora_do_acumulado',
  'duas_rubricas',
  'mes_diferente',
  'so_tce',
  'reclassificacao',
  'mes_repetido',
  'despesa_duplicada',
  'empenho_fantasma',
  'empenho_repetido',
  'empenho_renumerado',
  'empenho_ausente',
  'sem_causa',
  'aguardando_tce',
];

/** Por tipo, com a pendência por último; dentro do tipo, o maior valor primeiro. */
export const ordenarDiscrepancias = (lista: readonly Discrepancia[]) =>
  [...lista].sort(
    (a, b) =>
      ORDEM_DOS_TIPOS.indexOf(a.tipo) - ORDEM_DOS_TIPOS.indexOf(b.tipo) ||
      Math.abs(b.diferenca) - Math.abs(a.diferenca),
  );
