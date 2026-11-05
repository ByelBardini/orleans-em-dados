// As regras de publicação comuns aos extratores: pequenos grupos, sem dado nunca é zero e os
// símbolos de cada fonte. Tudo devolve texto decimal, para o valor chegar ao NUMERIC sem float.
export const MENOS_DE_5 = 'menos de 5';
const MINIMO_PARA_MEDIANA = 10;
// Até 0,2 ponto: cada taxa vem arredondada na primeira casa.
const TOLERANCIA_DO_RENDIMENTO_EM_DECIMOS = 2;
const SEM_DADO_DO_INEP = new Set(['--', '-', '']);
// No indicador 1.4 (Fundeb não aplicado) e no 7.3 (não utilizado), zero é o valor real.
const ZERO_E_VALOR_NO_SIOPE = new Set(['1.4', '7.3']);

export type Contagem = { valor: string | null; texto: string | null };

export function contagemPublicavel(n: number): Contagem {
  return n > 0 && n < 5 ? { valor: null, texto: MENOS_DE_5 } : { valor: String(n), texto: null };
}

const emReais = (centavos: bigint) => {
  const sinal = centavos < 0n ? '-' : '';
  const abs = centavos < 0n ? -centavos : centavos;
  return `${sinal}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
};

/** Mediana em reais de valores em centavos; com menos de 10 pessoas não é publicada. */
export function medianaPublicavel(centavos: readonly bigint[]): string | null {
  if (centavos.length < MINIMO_PARA_MEDIANA) return null;
  const ordem = [...centavos].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const meio = Math.floor(ordem.length / 2);
  const alto = ordem[meio] as bigint;
  if (ordem.length % 2) return emReais(alto);
  return emReais((alto + (ordem[meio - 1] as bigint) + 1n) / 2n);
}

/** Taxa do INEP: `--` e vazio são falta de dado; texto que não se conhece falha. */
export function taxaDoInep(bruto: unknown): string | null {
  if (bruto === null || bruto === undefined) return null;
  if (typeof bruto === 'number') return String(bruto);
  const texto = String(bruto).trim();
  if (SEM_DADO_DO_INEP.has(texto)) return null;
  const numero = texto.replace(',', '.');
  if (/^-?\d+(\.\d+)?$/.test(numero)) return numero;
  throw new Error(`valor inesperado: ${texto}`);
}

/** Número da fonte em `casas` decimais; `simbolos` são os códigos de sigilo que o arquivo declara. */
export function decimalDaFonte(bruto: unknown, casas: number, simbolos: readonly string[] = []): string | null {
  if (typeof bruto === 'string' && simbolos.includes(bruto.trim())) return null;
  const taxa = taxaDoInep(bruto);
  // Desloca pelo texto: 4000.745 em float vira 4000.74 no toFixed.
  return taxa === null ? null : Number(`${Math.round(Number(`${taxa}e${casas}`))}e-${casas}`).toFixed(casas);
}

function decimalBrasileiro(texto: string): string | null {
  const achado = /^(-?)([\d.]+),(\d{2})$/.exec(texto);
  return achado ? `${achado[1]}${(achado[2] as string).replaceAll('.', '')}.${achado[3]}` : null;
}

const zeroQueNaoFoiCalculado = (codigo: string, decimal: string) =>
  Number(decimal) === 0 && !ZERO_E_VALOR_NO_SIOPE.has(codigo);

export function percentualDoSiope(codigo: string, texto: string): string | null {
  const limpo = texto.trim();
  const decimal = limpo.endsWith('%') ? decimalBrasileiro(limpo.slice(0, -1).trim()) : null;
  if (decimal === null) throw new Error(`percentual inesperado no indicador ${codigo}`);
  return zeroQueNaoFoiCalculado(codigo, decimal) ? null : decimal;
}

export function dinheiroDoSiope(codigo: string, texto: string): string | null {
  const limpo = texto.trim();
  const decimal = limpo.startsWith('R$') ? decimalBrasileiro(limpo.slice(2).trim()) : null;
  if (decimal === null) throw new Error(`valor em reais inesperado no indicador ${codigo}`);
  return zeroQueNaoFoiCalculado(codigo, decimal) ? null : decimal;
}

const emDecimos = (decimal: string) => Math.round(Number(decimal) * 10);

export const somaDoRendimento = (taxas: readonly string[]) => taxas.reduce((soma, t) => soma + emDecimos(t), 0) / 10;

export function rendimentoFecha(aprovacao: string | null, reprovacao: string | null, abandono: string | null): boolean {
  if (aprovacao === null || reprovacao === null || abandono === null) return true;
  const decimos = emDecimos(aprovacao) + emDecimos(reprovacao) + emDecimos(abandono);
  return Math.abs(decimos - 1000) <= TOLERANCIA_DO_RENDIMENTO_EM_DECIMOS;
}
