// A janela do histórico: os exercícios que a carga completa, por consulta. A agenda cuida do corrente e
// do anterior; a janela é o que o painel deve ter desde a primeira subida.

export const ANOS_DE_HISTORICO_PADRAO = 10;

/** `ANOS_DE_HISTORICO` do ambiente: inteiro de 0 em diante. Vazio ou inválido vira o padrão. */
export function anosDeHistorico(valor: string | undefined): number {
  return valor !== undefined && /^\d+$/.test(valor) ? Number(valor) : ANOS_DE_HISTORICO_PADRAO;
}

/**
 * Do exercício corrente menos `janela` até `ultimo` (padrão: o corrente), em ordem crescente, sem começar
 * antes de `primeiro`, o primeiro exercício que a fonte publica.
 */
export function janelaDeAnos(
  agora: Date,
  janela: number,
  { primeiro, ultimo }: { primeiro?: number; ultimo?: number } = {},
): number[] {
  const corrente = agora.getUTCFullYear();
  const de = Math.max(corrente - janela, primeiro ?? -Infinity);
  const ate = ultimo ?? corrente;
  const anos: number[] = [];
  for (let ano = de; ano <= ate; ano++) anos.push(ano);
  return anos;
}
