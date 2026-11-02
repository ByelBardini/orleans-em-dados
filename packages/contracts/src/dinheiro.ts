// Dinheiro é texto decimal com duas casas ("1234.56"); conta se faz em centavos
// inteiros (bigint). Nunca passa por soma de float.
import { z } from 'zod';

export type Dinheiro = string & { readonly __marca: 'Dinheiro' };

const DECIMAL = /^-?\d+(\.\d{1,2})?$/;

/** Aceita texto decimal ou o número que a fonte devolveu, desde que tenha até duas casas.
 *
 *  Exemplo: `dinheiro(250000.5) // '250000.50'` */
export function dinheiro(valor: string | number): Dinheiro {
  const texto = typeof valor === 'number' ? String(valor) : valor;
  if (!DECIMAL.test(texto)) {
    throw new Error(`Valor monetário inválido: ${JSON.stringify(texto)}; esperado decimal com até duas casas`);
  }
  const negativo = texto.startsWith('-');
  const [inteiro = '0', fracao = ''] = texto.replace('-', '').split('.');
  const absoluto = BigInt(inteiro) * 100n + BigInt(fracao.padEnd(2, '0'));
  return deCentavos(negativo ? -absoluto : absoluto);
}

export function centavos(valor: Dinheiro): bigint {
  const negativo = valor.startsWith('-');
  const absoluto = BigInt(valor.replace('-', '').replace('.', ''));
  return negativo ? -absoluto : absoluto;
}

export function deCentavos(valor: bigint): Dinheiro {
  const absoluto = valor < 0n ? -valor : valor;
  const reais = absoluto / 100n;
  const fracao = String(absoluto % 100n).padStart(2, '0');
  return `${valor < 0n ? '-' : ''}${reais}.${fracao}` as Dinheiro;
}

export function somar(valores: readonly Dinheiro[]): Dinheiro {
  return deCentavos(valores.reduce((total, valor) => total + centavos(valor), 0n));
}

export const dinheiroSchema = z.union([z.string(), z.number()]).transform((valor, contexto): Dinheiro => {
  try {
    return dinheiro(valor);
  } catch (erro) {
    contexto.addIssue({ code: 'custom', message: (erro as Error).message });
    return z.NEVER;
  }
});
