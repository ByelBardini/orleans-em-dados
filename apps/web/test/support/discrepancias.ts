// A resposta de /api/discrepancias com valores à mão, fictícios. O schema recusa a fixture fora do contrato.
import { discrepanciasSchema, type Discrepancias } from '@orleans-em-dados/contracts';

type Grupo = Discrepancias['grupos'][number];
type Item = Grupo['itens'][number];

export const caso = (campos: Partial<Item> = {}): Item => ({
  area: 'receita',
  situacao: 'calculada',
  data: null,
  protocolo: null,
  evidencia: null,
  entidade: 'FMS',
  codigoEntidade: '319',
  natureza: '17135011',
  descricao: 'Convênio da saúde (exemplo) - Principal',
  mes: 5,
  meses: [],
  fonte: null,
  numero: null,
  dataEmpenho: null,
  id: null,
  quantidade: null,
  betha: 1300,
  tce: 1000,
  diferenca: 300,
  diferencaBetha: 300,
  diferencaTce: 0,
  diferencaDaNatureza: null,
  etapas: null,
  valor: 300,
  nota: 'Nota do caso (exemplo).',
  ...campos,
});

export const casoDeEmpenho = (campos: Partial<Item> = {}): Item =>
  caso({
    area: 'empenho',
    entidade: 'SAMAE',
    codigoEntidade: '2473',
    natureza: null,
    descricao: null,
    mes: null,
    fonte: 'betha',
    numero: 340,
    dataEmpenho: '2025-04-01',
    id: '211:2473:1',
    betha: 20000,
    tce: null,
    diferenca: 20000,
    diferencaBetha: null,
    diferencaTce: null,
    valor: 20000,
    ...campos,
  });

export const grupo = (
  tipo: Grupo['tipo'],
  rotulo: string,
  total: number,
  itens: Item[],
  campos: Partial<Grupo> = {},
) => ({
  tipo,
  area: itens[0]?.area ?? 'receita',
  rotulo,
  explicacao: `Explicação de ${rotulo} (exemplo).`,
  total,
  itens,
  ...campos,
});

export const FORA_DO_ACUMULADO = grupo('fora_do_acumulado', 'Lançamento fora do acumulado', 300, [
  caso({ situacao: 'confirmada_no_portal', data: '2026-11-01', evidencia: 'Conferido à mão no portal (exemplo).' }),
]);

export const DUAS_RUBRICAS = grupo('duas_rubricas', 'Mesmo valor em duas rubricas', 66.11, [
  caso({
    situacao: 'confirmada_em_parte',
    data: '2026-11-01',
    entidade: 'Prefeitura',
    codigoEntidade: '728',
    natureza: '13210300',
    descricao: 'Rendimentos (exemplo)',
    mes: 1,
    betha: 166.11,
    tce: 100,
    diferenca: 66.11,
    valor: 66.11,
    evidencia: 'Só um exemplo foi conferido à mão (exemplo).',
  }),
]);

export const SO_TCE = grupo('so_tce', 'Só no TCE-SC', 428.37, [
  caso({
    situacao: 'confirmada_no_portal',
    data: '2026-11-01',
    protocolo: 'e-SIC 999/2026',
    entidade: 'SAMAE',
    codigoEntidade: '2473',
    natureza: '11130311',
    descricao: 'Imposto retido (exemplo)',
    mes: null,
    meses: [
      { mes: 1, betha: null, tce: 128.37, diferenca: -128.37 },
      { mes: 2, betha: null, tce: 300, diferenca: -300 },
    ],
    betha: null,
    tce: 428.37,
    diferenca: -428.37,
    diferencaBetha: 0,
    diferencaTce: 428.37,
    valor: 428.37,
  }),
]);

export const CONSORCIO = grupo('despesa_duplicada', 'Despesa de consórcio em duas linhas', 123887.32, [
  caso({
    area: 'despesa',
    situacao: 'rever',
    data: '2026-11-01',
    entidade: 'SAMAE',
    codigoEntidade: '2473',
    natureza: null,
    descricao: null,
    mes: null,
    betha: 10915539.85,
    tce: 10791652.53,
    diferenca: 123887.32,
    diferencaBetha: null,
    diferencaTce: null,
    valor: 123887.32,
    etapas: {
      empenhado: { betha: 10915539.85, tce: 10791652.53, diferenca: 123887.32 },
      liquidado: { betha: 200, tce: 100, diferenca: 100 },
      pago: { betha: 300, tce: 150, diferenca: 150 },
    },
  }),
]);

export const SEM_EXECUCAO = grupo('empenho_sem_execucao', 'Registro sem execução e sem par no TCE-SC', 20000, [
  casoDeEmpenho(),
]);

export const REPETIDO = grupo('empenho_repetido', 'Registro repetido', 300, [
  casoDeEmpenho({ numero: 342, dataEmpenho: '2025-03-01', id: '211:2473:2', betha: 300, diferenca: 300, valor: 300 }),
]);

export const SO_NO_TCE = grupo('empenho_ausente', 'Empenho só no TCE-SC', 500, [
  casoDeEmpenho({
    fonte: 'tce',
    numero: 771,
    dataEmpenho: '2025-09-05',
    id: '7',
    betha: null,
    tce: 500,
    diferenca: -500,
    valor: 500,
  }),
]);

export const SEM_PADRAO = grupo('sem_causa', 'Receita com diferença sem padrão conhecido', 13632.9, [
  caso({
    natureza: '19999921',
    descricao: null,
    mes: 11,
    betha: 113632.9,
    tce: 100000,
    diferenca: 13632.9,
    valor: 13632.9,
  }),
]);

export const TODOS_OS_GRUPOS = [
  FORA_DO_ACUMULADO,
  DUAS_RUBRICAS,
  SO_TCE,
  CONSORCIO,
  SEM_EXECUCAO,
  REPETIDO,
  SO_NO_TCE,
  SEM_PADRAO,
];

const AGUARDANDO_VAZIO = {
  rotulo: 'Aguardando o TCE-SC',
  explicacao: 'O TCE-SC ainda não recebeu estes meses. O valor entra no conferido quando a remessa chegar.',
  receita: { total: 0, itens: [] },
  despesa: { total: 0, quantidade: 0, itens: [] },
};

export const AGUARDANDO = {
  ...AGUARDANDO_VAZIO,
  receita: {
    total: 400000.1,
    itens: [
      caso({
        entidade: 'Prefeitura',
        codigoEntidade: '728',
        natureza: null,
        descricao: null,
        mes: 10,
        betha: 300000.1,
        tce: null,
        diferenca: 300000.1,
        diferencaBetha: null,
        diferencaTce: null,
        valor: 300000.1,
        nota: 'O TCE-SC ainda não recebeu outubro.',
      }),
      caso({
        natureza: null,
        descricao: null,
        mes: 10,
        betha: 100000,
        tce: null,
        diferenca: 100000,
        diferencaBetha: null,
        diferencaTce: null,
        valor: 100000,
        nota: 'O TCE-SC ainda não recebeu outubro.',
      }),
    ],
  },
  despesa: {
    total: 14233097.48,
    quantidade: 956,
    itens: [
      casoDeEmpenho({
        area: 'despesa',
        fonte: null,
        numero: null,
        dataEmpenho: null,
        id: null,
        quantidade: 956,
        betha: 14233097.48,
        diferenca: 14233097.48,
        valor: 14233097.48,
        nota: '956 empenhos depois do corte.',
      }),
    ],
  },
};

const resumoVazio = {
  casos: 0,
  porSituacao: { confirmada_no_portal: 0, confirmada_em_parte: 0, calculada: 0, rever: 0 },
  porArea: {
    receita: { casos: 0, total: 0 },
    despesa: { casos: 0, total: 0 },
    empenho: { casos: 0, total: 0 },
  },
};

export const discrepancias = (campos: Partial<Discrepancias> = {}): Discrepancias =>
  discrepanciasSchema.parse({
    ano: 2025,
    disponivel: true,
    parcial: false,
    limites: { mesReceita: 12, dataEmpenho: '2025-12-31' },
    grupos: TODOS_OS_GRUPOS,
    aguardando: AGUARDANDO_VAZIO,
    resumo: resumoVazio,
    ...campos,
  });

export const discrepanciasParciais = () =>
  discrepancias({ parcial: true, limites: { mesReceita: 9, dataEmpenho: '2025-09-30' }, aguardando: AGUARDANDO });

export const semConferencia = () =>
  discrepancias({
    disponivel: false,
    parcial: null,
    limites: null,
    grupos: [],
    faltando: ['tcesc_receitas', 'tcesc_empenhos'],
  });
