// Quando um dado está atrasado. Atraso só conta depois de duas janelas da periodicidade:
// uma rodada perdida de madrugada não acende o aviso. Exercício mais antigo que o anterior
// não tem rodada agendada, então nunca fica atrasado.
export type Frequencia = 'diaria' | 'mensal' | 'anual';

export type Periodicidade = { exercicioCorrente: Frequencia; exercicioAnterior: Frequencia };

export type SituacaoDaAtualizacao = {
  situacao: 'em_dia' | 'atrasado' | 'historico' | 'sem_dado';
  ultimaExtracao: string | null;
};

const DIA_MS = 86_400_000;
const JANELA_MS: Record<Frequencia, number> = { diaria: DIA_MS, mensal: 30 * DIA_MS, anual: 365 * DIA_MS };
const JANELAS_DE_TOLERANCIA = 2;

export function situacaoDaAtualizacao(
  periodicidade: Periodicidade,
  ano: number,
  ultimaExtracao: string | null,
  agora: Date,
): SituacaoDaAtualizacao {
  if (ultimaExtracao === null) return { situacao: 'sem_dado', ultimaExtracao };

  const extraidoEm = new Date(ultimaExtracao).getTime();
  if (Number.isNaN(extraidoEm)) {
    throw new Error(`Data de extração inválida: ${ultimaExtracao}; esperado instante ISO 8601`);
  }

  const corrente = agora.getUTCFullYear();
  if (ano < corrente - 1) return { situacao: 'historico', ultimaExtracao };

  const frequencia = ano >= corrente ? periodicidade.exercicioCorrente : periodicidade.exercicioAnterior;
  const atrasado = agora.getTime() - extraidoEm > JANELAS_DE_TOLERANCIA * JANELA_MS[frequencia];
  return { situacao: atrasado ? 'atrasado' : 'em_dia', ultimaExtracao };
}
