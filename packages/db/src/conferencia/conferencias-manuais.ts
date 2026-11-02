// O que o usuário conferiu à mão no portal, versionado no git. Cada registro diz se uma discrepância
// calculada foi confirmada. Só o número do protocolo: código de acompanhamento e nome de pessoa nunca.
import type { Discrepancia, TipoDiscrepancia } from './conferencia.bo';

export type SituacaoDaDiscrepancia = 'confirmada_no_portal' | 'calculada' | 'rever';

export type ConferenciaManual = {
  ano: number;
  /** A sigla, como em `Discrepancia.entidade`. */
  entidade: string;
  tipo: TipoDiscrepancia;
  /** Natureza ou número do empenho. `null`: todas as discrepâncias do tipo na entidade, pela soma. */
  chave: string | null;
  /** Em módulo. `null`: confirmado sem um total. */
  valor: number | null;
  situacao: 'confirmada_no_portal';
  evidencia: string;
  /** Quando foi conferido, em AAAA-MM-DD. */
  data: string;
  /** Só o número: `e-SIC 000/0000`. */
  protocolo?: string;
};

export type DiscrepanciaConferida = Discrepancia & {
  situacao: SituacaoDaDiscrepancia;
  data?: string;
  protocolo?: string;
  evidencia?: string;
};

const CAMPOS: ReadonlySet<string> = new Set([
  'ano',
  'entidade',
  'tipo',
  'chave',
  'valor',
  'situacao',
  'evidencia',
  'data',
  'protocolo',
]);
const PROTOCOLO = /^[\p{L}-]+ \d+\/\d{4}$/u;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Devolve o registro, ou recusa dizendo o campo. O erro nunca repete o valor: pode ser um código. */
export function validarConferenciaManual(registro: ConferenciaManual): ConferenciaManual {
  const recusar = (motivo: string) => {
    throw new Error(`Conferência manual recusada (${registro.ano}, ${registro.entidade}): ${motivo}`);
  };
  const estranho = Object.keys(registro).find((campo) => !CAMPOS.has(campo));
  if (estranho) recusar(`campo desconhecido ${estranho}`);
  if (!Number.isInteger(registro.ano)) recusar('ano inválido');
  if (registro.chave === '') recusar('chave vazia');
  if (registro.valor !== null && registro.valor < 0) recusar('valor é em módulo');
  if (!DATA.test(registro.data)) recusar('data fora de AAAA-MM-DD');
  if (!registro.evidencia.trim()) recusar('evidência vazia');
  if (/acompanhamento/i.test(registro.evidencia)) recusar('evidência com código de acompanhamento');
  if (registro.protocolo !== undefined && !PROTOCOLO.test(registro.protocolo)) {
    recusar('protocolo aceita só o canal e o número: <canal> <número>/<ano>');
  }
  return registro;
}

const NO_PORTAL = { situacao: 'confirmada_no_portal', data: '2026-11-01' } as const;
const FORA_DO_ACUMULADO = 'Conferido à mão no portal: lançamento que o acumulado da rubrica desconsidera.';
const DUAS_RUBRICAS = 'Conferido à mão no portal: o mesmo valor lançado em duas rubricas.';
const SO_TCE = 'Conferido à mão no portal: a natureza só aparece no TCE-SC. Pedido de informação registrado.';
const E_SIC = 'e-SIC 000/0000';

export const CONFERENCIAS_MANUAIS: readonly ConferenciaManual[] = (
  [
    {
      ano: 2025,
      entidade: 'SAMAE',
      tipo: 'fora_do_acumulado',
      chave: '22130101',
      valor: 32900,
      evidencia: FORA_DO_ACUMULADO,
    },
    {
      ano: 2025,
      entidade: 'FMS',
      tipo: 'fora_do_acumulado',
      chave: '17135011',
      valor: 306503.9,
      evidencia: FORA_DO_ACUMULADO,
    },
    {
      ano: 2025,
      entidade: 'FMS',
      tipo: 'fora_do_acumulado',
      chave: '24145001',
      valor: 250000,
      evidencia: FORA_DO_ACUMULADO,
    },
    {
      ano: 2024,
      entidade: 'Prefeitura',
      tipo: 'duas_rubricas',
      chave: '17115131',
      valor: 1135545.25,
      evidencia: DUAS_RUBRICAS,
    },
    {
      ano: 2026,
      entidade: 'Prefeitura',
      tipo: 'duas_rubricas',
      chave: '24149901',
      valor: 895500,
      evidencia: DUAS_RUBRICAS,
    },
    {
      ano: 2026,
      entidade: 'Prefeitura',
      tipo: 'duas_rubricas',
      chave: '13210300',
      valor: null,
      evidencia: `${DUAS_RUBRICAS} Conferência parcial, sem um total confirmado; exemplo conferido: R$ 66.113,49.`,
    },
    {
      ano: 2024,
      entidade: 'SAMAE',
      tipo: 'despesa_duplicada',
      chave: null,
      valor: 123887.32,
      evidencia: 'Conferido à mão no portal: despesa de consórcio em duas linhas da 57170.',
    },
    {
      ano: 2025,
      entidade: 'SAMAE',
      tipo: 'empenho_fantasma',
      chave: '340',
      valor: 20000,
      evidencia: 'Conferido à mão no portal: empenho sem correspondente no TCE-SC e sem execução.',
    },
    {
      ano: 2025,
      entidade: 'SAMAE',
      tipo: 'empenho_repetido',
      chave: '342',
      valor: 48.72,
      evidencia: 'Conferido à mão no portal: registro repetido do mesmo empenho.',
    },
    {
      ano: 2024,
      entidade: 'SAMAE',
      tipo: 'empenho_ausente',
      chave: null,
      valor: 143934.18,
      evidencia: 'Conferido à mão no portal: grupo de empenhos com números que só aparecem no TCE-SC.',
    },
    {
      ano: 2025,
      entidade: 'SAMAE',
      tipo: 'so_tce',
      chave: '11130311',
      valor: 428717.37,
      evidencia: SO_TCE,
      protocolo: E_SIC,
    },
    {
      ano: 2026,
      entidade: 'SAMAE',
      tipo: 'so_tce',
      chave: '11130311',
      valor: 414748.48,
      evidencia: SO_TCE,
      protocolo: E_SIC,
    },
  ] as const
).map((caso) => validarConferenciaManual({ ...NO_PORTAL, ...caso }));

const centavos = (v: number) => Math.round(v * 100);

const chaveDa = (d: Discrepancia) => d.natureza ?? (d.numero === undefined || d.numero === null ? null : `${d.numero}`);

const corresponde = (r: ConferenciaManual, d: Discrepancia) =>
  r.entidade === d.entidade && r.tipo === d.tipo && (r.chave === null || r.chave === chaveDa(d));

/** Diz, para cada discrepância do ano, se é hipótese do cálculo ou se foi confirmada à mão. O valor
 *  que mudou depois da confirmação fica `rever`. Registro que não acha o caso é só um aviso interno:
 *  a fonte pode ter sido retificada, e isso não pode derrubar a página. */
export function cruzarConferenciasManuais(
  ano: number,
  discrepancias: readonly Discrepancia[],
  registros: readonly ConferenciaManual[] = CONFERENCIAS_MANUAIS,
) {
  const avisos: string[] = [];
  const achados = new Map<Discrepancia, { registro: ConferenciaManual; situacao: SituacaoDaDiscrepancia }>();
  for (const registro of registros.filter((r) => r.ano === ano)) {
    const nome = `${registro.ano}, ${registro.entidade}, ${registro.tipo}, ${registro.chave ?? 'grupo'}`;
    const alvos = discrepancias.filter((d) => corresponde(registro, d));
    if (!alvos.length) {
      avisos.push(`Registro manual sem discrepância: ${nome}.`);
      continue;
    }
    const soma = alvos.reduce((total, d) => total + Math.abs(centavos(d.diferenca)), 0);
    const mudou = registro.valor !== null && centavos(registro.valor) !== soma;
    if (mudou) {
      avisos.push(`Registro manual com valor diferente: ${nome}: confirmado ${registro.valor}, agora ${soma / 100}.`);
    }
    for (const alvo of alvos) achados.set(alvo, { registro, situacao: mudou ? 'rever' : registro.situacao });
  }
  return {
    avisos,
    discrepancias: discrepancias.map((d): DiscrepanciaConferida => {
      const achado = achados.get(d);
      if (!achado) return { ...d, situacao: 'calculada' };
      const { data, protocolo, evidencia } = achado.registro;
      return { ...d, situacao: achado.situacao, data, evidencia, ...(protocolo ? { protocolo } : {}) };
    }),
  };
}
