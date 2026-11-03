// Monta a seção pública a partir de `dadosConferidos`. Copia campo a campo: o que não está aqui não
// sai, e `avisos` é interno. Rótulo e explicação não afirmam causa.
import type { Discrepancias } from '@orleans-em-dados/contracts';
import type {
  ComparacaoDeFuncoes,
  ConferenciaDeFuncoes,
  DiscrepanciaConferida,
  TipoDiscrepancia,
} from '@orleans-em-dados/db/conferencias';

type Grupo = Discrepancias['grupos'][number];
type Item = Grupo['itens'][number];
type Area = Exclude<Grupo['area'], 'funcao'>;
type TipoDoGrupo = Exclude<TipoDiscrepancia, 'aguardando_tce'>;
/** Duas rubricas que se compensam, já contadas como um caso. */
type ComPar = DiscrepanciaConferida & { compensacao?: Item['compensacao']; valorDoPar?: number };

/** O nome interno não sai: o público lê o que foi observado, sem a causa. */
const TIPO_PUBLICO: Record<TipoDoGrupo, Grupo['tipo']> = {
  fora_do_acumulado: 'fora_do_acumulado',
  duas_rubricas: 'duas_rubricas',
  mes_diferente: 'mes_diferente',
  so_tce: 'so_tce',
  reclassificacao: 'reclassificacao',
  mes_repetido: 'mes_repetido',
  despesa_duplicada: 'despesa_duplicada',
  empenho_fantasma: 'empenho_sem_execucao',
  empenho_repetido: 'empenho_repetido',
  empenho_renumerado: 'empenho_renumerado',
  empenho_ausente: 'empenho_ausente',
  sem_causa: 'sem_causa',
};

export const TEXTOS: Record<TipoDoGrupo, { rotulo: string; explicacao: string }> = {
  fora_do_acumulado: {
    rotulo: 'Lançamento fora do acumulado',
    explicacao: 'O valor do mês na Betha traz um lançamento que o acumulado da própria rubrica não considera.',
  },
  duas_rubricas: {
    rotulo: 'Mesmo valor em duas rubricas',
    explicacao: 'O mesmo valor aparece em duas rubricas da Betha no mesmo mês, e o TCE-SC só tem uma delas.',
  },
  mes_diferente: {
    rotulo: 'Mesmo valor em meses diferentes',
    explicacao: 'A soma do ano é igual nas duas fontes, com o valor registrado em meses diferentes.',
  },
  so_tce: {
    rotulo: 'Só no TCE-SC',
    explicacao: 'A natureza tem valor no TCE-SC e não aparece na Betha no ano.',
  },
  reclassificacao: {
    rotulo: 'Valor em outra rubrica',
    explicacao: 'A diferença é compensada por outra rubrica: o valor está classificado de forma diferente nas fontes.',
  },
  mes_repetido: {
    rotulo: 'Mesmo valor em dois meses',
    explicacao: 'A rubrica tem o mesmo valor em dois meses na Betha, e a diferença com o TCE-SC é desse valor.',
  },
  despesa_duplicada: {
    rotulo: 'Despesa de consórcio em duas linhas',
    explicacao: 'As linhas de modalidade 71 da Betha somam exatamente a diferença com o TCE-SC nas três etapas.',
  },
  empenho_fantasma: {
    rotulo: 'Registro sem execução e sem par no TCE-SC',
    explicacao: 'O registro está na Betha, sem liquidado, pago ou saldo a pagar, e não tem correspondente no TCE-SC.',
  },
  empenho_repetido: {
    rotulo: 'Registro repetido',
    explicacao: 'Mais de um registro na Betha com o mesmo número, a mesma data e o mesmo valor.',
  },
  empenho_renumerado: {
    rotulo: 'Empenho com outro número na outra fonte',
    explicacao:
      'A outra fonte tem um empenho com a mesma data, o mesmo valor e a mesma identificação, com outro número.',
  },
  empenho_ausente: {
    rotulo: 'Empenho só no TCE-SC',
    explicacao: 'O número do empenho está no TCE-SC e não aparece na Betha.',
  },
  sem_causa: {
    rotulo: 'Diferença sem padrão conhecido',
    explicacao: 'As fontes diferem, e nenhum dos padrões conhecidos explica a diferença.',
  },
};

const ROTULO_SEM_CAUSA: Record<Area, string> = {
  receita: 'Receita com diferença sem padrão conhecido',
  despesa: 'Despesa com diferença sem padrão conhecido',
  empenho: 'Empenho sem par, sem padrão conhecido',
};

export const AGUARDANDO = {
  rotulo: 'Aguardando o TCE-SC',
  explicacao: 'O TCE-SC ainda não recebeu estes meses. O valor entra no conferido quando a remessa chegar.',
};

const centavos = (v: number) => Math.round(v * 100);
const somar = (itens: readonly Item[]) => itens.reduce((total, i) => total + centavos(i.valor), 0) / 100;

/** O que cada caso pesa no grupo, em módulo. Em meses diferentes a soma do ano é zero: pesa o que mudou de mês. */
function valorDe(d: ComPar) {
  if (d.valorDoPar !== undefined) return d.valorDoPar;
  if (d.tipo !== 'mes_diferente') return Math.abs(d.diferenca);
  return Math.max(Math.abs(d.diferencaBetha ?? 0), Math.abs(d.diferencaTce ?? 0));
}

const paraItem = (d: ComPar): Item => ({
  area: d.area,
  situacao: d.situacao,
  data: d.data ?? null,
  evidencia: d.evidencia ?? null,
  entidade: d.entidade,
  codigoEntidade: d.codigoEntidade,
  natureza: d.natureza ?? null,
  descricao: d.descricao ?? null,
  mes: d.mes ?? null,
  meses: d.meses ?? [],
  fonte: d.fonte ?? null,
  numero: d.numero ?? null,
  dataEmpenho: d.dataEmpenho ?? null,
  id: d.id ?? null,
  quantidade: d.quantidade ?? null,
  betha: d.betha,
  tce: d.tce,
  diferenca: d.diferenca,
  diferencaBetha: d.diferencaBetha ?? null,
  diferencaTce: d.diferencaTce ?? null,
  diferencaDaNatureza: d.diferencaDaNatureza ?? null,
  etapas: d.etapas ?? null,
  valor: valorDe(d),
  compensacao: d.compensacao ?? null,
  nota: d.nota,
});

const ehPendencia = (d: DiscrepanciaConferida) => d.tipo === 'aguardando_tce';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mesesDe = (d: DiscrepanciaConferida) =>
  (d.meses ?? [])
    .map((m) => m.mes)
    .sort()
    .join();
const TIPOS_DO_PAR: readonly DiscrepanciaConferida['tipo'][] = ['fora_do_acumulado', 'reclassificacao'];

/** Duas rubricas inteiras, da mesma entidade, situação e meses, com valores exatamente opostos. */
const formamPar = (a: DiscrepanciaConferida, b: DiscrepanciaConferida) =>
  a.area === 'receita' &&
  b.area === 'receita' &&
  TIPOS_DO_PAR.includes(a.tipo) &&
  a.tipo === b.tipo &&
  a.natureza !== b.natureza &&
  a.codigoEntidade === b.codigoEntidade &&
  a.situacao === b.situacao &&
  a.diferencaDaNatureza === undefined &&
  b.diferencaDaNatureza === undefined &&
  a.diferenca !== 0 &&
  centavos(a.diferenca) === -centavos(b.diferenca) &&
  mesesDe(a) === mesesDe(b);

function juntarPar(a: DiscrepanciaConferida, b: DiscrepanciaConferida): ComPar {
  const [aMenos, aMais] = a.diferenca < 0 ? [a, b] : [b, a];
  const acumulado =
    a.tipo === 'fora_do_acumulado' ? ' Na Betha, o arrecadado no mês dessas rubricas não fecha com o acumulado.' : '';
  return {
    ...a,
    tipo: 'reclassificacao',
    natureza: undefined,
    descricao: undefined,
    betha: null,
    tce: null,
    diferenca: 0,
    diferencaBetha: undefined,
    diferencaTce: undefined,
    meses: (a.meses ?? []).map((m) => ({ ...m, betha: null, tce: null, diferenca: 0 })),
    compensacao: {
      aMenos: { natureza: aMenos.natureza ?? '', betha: aMenos.betha, tce: aMenos.tce },
      aMais: { natureza: aMais.natureza ?? '', betha: aMais.betha, tce: aMais.tce },
    },
    valorDoPar: Math.abs(a.diferenca),
    nota: `Em relação ao TCE-SC, a Betha tem ${fmt(Math.abs(a.diferenca))} a menos na rubrica ${aMenos.natureza} e a mais na ${aMais.natureza}: provável reclassificação entre rubricas, sem efeito no total.${acumulado}`,
  };
}

/** Os dois lados de uma compensação são um valor só: pesam uma vez no grupo. */
function juntarCompensacoes(discrepancias: readonly DiscrepanciaConferida[]): ComPar[] {
  const usados = new Set<DiscrepanciaConferida>();
  return discrepancias.flatMap((d): ComPar[] => {
    if (usados.has(d)) return [];
    const par = discrepancias.find((o) => o !== d && !usados.has(o) && formamPar(d, o));
    if (!par) return [d];
    usados.add(d).add(par);
    return [juntarPar(d, par)];
  });
}

/** Um grupo por área e tipo, na ordem da lista: receita, despesa e empenhos não se somam. */
function agrupar(discrepancias: readonly ComPar[]): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const d of discrepancias) {
    if (d.tipo === 'aguardando_tce') continue;
    const chave = `${d.area}|${d.tipo}`;
    const grupo = grupos.get(chave) ?? {
      tipo: TIPO_PUBLICO[d.tipo],
      area: d.area,
      ...TEXTOS[d.tipo],
      ...(d.tipo === 'sem_causa' ? { rotulo: ROTULO_SEM_CAUSA[d.area] } : {}),
      total: 0,
      itens: [],
    };
    grupo.itens.push(paraItem(d));
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].map((g) => ({ ...g, total: somar(g.itens) }));
}

const ROTULO_DA_ETAPA = { empenhado: 'empenhado', liquidado: 'liquidado', pago: 'pago' };
const NOME_DA_FONTE = { dca: 'o SICONFI', tce: 'o TCE-SC' };

function itemDaFuncao(
  entidade: string,
  { etapa, dca, tce, diferenca, maior }: ComparacaoDeFuncoes['etapas'][number],
): Item & { maior: 'dca' | 'tce' } {
  const lado = maior as 'dca' | 'tce';
  return {
    area: 'funcao',
    situacao: 'calculada',
    data: null,
    evidencia: null,
    entidade,
    codigoEntidade: null,
    natureza: null,
    descricao: null,
    mes: null,
    meses: [],
    fonte: null,
    numero: null,
    dataEmpenho: null,
    id: null,
    quantidade: null,
    betha: null,
    tce,
    dca,
    maior: lado,
    diferenca,
    diferencaBetha: null,
    diferencaTce: null,
    diferencaDaNatureza: null,
    etapas: null,
    valor: Math.abs(diferenca),
    compensacao: null,
    nota: `No ${ROTULO_DA_ETAPA[etapa]}, ${NOME_DA_FONTE[lado]} registra ${fmt(Math.abs(diferenca))} a mais.`,
  };
}

/** Um grupo por etapa: empenhado, liquidado e pago nunca se somam. Fora da conta de receita, despesa e empenhos. */
function gruposDasFuncoes(funcoes: ConferenciaDeFuncoes | undefined): Grupo[] {
  if (funcoes?.estado !== 'diferenca') return [];
  const comparacoes = [
    { entidade: 'Total sem a Câmara', comparacao: funcoes.total },
    { entidade: 'Câmara (função Legislativa)', comparacao: funcoes.legislativa },
  ];
  return (['empenhado', 'liquidado', 'pago'] as const).flatMap((etapa): Grupo[] => {
    const itens = comparacoes.flatMap(({ entidade, comparacao }) =>
      comparacao.etapas.filter((e) => e.etapa === etapa && e.maior !== null).map((e) => itemDaFuncao(entidade, e)),
    );
    if (!itens.length) return [];
    return [
      {
        tipo: `funcao_${etapa}`,
        area: 'funcao',
        rotulo: `Despesa por função: ${ROTULO_DA_ETAPA[etapa]}`,
        explicacao:
          'A DCA entregue ao SICONFI e o TCE-SC registram valores diferentes na mesma etapa. O total por função é o número comparado.',
        total: somar(itens),
        itens,
      },
    ];
  });
}

function resumir(grupos: readonly Grupo[]): Discrepancias['resumo'] {
  const itens = grupos.flatMap((g) => g.itens);
  const daSituacao = (situacao: Item['situacao']) => itens.filter((i) => i.situacao === situacao).length;
  const daArea = (area: Area) => {
    const lista = itens.filter((i) => i.area === area);
    return { casos: lista.length, total: somar(lista) };
  };
  return {
    casos: itens.length,
    porSituacao: {
      confirmada_no_portal: daSituacao('confirmada_no_portal'),
      confirmada_em_parte: daSituacao('confirmada_em_parte'),
      calculada: daSituacao('calculada'),
      rever: daSituacao('rever'),
    },
    porArea: { receita: daArea('receita'), despesa: daArea('despesa'), empenho: daArea('empenho') },
  };
}

type Publicado = Pick<Discrepancias, 'ano' | 'parcial' | 'limites'> & {
  discrepancias: readonly DiscrepanciaConferida[];
  funcoes?: ConferenciaDeFuncoes;
};

export function montarSecao({ ano, parcial, limites, discrepancias, funcoes }: Publicado): Discrepancias {
  const grupos = [...agrupar(juntarCompensacoes(discrepancias)), ...gruposDasFuncoes(funcoes)];
  const pendentes = discrepancias.filter(ehPendencia).map(paraItem);
  const daReceita = pendentes.filter((i) => i.area === 'receita');
  const daDespesa = pendentes.filter((i) => i.area === 'despesa');
  return {
    ano,
    disponivel: true,
    parcial,
    limites,
    grupos,
    aguardando: {
      ...AGUARDANDO,
      receita: { total: somar(daReceita), itens: daReceita },
      despesa: {
        total: somar(daDespesa),
        quantidade: daDespesa.reduce((total, i) => total + (i.quantidade ?? 0), 0),
        itens: daDespesa,
      },
    },
    resumo: resumir(grupos),
  };
}

export function secaoIndisponivel(ano: number, faltando: string[]): Discrepancias {
  const vazia = montarSecao({ ano, parcial: null, limites: null, discrepancias: [] });
  return { ...vazia, disponivel: false, faltando };
}
