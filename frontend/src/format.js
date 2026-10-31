const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat('pt-BR');

export const moeda = (v) => (v === null || v === undefined ? '—' : brl.format(v));
export const moedaCompacta = (v) => (v === null || v === undefined ? '—' : `R$ ${compacto.format(v)}`);
export const numero = (v) => inteiro.format(v);
export const percentual = (parte, total) =>
  total ? `${((parte / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—';

export const data = (iso) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');
export const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
