// O que a série do IDEB diz de si mesma, sem DOM. A frase de cada rede sai daqui: o que vale para a pública não vale para a municipal.
import { formatarValor, type PontoDaSerie } from '../educacao';

const comValor = (pontos: readonly PontoDaSerie[]) =>
  pontos.flatMap((p) => (p.valor === null ? [] : [{ ano: p.ano, valor: p.valor }]));

/** O último ano da série, se ele tem dado e supera todos os outros. Empate não é "melhor", e um ano só não é série. */
export function melhorDaSerie(pontos: readonly PontoDaSerie[]) {
  const ultimo = pontos.at(-1);
  const presentes = comValor(pontos);
  if (!ultimo || ultimo.valor === null || presentes.length < 2) return null;
  const valor = ultimo.valor;
  const superaOsOutros = presentes.every((p) => p.ano === ultimo.ano || p.valor < valor);
  return superaOsOutros ? { ano: ultimo.ano, valor } : null;
}

const emTexto = (valor: number) => formatarValor(valor, 'indice');

export function fraseDaSerie(pontos: readonly PontoDaSerie[]): string | null {
  const presentes = comValor(pontos);
  const recente = presentes.at(-1);
  if (!recente) return null;
  if (pontos.at(-1)?.valor === null) return `Último dado: ${emTexto(recente.valor)}, em ${recente.ano}.`;
  if (presentes.length === 1) return `${emTexto(recente.valor)} em ${recente.ano}, o único ano com dado.`;
  if (melhorDaSerie(pontos)) return `${emTexto(recente.valor)} em ${recente.ano}, o melhor IDEB da série.`;
  const maior = presentes.reduce((a, p) => (p.valor >= a.valor ? p : a));
  return `${emTexto(recente.valor)} em ${recente.ano}. O melhor da série foi ${emTexto(maior.valor)}, em ${maior.ano}.`;
}
