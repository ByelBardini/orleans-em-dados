// Código de rubrica ou natureza é sempre texto: como número, perderia os zeros à esquerda.
import { z } from 'zod';

export type CodigoRubrica = string & { readonly __marca: 'CodigoRubrica' };

export function codigoRubrica(valor: unknown): CodigoRubrica {
  if (typeof valor !== 'string' || !/^\d[\d.]*$/.test(valor)) {
    throw new Error(`Código de rubrica inválido: ${String(valor)}; esperado texto com dígitos e pontos`);
  }
  return valor as CodigoRubrica;
}

export const rubricaSchema = z.unknown().transform((valor, contexto): CodigoRubrica => {
  try {
    return codigoRubrica(valor);
  } catch (erro) {
    contexto.addIssue({ code: 'custom', message: (erro as Error).message });
    return z.NEVER;
  }
});
