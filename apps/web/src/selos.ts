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
  titulo: `conferido com o Portal da Transparência até ${diaEMes(dataCorte)}`,
  motivo: 'Valores do TCE-SC.',
});

// Um total que tem par na Betha, sem corte: a função 12 da DCA igual à soma das ações de educação.
export const SELO_CONFERIDO_COM_A_BETHA: DadosDoSelo = {
  estado: 'confere',
  titulo: 'conferido com o Portal da Transparência',
};

export const SELO_FONTE_UNICA: DadosDoSelo = { estado: 'fonte-unica', titulo: 'fonte única, sem conferência' };

// Um termo do bloco: o gasto (sem nome) ou uma parcela da conta ("recebido", "contribuição"), com os anos que mostra
// e os que foram conferidos.
export type AnosDoTermo = {
  nome?: string;
  anos: readonly (number | string)[];
  conferidos: readonly (number | string)[];
};

const emLista = (itens: readonly (number | string)[]) =>
  new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(itens.map(String));
const comMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

// O selo de um bloco inteiro, no título: um selo só no lugar de um por ano ou por termo. O título diz o que foi
// conferido e em que anos; o motivo diz o que fica em fonte única. Sem nada conferido, é fonte única.
export function seloPorAnos(
  conferidoCom: string,
  termos: readonly AnosDoTermo[],
  foraDaConferencia: readonly string[] = [],
): DadosDoSelo {
  const comConferido = termos.filter((t) => t.conferidos.length > 0);
  if (!comConferido.length) return SELO_FONTE_UNICA;
  const titulo = comConferido
    .map((t, i) => {
      const quem = t.nome ? `${t.nome} ` : '';
      return i === 0
        ? `${quem}conferido com ${conferidoCom} em ${emLista(t.conferidos)}`
        : `${quem}em ${emLista(t.conferidos)}`;
    })
    .join('; ');
  const resto = [
    ...termos.flatMap((t) => {
      if (t.conferidos.length === t.anos.length) return [];
      if (!t.nome) return ['Demais anos: fonte única.'];
      return t.conferidos.length
        ? [`${comMaiuscula(t.nome)}, nos demais anos: fonte única.`]
        : [`${comMaiuscula(t.nome)}: fonte única.`];
    }),
    ...foraDaConferencia.map((nome) => `${comMaiuscula(nome)}: fonte única.`),
  ];
  return { estado: 'confere', titulo, ...(resto.length ? { motivo: resto.join(' ') } : {}) };
}

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
