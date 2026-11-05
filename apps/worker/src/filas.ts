// Cada importador é uma fila do pg-boss com o agendamento da própria declaração.
// A entrega é at-least-once: o executor garante que repetir não duplica dado.
import type { Importador } from '@orleans-em-dados/importador-nucleo';
import type { PgBoss } from 'pg-boss';

export const FUSO = 'America/Sao_Paulo';

export const nomeDaFila = (importador: Importador) => `importador-${importador.id}`;

export type OpcoesDasFilas = {
  retryLimit?: number;
  /** Segundos até a primeira repetição. */
  retryDelay?: number;
  retryBackoff?: boolean;
  /** Tempo máximo de uma rodada antes de ser dada como perdida. */
  expireInSeconds?: number;
  pollingIntervalSeconds?: number;
};

const PADRAO = { retryLimit: 3, retryDelay: 600, retryBackoff: true, expireInSeconds: 3600 };

export async function montarFilas(
  boss: PgBoss,
  importadores: readonly Importador[],
  rodar: (importador: Importador) => Promise<unknown>,
  opcoes: OpcoesDasFilas = {},
): Promise<void> {
  const { pollingIntervalSeconds, ...fila } = { ...PADRAO, ...opcoes };
  for (const importador of importadores) {
    // Sem agenda, a carga é por arquivo (`pnpm importar --arquivo`): não há rodada para enfileirar.
    if (!importador.agenda) continue;
    const nome = nomeDaFila(importador);
    // Singleton: no máximo uma rodada ativa por importador. As duas chamadas são idempotentes.
    await boss.createQueue(nome, { policy: 'singleton', ...fila });
    await boss.schedule(nome, importador.agenda, null, { tz: FUSO });
    // Handler que engole o erro contaria como sucesso, sem repetição: `rodar` tem de relançar.
    await boss.work(nome, pollingIntervalSeconds ? { pollingIntervalSeconds } : {}, async () => {
      await rodar(importador);
    });
  }
}
