// Correção pela inflação: o valor de um ano vai para reais do ano-base pela razão entre as médias anuais do IPCA
// (número-índice da tabela 1737). Ano-base é o último com os 12 meses publicados; ano incompleto não tem média.
// A conta é em inteiros: índice em milésimos (a escala do banco) e valor em centavos, arredondado só no fim.

export type MesDoIpca = { periodo: string; valor: number | null };

const MESES = 12;

/** Soma dos 12 índices do ano, em milésimos; nula se faltar algum mês. */
function somaDoAno(serie: readonly MesDoIpca[], ano: number): bigint | null {
  const meses = serie.filter((m) => m.periodo.startsWith(String(ano)) && m.periodo.length === 6);
  if (meses.length !== MESES || meses.some((m) => m.valor === null)) return null;
  return meses.reduce((soma, m) => soma + BigInt(Math.round(m.valor! * 1000)), 0n);
}

export function mediaDoAno(serie: readonly MesDoIpca[], ano: number): number | null {
  const soma = somaDoAno(serie, ano);
  return soma === null ? null : Number(soma) / 1000 / MESES;
}

export function anoBase(serie: readonly MesDoIpca[]): number | null {
  const anos = [...new Set(serie.map((m) => Number(m.periodo.slice(0, 4))))].sort((a, b) => b - a);
  return anos.find((ano) => somaDoAno(serie, ano) !== null) ?? null;
}

/** Valor em reais do ano `ano` levado a reais do ano-base; nulo sem valor, sem base ou com o ano incompleto. */
export function corrigir(valor: number | null, ano: number, serie: readonly MesDoIpca[]): number | null {
  const base = anoBase(serie);
  if (valor === null || base === null) return null;
  const doAno = somaDoAno(serie, ano);
  const daBase = somaDoAno(serie, base)!;
  if (doAno === null) return null;
  const centavos = BigInt(Math.round(valor * 100));
  // Arredonda meio centavo para cima (valores de gasto são positivos).
  const corrigidos = (centavos * daBase * 2n + doAno) / (doAno * 2n);
  return Number(corrigidos) / 100;
}
