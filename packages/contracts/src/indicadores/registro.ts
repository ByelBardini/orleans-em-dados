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
// O dado muda uma vez por ano, ou nunca (Censo): a rodada mensal do IBGE só o reconfirma.
const RODADA_ANUAL: Periodicidade = { exercicioCorrente: 'anual', exercicioAnterior: 'anual' };

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
    id: 'educacao-censo',
    nome: 'Censo: alfabetização, frequência escolar, instrução e local da escola',
    importador: 'ibge',
    consultaId: 900105,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'educacao-comparacao',
    nome: 'Brasil e Santa Catarina: Censo de educação, para a comparação com Orleans',
    importador: 'ibge',
    consultaId: 900106,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'rede-escolar',
    nome: 'IDEB, matrículas, docentes e escolas',
    importador: 'ibge',
    consultaId: 900107,
    // O IBGE republica o INEP: comparar os dois não é conferência entre fontes independentes.
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
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
  // Do RREO: a fonte preferida destes índices é o SIOPE, e a diferença vai para Discrepâncias.
  {
    id: 'indice-educacao-rreo',
    nome: 'Mínimo de 25% em educação, no RREO Anexo 14',
    importador: 'siconfi',
    consultaId: 900202,
    conferidoContra: null,
    periodicidade: RODADA_MENSAL,
  },
  {
    id: 'fundeb-remuneracao-rreo',
    nome: 'Fundeb na remuneração, no RREO Anexo 14',
    importador: 'siconfi',
    consultaId: 900202,
    conferidoContra: null,
    periodicidade: RODADA_MENSAL,
  },
  // Por arquivo: `anual` porque cada fonte publica uma vez por ano. A diferença entre SIOPE e SICONFI vai para Discrepâncias.
  {
    id: 'rendimento-escolar',
    nome: 'Aprovação, reprovação e abandono',
    importador: 'inep',
    consultaId: 900301,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'transicao-escolar',
    nome: 'Promoção, repetência, evasão e migração para a EJA',
    importador: 'inep',
    consultaId: 900302,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'distorcao-idade-serie',
    nome: 'Distorção idade-série',
    importador: 'inep',
    consultaId: 900303,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'alunos-por-turma',
    nome: 'Alunos por turma',
    importador: 'inep',
    consultaId: 900304,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'horas-aula',
    nome: 'Horas-aula por dia',
    importador: 'inep',
    consultaId: 900305,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'docentes-com-superior',
    nome: 'Docentes com curso superior',
    importador: 'inep',
    consultaId: 900306,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'adequacao-docente',
    nome: 'Adequação da formação docente',
    importador: 'inep',
    consultaId: 900307,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'regularidade-docente',
    nome: 'Regularidade do corpo docente',
    importador: 'inep',
    consultaId: 900308,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'esforco-docente',
    nome: 'Esforço docente',
    importador: 'inep',
    consultaId: 900309,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'remuneracao-rais',
    nome: 'Remuneração dos docentes na RAIS',
    importador: 'inep',
    consultaId: 900310,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'nivel-socioeconomico',
    nome: 'Nível socioeconômico dos alunos',
    importador: 'inep',
    consultaId: 900311,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'alfabetizacao-2o-ano',
    nome: 'Alfabetização no 2º ano, metas e participação',
    importador: 'inep',
    consultaId: 900312,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'ideb-comparacao',
    nome: 'IDEB do Brasil e de SC na rede municipal, com as parcelas',
    importador: 'inep',
    consultaId: 900313,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'enem',
    nome: 'ENEM das escolas de Orleans, com SC e Brasil',
    importador: 'inep',
    consultaId: 900314,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'ensino-superior',
    nome: 'Oferta de ensino superior em Orleans, IGC, CPC e Enade',
    importador: 'inep',
    consultaId: 900315,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'indice-educacao',
    nome: 'Mínimo de 25% em educação',
    importador: 'siope',
    consultaId: 900402,
    conferidoContra: 900202,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'fundeb-remuneracao',
    nome: 'Fundeb na remuneração dos profissionais',
    importador: 'siope',
    consultaId: 900402,
    conferidoContra: 900202,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'fundeb-contribuicao',
    nome: 'Contribuição de Orleans ao Fundeb',
    importador: 'siope',
    consultaId: 900402,
    conferidoContra: 900001,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'fundeb-resultado',
    nome: 'Resultado líquido do Fundeb',
    importador: 'siope',
    consultaId: 900402,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'indicadores-siope',
    nome: 'Percentuais do relatório de Indicadores do SIOPE',
    importador: 'siope',
    consultaId: 900401,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'investimento-por-aluno',
    nome: 'Investimento por aluno e valores do relatório de Indicadores',
    importador: 'siope',
    consultaId: 900404,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'remuneracao-medianas',
    nome: 'Medianas por 40 horas dos profissionais declarados',
    importador: 'siope',
    consultaId: 900403,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'carga-temporaria',
    nome: 'Carga temporária dos profissionais declarados',
    importador: 'siope',
    consultaId: 900405,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
  },
  {
    id: 'retrato-educacao-infantil',
    nome: 'Procura por creche: a Prefeitura informou ao MEC',
    importador: 'mec',
    consultaId: 900501,
    conferidoContra: null,
    periodicidade: RODADA_ANUAL,
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
