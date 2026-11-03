// Cada indicador do dashboard, declarado num lugar só: de onde vem, contra o que é
// conferido e com que frequência deve atualizar. Indicador novo começa aqui (especificação §7.1).
import type { Periodicidade } from './atraso';

export type Indicador = {
  id: string;
  nome: string;
  /** Importador que coleta a fonte preferida. */
  importador: string;
  /** Consulta da fonte preferida, em `consultas.id`. */
  consultaId: number;
  /** Consulta da outra fonte que confere este indicador; nulo se não houver. */
  conferidoContra: number | null;
  periodicidade: Periodicidade;
};

const RODADA_DIARIA: Periodicidade = { exercicioCorrente: 'diaria', exercicioAnterior: 'mensal' };
const RODADA_MENSAL: Periodicidade = { exercicioCorrente: 'mensal', exercicioAnterior: 'mensal' };

export const INDICADORES: Indicador[] = [
  {
    id: 'receita-arrecadada',
    nome: 'Receita arrecadada por mês e natureza',
    importador: 'betha',
    consultaId: 57153,
    conferidoContra: 900001,
    periodicidade: RODADA_DIARIA,
  },
  {
    id: 'receita-orcada-atualizada',
    nome: 'Receita orçada atualizada',
    importador: 'betha',
    consultaId: 57153,
    // A "prevista" do TCE-SC tem outro conceito: não são comparadas diretamente.
    conferidoContra: null,
    periodicidade: RODADA_DIARIA,
  },
  {
    id: 'empenhos-individualizados',
    nome: 'Empenhos individualizados',
    importador: 'betha',
    consultaId: 57140,
    conferidoContra: 900002,
    periodicidade: RODADA_DIARIA,
  },
  {
    id: 'despesa-empenhada-liquida',
    nome: 'Despesa empenhada líquida de anulações',
    importador: 'betha',
    consultaId: 57170,
    conferidoContra: 900002,
    periodicidade: RODADA_DIARIA,
  },
  {
    id: 'despesa-liquidada-paga',
    nome: 'Despesa liquidada e paga',
    importador: 'betha',
    consultaId: 57170,
    conferidoContra: 900002,
    periodicidade: RODADA_DIARIA,
  },
  {
    id: 'despesa-camara',
    nome: 'Despesa da Câmara Municipal',
    importador: 'tcesc',
    consultaId: 900002,
    // A Câmara não está no portal Betha da Prefeitura.
    conferidoContra: null,
    periodicidade: RODADA_DIARIA,
  },
  {
    id: 'populacao',
    nome: 'População: estimativas e censos',
    importador: 'ibge',
    consultaId: 900101,
    conferidoContra: null,
    periodicidade: RODADA_MENSAL,
  },
  {
    id: 'censo',
    nome: 'Censo 2022: território, situação do domicílio, pirâmide etária e rendimento',
    importador: 'ibge',
    consultaId: 900102,
    conferidoContra: null,
    periodicidade: RODADA_MENSAL,
  },
  {
    id: 'pib',
    nome: 'PIB e composição do valor adicionado',
    importador: 'ibge',
    consultaId: 900103,
    conferidoContra: null,
    periodicidade: RODADA_MENSAL,
  },
  {
    id: 'comparacao',
    nome: 'Brasil e Santa Catarina: população, Censo 2022 e PIB, para a comparação com Orleans',
    importador: 'ibge',
    consultaId: 900104,
    conferidoContra: null,
    periodicidade: RODADA_MENSAL,
  },
  {
    id: 'despesa-por-funcao-total',
    nome: 'Total da despesa por função, sem a Câmara, e função Legislativa',
    importador: 'siconfi',
    consultaId: 900201,
    conferidoContra: 900002,
    periodicidade: RODADA_MENSAL,
  },
  {
    id: 'despesa-por-funcao-divisao',
    nome: 'Divisão da despesa por função e subfunção',
    importador: 'siconfi',
    consultaId: 900201,
    // O TCE-SC coletado não tem o recorte por função.
    conferidoContra: null,
    periodicidade: RODADA_MENSAL,
  },
];

type ConsultaConhecida = { id: number; importador: string };

/** Problemas do registro em relação às consultas que os importadores coletam. Vazio = coerente. */
export function validarRegistro(indicadores: readonly Indicador[], conhecidas: readonly ConsultaConhecida[]): string[] {
  const problemas: string[] = [];
  const vistos = new Set<string>();
  for (const { id, importador, consultaId, conferidoContra } of indicadores) {
    if (vistos.has(id)) problemas.push(`${id}: id repetido`);
    vistos.add(id);

    const consulta = conhecidas.find((c) => c.id === consultaId);
    if (!consulta) problemas.push(`${id}: a consulta ${consultaId} não tem importador declarado`);
    else if (consulta.importador !== importador) {
      problemas.push(`${id}: a consulta ${consultaId} é do importador ${consulta.importador}, não de ${importador}`);
    }
    if (conferidoContra !== null && !conhecidas.some((c) => c.id === conferidoContra)) {
      problemas.push(`${id}: a conferência aponta para a consulta ${conferidoContra}, sem importador declarado`);
    }
  }
  return problemas;
}
