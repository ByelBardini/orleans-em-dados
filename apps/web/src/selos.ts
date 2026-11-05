// A regra dos selos, sem DOM: o nível da conferência de um número e o atraso da coleta.
import { INDICADORES, situacaoDaAtualizacao, type Importacoes } from '@orleans-em-dados/contracts';
import { data, dataCurta, diaEMes, MESES_LONGOS } from './format';

export type DadosDoSelo = {
  estado: 'confere' | 'pendente' | 'fonte-unica';
  titulo: string;
  motivo?: string | null;
};

// O nível da conferência de um número. Igualdade entre fontes não é auditoria: o texto diz com o que
// foi conferido, e nunca "validado". Atraso do TCE-SC é pendência, sem linguagem de erro.
export const seloConferidoComTce = (ateMes?: number | null): DadosDoSelo => ({
  estado: 'confere',
  titulo: `conferido com o TCE-SC${ateMes ? ` até ${MESES_LONGOS[ateMes - 1]}` : ''}`,
});

export const seloConferidoComBetha = (dataCorte: string | null): DadosDoSelo => ({
  estado: 'confere',
  titulo: `conferido com a Betha até ${diaEMes(dataCorte)}`,
  motivo: 'Valores do TCE-SC.',
});

// Um total que tem par na Betha, sem corte: a função 12 da DCA igual à soma das ações de educação.
export const SELO_CONFERIDO_COM_A_BETHA: DadosDoSelo = { estado: 'confere', titulo: 'conferido com a Betha' };

export const SELO_FONTE_UNICA: DadosDoSelo = { estado: 'fonte-unica', titulo: 'fonte única, sem conferência' };

export const SELO_EXEMPLO: DadosDoSelo = { estado: 'pendente', titulo: 'dados fictícios, sem conferência' };

export const seloAguardando = (motivo?: string): DadosDoSelo => ({
  estado: 'pendente',
  titulo: 'aguardando TCE',
  ...(motivo ? { motivo } : {}),
});

// O que se sabe de um caso da seção: conferido à mão, em parte, só calculado, ou a rever.
export type SituacaoDoCaso = 'confirmada_no_portal' | 'confirmada_em_parte' | 'calculada' | 'rever';

const NA_SITUACAO: Record<SituacaoDoCaso, Pick<DadosDoSelo, 'estado' | 'titulo'>> = {
  confirmada_no_portal: { estado: 'confere', titulo: 'Confirmado no portal' },
  confirmada_em_parte: { estado: 'pendente', titulo: 'Confirmado em parte' },
  calculada: { estado: 'fonte-unica', titulo: 'Calculado (provável)' },
  rever: { estado: 'pendente', titulo: 'Rever' },
};

export function seloDaSituacao(situacao: SituacaoDoCaso, conferidoEm?: string | null): DadosDoSelo {
  const { estado, titulo } = NA_SITUACAO[situacao];
  const comData = situacao === 'confirmada_no_portal' && conferidoEm ? `${titulo} em ${data(conferidoEm)}` : titulo;
  return { estado, titulo: comData };
}

// A despesa: no ano em curso, valores do TCE-SC conferidos com a Betha até o corte.
export const seloDaDespesa = (conferencia: {
  parcial: boolean | null;
  limites: { dataEmpenho: string | null } | null;
}): DadosDoSelo =>
  conferencia.parcial ? seloConferidoComBetha(conferencia.limites?.dataEmpenho ?? null) : seloConferidoComTce();

// Dado que passou da periodicidade do indicador: fica ao lado do selo de conferência, não no lugar dele.
export function seloDeAtraso(
  importacoes: Importacoes | null,
  idDoIndicador: string,
  ano: number,
  agora: Date,
): DadosDoSelo | null {
  const indicador = INDICADORES.find((i) => i.id === idDoIndicador);
  const importador = importacoes?.importadores.find((i) => i.id === indicador?.importador);
  if (!indicador || !importador) return null;
  const ultimaExtracao = importador.exercicios.find((e) => e.ano === ano)?.atualizadoEm ?? null;
  const { situacao } = situacaoDaAtualizacao(indicador.periodicidade, ano, ultimaExtracao, agora);
  if (situacao !== 'atrasado') return null;
  return { estado: 'pendente', titulo: 'Dado atrasado', motivo: `Última atualização em ${dataCurta(ultimaExtracao)}.` };
}
