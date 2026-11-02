// O somatório dos registros tem de reproduzir, ao centavo, o totalizador da própria consulta.
import { centavos, deCentavos, dinheiro, type Dinheiro } from '@orleans-em-dados/contracts';
import type { Coleta, ItemDeConferencia, Validacao } from '@orleans-em-dados/importador-nucleo';

type Totalizador = { campo: string; valor: number | string; titulo?: string; descricao?: string };

const vazio = (v: unknown) => v === null || v === undefined;

// O totalizador vem como float e pode trazer resíduo (170915184.25000012).
const noCentavo = (valor: number | string): Dinheiro => deCentavos(BigInt(Math.round(Number(valor) * 100)));

function conferirCampo(
  coleta: Coleta,
  campo: string,
  totais: readonly Totalizador[],
  erros: string[],
): ItemDeConferencia {
  const soma = coleta.registros.reduce(
    (total, registro) =>
      vazio(registro[campo]) ? total : total + centavos(dinheiro(registro[campo] as number | string)),
    0n,
  );
  const calculado = deCentavos(soma);
  const total = totais.find((t) => t.campo === campo);
  if (!total) {
    erros.push(`totalizador ausente para ${campo}`);
    return { campo, fonte: null, calculado, diferenca: null };
  }
  const fonte = noCentavo(total.valor);
  const diferenca = deCentavos(soma - centavos(fonte));
  if (centavos(diferenca) !== 0n) erros.push(`${campo}: diferença de ${diferenca} em relação ao totalizador`);
  return { campo, titulo: total.titulo, descricao: total.descricao, fonte, calculado, diferenca };
}

export const validarPorTotalizador =
  (campos: readonly string[]) =>
  (coleta: Coleta): Validacao => {
    const totais = (coleta.extras as { totalizadores?: Totalizador[] } | undefined)?.totalizadores ?? [];
    const erros: string[] = [];
    const conferencia = campos.map((campo) => conferirCampo(coleta, campo, totais, erros));
    return { conferencia, erros };
  };

/** Quantos registros vieram sem cada campo: ausência é contada, nunca somada como zero. */
export function contarAusentes(registros: readonly object[], campos: readonly string[]): Record<string, number> {
  return Object.fromEntries(
    campos.map((campo) => [campo, registros.filter((r) => vazio((r as Record<string, unknown>)[campo])).length]),
  );
}
