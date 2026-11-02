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

      let nota: string;
      if (excesso !== 0) {
        const porMes = new Map<number, number>();
        for (const i of incoerencias) porMes.set(i.mes, (porMes.get(i.mes) ?? 0) + centavos(i.excesso));
        const meses = [...porMes].map(([m, v]) => `${MESES[m - 1]} (${fmt(v / 100)})`).join(', ');
        const resto = centavos(r.diferenca) - centavos(excesso);
        nota = `Na própria Betha, o arrecadado no mês não fecha com o acumulado da rubrica em ${meses}: lançamento que a consulta mantém e o acumulado desconsidera. `;
        nota += resto === 0 ? 'Explica toda a diferença.' : `Explica ${fmt(excesso)}; restam ${fmt(resto / 100)}.`;
      } else if (duplicada) {
        const outraBate = linhas.some((o) => o.ent === r.ent && o.natureza === duplicada.outra && o.diferenca === 0);
        nota = `Em ${MESES[duplicada.mes - 1]}, o mesmo valor (${fmt(duplicada.v)}) também foi lançado na rubrica ${duplicada.outra}${outraBate ? ', que bate com o TCE' : ''}: possível lançamento em duplicidade na Betha.`;
      } else if (compensa) {
        nota = `Compensa exatamente a diferença da rubrica ${compensa.natureza}: provável reclassificação entre rubricas, sem efeito no total.`;
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
      return { ...resto, codigoEntidade: ent, tipo, incoerenciaBetha: excesso, nota };
    });
}

export function anotarEmpenho(e: EmpenhoSemPar) {
  let nota: string;
  if (e.ocorrencia > 1) nota = 'Registro repetido: mesmo número, data e valor de outro empenho.';
  else if (e.numeroNaOutra)
    nota = `Na outra fonte, o empenho com esta data e valor é o nº ${e.numeroNaOutra}: provável renumeração.`;
  else nota = e.fonte === 'betha' ? 'Sem correspondente no TCE.' : 'Sem correspondente na Betha.';
  if (e.fonte === 'betha' && e.liquidado === null) nota += ' Não tem liquidação registrada.';
  return { ...e, nota };
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
    receitaPorMes: receitaMes,
    receitaPorNatureza: anotarNaturezas(naturezas, repetidas, incoerentes),
    receitaIncoerente: incoerentes,
    empenhos,
    empenhosSemPar: semPar.map(anotarEmpenho),
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
    },
  };
}
