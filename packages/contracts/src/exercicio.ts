// Ano de exercício: inteiro de quatro dígitos.
import { z } from 'zod';

export type Exercicio = number & { readonly __marca: 'Exercicio' };

export function exercicio(valor: unknown): Exercicio {
  const ano = typeof valor === 'string' && valor !== '' ? Number(valor) : valor;
  if (typeof ano !== 'number' || !Number.isInteger(ano) || ano < 1000 || ano > 9999) {
    throw new Error(`Exercício inválido: ${String(valor)}; esperado ano com quatro dígitos`);
  }
  return ano as Exercicio;
}

export const exercicioSchema = z.unknown().transform((valor, contexto): Exercicio => {
  try {
    return exercicio(valor);
  } catch (erro) {
    contexto.addIssue({ code: 'custom', message: (erro as Error).message });
    return z.NEVER;
  }
});
