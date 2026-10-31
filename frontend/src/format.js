const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat('pt-BR');
const umaCasa = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const duasCasas = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const moeda = (v) => (v === null || v === undefined ? '—' : brl.format(v));
export const moedaCompacta = (v) => (v === null || v === undefined ? '—' : `R$ ${compacto.format(v)}`);
export const numero = (v) => inteiro.format(v);
export const decimal = (v) => duasCasas.format(v);
export const percentual = (parte, total) =>
  total ? `${((parte / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—';

// Milhões com uma casa, sem unidade: 171092955.92 → "171,1".
export const milhoes = (v) => umaCasa.format(Number(v) / 1e6);
export const emMilhoes = (v) => `R$ ${milhoes(v)} mi`;
export const porExtenso = (v) => `R$ ${milhoes(v)} milhões`;
export const pct = (parte, total, casas = 1) =>
  total ? `${((parte / total) * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%` : '—';

export const data = (iso) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');
export const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
export const dataCurta = (iso) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'para', 'por']);
const SIGLAS = new Set(['SAMAE', 'INSS', 'SUS', 'FPM', 'ICMS', 'IPVA', 'ISS', 'ISSQN', 'IPTU', 'ITBI', 'FUNDEB', 'LTDA', 'ME', 'EPP', 'S.A.', 'SA', 'AMREC', 'CISAMREC', 'II', 'III']);

// Textos da Betha vêm em caixa alta: "SECRETARIA MUNICIPAL DE EDUCAÇÃO" → "Secretaria Municipal de Educação".
export function nomeProprio(texto) {
  if (!texto) return texto;
  return texto
    .split(/(\s+|-|\/)/)
    .map((p, i) => {
      if (!p.trim() || p === '-' || p === '/') return p;
      const sup = p.toUpperCase();
      if (SIGLAS.has(sup.replace(/[.,]$/, ''))) return sup;
      const min = p.toLocaleLowerCase('pt-BR');
      if (i > 0 && MINUSCULAS.has(min)) return min;
      return min.charAt(0).toLocaleUpperCase('pt-BR') + min.slice(1);
    })
    .join('');
}
