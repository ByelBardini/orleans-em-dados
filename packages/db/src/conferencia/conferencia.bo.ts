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
      const mesmaEntidade = linhas.filter((o) => o.ent === r.ent && o.natureza !== r.natureza);
      const duplicada =
        r.diferenca > 0
          ? repetidas.find((d) => d.ent === r.ent && d.nat === r.natureza && igual(d.v, r.diferenca))
          : null;
      const compensa = mesmaEntidade.find((o) => o.diferenca !== 0 && igual(o.diferenca, -r.diferenca));
      const incoerencias = incoerentes.filter((i) => i.ent === r.ent && i.nat === r.natureza);
      const excesso = somaEmCentavos(incoerencias, (i) => i.excesso);
      const emDoisMeses =
        r.diferenca > 0
          ? repetidasMeses.find((d) => d.ent === r.ent && d.nat === r.natureza && igual(d.v, r.diferenca))
          : null;
      // No grupo de 6 dígitos as fontes batem: a diferença é só de classificação entre rubricas.
      const grupo = r.natureza.slice(0, 6);
      const somaGrupo = linhas
        .filter((o) => o.ent === r.ent && o.natureza.startsWith(grupo))
        .reduce((soma, o) => soma + centavos(o.diferenca), 0);

      let nota: string;
      let causa: string | null = null;
      if (excesso !== 0) {
        const porMes = new Map<number, number>();
        for (const i of incoerencias) porMes.set(i.mes, (porMes.get(i.mes) ?? 0) + centavos(i.excesso));
        const meses = [...porMes].map(([m, v]) => `${MESES[m - 1]} (${fmt(v / 100)})`).join(', ');
        const resto = centavos(r.diferenca) - centavos(excesso);
        nota = `Na própria Betha, o arrecadado no mês não fecha com o acumulado da rubrica em ${meses}: lançamento que a consulta mantém e o acumulado desconsidera. `;
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
