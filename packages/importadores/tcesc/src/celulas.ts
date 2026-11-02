// Células do motor Qlik. Nulo no Qlik é qIsNull, ou qText '-' com qNum 'NaN'.
export type CelulaQlik = { qText?: string; qNum?: number | 'NaN'; qIsNull?: boolean };

/** O motor devolve double (170915184.25000012): converte para centavos inteiros e
 *  devolve nulo se o valor não estiver praticamente sobre um centavo inteiro. */
export function centavosDoMotor(qNum: unknown): bigint | null {
  if (typeof qNum !== 'number' || !Number.isFinite(qNum)) return null;
  const c = qNum * 100;
  const r = Math.round(c);
  return Math.abs(c - r) < 1e-3 ? BigInt(r) : null;
}

export function textoDaCelula(celula: CelulaQlik): string | null {
  return celula.qIsNull || celula.qText === undefined || celula.qText === '-' ? null : celula.qText;
}
