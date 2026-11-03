// Respostas fictícias, com valores à mão, para as páginas que só mostram o conferido.
// O schema recusa a fixture que sair do contrato.
import {
  despesasResumoSchema,
  empenhosBuscaSchema,
  empenhosResumoSchema,
  receitasSchema,
  type DespesasResumo,
  type EmpenhosResumo,
  type Municipio,
  type Receitas,
} from '@orleans-em-dados/contracts';
import { FetchFake } from './fetch-fake';
import { municipio as municipioPadrao } from './municipio';
import { respostaGravada } from './respostas';

const META = respostaGravada('api_receitas_ano_2025').meta;
export const META_DE_EXEMPLO = { ...META, fonte: 'DADOS FICTÍCIOS — exemplo', exemplo: true, status: 'exemplo' };

export const ANO = 2025;
const LIMITES_ENCERRADO = { mesReceita: 12, dataEmpenho: '2025-12-31' };
const LIMITES_PARCIAL = { mesReceita: 9, dataEmpenho: '2025-09-30' };

// Conferido 1,2 mi; total da Betha 9,9 mi: o número que não pode virar principal é fácil de achar.
export const CONTA_ENCERRADO = {
  disponivel: true,
  parcial: false,
  limites: LIMITES_ENCERRADO,
  conferido: 1200000.5,
  diferencaBetha: 8700000.3,
  diferencaTce: 428.37,
  aguardandoTce: 0,
  totalBetha: 9900000.8,
  totalTce: 1200428.87,
};

export const CONTA_PARCIAL = {
  disponivel: true,
  parcial: true,
  limites: LIMITES_PARCIAL,
  conferido: 1200000.5,
  diferencaBetha: 300000.25,
  diferencaTce: 0,
  aguardandoTce: 400000.1,
  totalBetha: 1900000.85,
  totalTce: 1200000.5,
};

const SEM_CONFERENCIA = {
  disponivel: false,
  parcial: null,
  limites: null,
  conferido: null,
  diferencaBetha: null,
  diferencaTce: null,
  aguardandoTce: null,
  totalBetha: null,
  totalTce: null,
  faltando: ['tcesc_receitas', 'tcesc_empenhos'],
};

export const natureza = (campos: Partial<Receitas['naturezas'][number]> = {}): Receitas['naturezas'][number] => ({
  chave: '728|11125001000000',
  rubrica: '11125001000000',
  nivel: 14,
  descricao: 'IPTU (exemplo)',
  entidade: 'Prefeitura',
  quantidade: 2,
  orcadoAtualizado: 1000000,
  arrecadadoNoMes: 500000.25,
  ...campos,
});

export const receitas = (campos: Partial<Receitas> = {}): Receitas =>
  receitasSchema.parse({
    meta: META,
    fonteUnica: ['orcadoAtualizado', 'orcadoDeducoes'],
    conferencia: CONTA_ENCERRADO,
    totais: {
      quantidade: 4,
      orcadoAtualizado: 2000000,
      orcadoDeducoes: 0,
      arrecadadoNoMes: 1200000.5,
      negativos: 0,
      rubricas: 2,
    },
    porMes: [{ chave: 1, quantidade: 4, arrecadadoNoMes: 1200000.5 }],
    porEntidade: [],
    porOrigem: [
      { chave: '11', quantidade: 2, orcadoAtualizado: 1000000, arrecadadoNoMes: 500000.25, descricao: 'Impostos' },
      { chave: '17', quantidade: 2, orcadoAtualizado: 1000000, arrecadadoNoMes: 700000.25, descricao: 'Repasses' },
    ],
    naturezas: [
      natureza(),
      natureza({
        chave: '728|17115101',
        rubrica: '17115101',
        nivel: 8,
        descricao: 'FPM (exemplo)',
        arrecadadoNoMes: 700000.25,
      }),
    ],
    ...campos,
  });

export const receitasParciais = () => receitas({ conferencia: CONTA_PARCIAL });
export const receitasSemConferencia = () =>
  receitas({
    conferencia: SEM_CONFERENCIA,
    totais: {
      quantidade: 0,
      orcadoAtualizado: 2000000,
      orcadoDeducoes: 0,
      arrecadadoNoMes: null,
      negativos: 0,
      rubricas: 0,
    },
    porMes: [],
    porOrigem: [],
    naturezas: [],
  });
export const receitasDeExemplo = () =>
  receitas({ meta: META_DE_EXEMPLO, conferencia: { ...SEM_CONFERENCIA, faltando: ['tcesc_receitas'] } });

type EntidadeDaDespesa = DespesasResumo['porEntidade'][number];

export const entidadeDaDespesa = (campos: Partial<EntidadeDaDespesa> = {}): EntidadeDaDespesa => ({
  chave: '2473',
  entidade: { nome: 'SAMAE (exemplo)', sigla: 'SAMAE', status: null },
  fonte: 'betha_57170',
  conferida: true,
  dataCorte: null,
  aguardandoTce: 0,
  empenhado: 10791652.53,
  liquidado: 10127438.11,
  pago: 10124827.04,
  ...campos,
});

export const ENTIDADE_FORA = entidadeDaDespesa({
  chave: '319',
  entidade: { nome: 'Fundo de Saúde (exemplo)', sigla: 'FMS', status: null },
  fonte: null,
  conferida: false,
  empenhado: null,
  liquidado: null,
  pago: null,
});

const CAMARA = {
  nome: 'Câmara Municipal (exemplo)',
  sigla: 'Câmara',
  fonte: 'tce',
  conferida: false,
  quantidade: 7,
  empenhado: 2718927.41,
  liquidado: 2718927.41,
  pago: 2718927.41,
  ultimoEmpenho: '2025-12-17',
  coletadoEm: '2026-01-15T10:00:00.000Z',
  urlOrigem: 'https://exemplo.invalid/tce',
};

// SAMAE: 123.887,32 de linhas retiradas. O total da Betha é 10.915.539,85.
export const despesas = (campos: Partial<DespesasResumo> = {}): DespesasResumo =>
  despesasResumoSchema.parse({
    meta: META,
    fonteUnica: ['orcadoAtualizado'],
    conferencia: {
      disponivel: true,
      parcial: false,
      limites: LIMITES_ENCERRADO,
      aguardandoTce: 0,
      diferencaBetha: 123887.32,
      totalBetha: 10915539.85,
      entidadesConferidas: 1,
      entidadesFora: 0,
    },
    totais: { orcadoAtualizado: 14000000, empenhado: 10791652.53, liquidado: 10127438.11, pago: 10124827.04 },
    porEntidade: [entidadeDaDespesa()],
    camara: CAMARA,
    ...campos,
  });

export const despesasParciais = () =>
  despesas({
    conferencia: {
      disponivel: true,
      parcial: true,
      limites: LIMITES_PARCIAL,
      aguardandoTce: 14233097.48,
      diferencaBetha: null,
      totalBetha: null,
      entidadesConferidas: 1,
      entidadesFora: 0,
    },
    porEntidade: [entidadeDaDespesa({ fonte: 'tce', dataCorte: '2025-09-30', aguardandoTce: 14233097.48 })],
  });

const CONFERENCIA_VAZIA = {
  disponivel: false,
  parcial: null,
  limites: null,
  aguardandoTce: null,
  diferencaBetha: null,
  totalBetha: null,
  entidadesConferidas: null,
  entidadesFora: null,
  faltando: ['tcesc_receitas', 'tcesc_empenhos'],
};

export const despesasSemConferencia = () =>
  despesas({
    conferencia: CONFERENCIA_VAZIA,
    totais: { orcadoAtualizado: 14000000, empenhado: null, liquidado: null, pago: null },
    porEntidade: [],
    camara: null,
  });

export const despesasDeExemplo = () =>
  despesas({
    meta: META_DE_EXEMPLO,
    conferencia: { ...CONFERENCIA_VAZIA, faltando: ['tcesc_empenhos'] },
    porEntidade: [entidadeDaDespesa({ fonte: 'betha', conferida: false })],
  });

const somas = { quantidade: 2, empenhado: 1000, empenhadoLiquido: 950, liquidado: 850.1, pago: 750.05 };

export const resumoDeEmpenhos = (totais: Partial<EmpenhosResumo['totais']> = {}): EmpenhosResumo =>
  empenhosResumoSchema.parse({
    meta: META,
    conferencia: { disponivel: true, parcial: false, dataCorte: null },
    totais: {
      ...somas,
      semValoresDeExecucao: 0,
      semValoresDeExecucaoValor: 0,
      saldoAPagar: 100.05,
      comSaldoAPagar: 1,
      credores: 1,
      excluidos: 0,
      aguardandoTce: 0,
      emDiscrepancia: 0,
      ...totais,
    },
    porMes: [{ chave: 1, ...somas }],
    porEntidade: [],
    porOrgao: [{ chave: 'ORGAO', nome: 'ORGAO (EXEMPLO)', ...somas }],
    porCredor: [],
    maiores: [],
  });

export const buscaDeEmpenhos = () =>
  empenhosBuscaSchema.parse({
    total: 1,
    offset: 0,
    limit: 25,
    itens: [
      {
        id: '211:2473:1',
        entidade: 'SAMAE',
        numero: 1,
        data: '2025-03-10',
        orgao: 'ORGAO (EXEMPLO)',
        credor: 'AGUA EXEMPLO LTDA',
        historico: 'Casado (exemplo)',
        empenhado: 1000,
        empenhadoLiquido: 950,
        liquidado: 850.1,
        pago: 750.05,
        saldoAPagar: 100.05,
      },
    ],
  });

export const PROPS = {
  ano: ANO,
  entidade: '',
  filtros: {
    anos: [ANO],
    ano: ANO,
    setAno: () => {},
    entidades: [],
    entidade: '',
    setEntidade: () => {},
  },
};

const consulta = `ano=${ANO}&entidade=`;

/** A API das páginas de dados: cada spec troca só a resposta que importa ao cenário. */
export function api({
  receita = receitas(),
  despesa = despesas(),
  empenhos = resumoDeEmpenhos(),
  municipio = municipioPadrao(),
}: { receita?: Receitas; despesa?: DespesasResumo; empenhos?: EmpenhosResumo; municipio?: Municipio | null } = {}) {
  const fake = new FetchFake();
  if (municipio) fake.responder('/api/municipio', municipio);
  return fake
    .responder(`/api/receitas?${consulta}`, receita)
    .responder(`/api/despesas/resumo?${consulta}`, despesa)
    .responder(`/api/despesas/empenhos/resumo?${consulta}`, empenhos)
    .responder(`/api/despesas/empenhos?ano=${ANO}&q=&entidade=&orgao=&situacao=&offset=0&limit=25`, buscaDeEmpenhos())
    .instalar();
}

const centavos = (texto: string | null) =>
  Math.round(Number((texto ?? '').replace(/[^\d,-]/g, '').replace(',', '.')) * 100);

/** Os valores da conta como aparecem na tela, em centavos: as parcelas e o total. */
export function contaNaTela(conta: HTMLElement) {
  const valores = [...conta.querySelectorAll('dd:not(.conta-explica)')].map((dd) => centavos(dd.textContent));
  return { parcelas: valores.slice(0, -1), total: valores.at(-1) };
}

/** Termos que a interface não usa: igualdade entre fontes não é auditoria, e diferença não é acusação. */
export const TEXTO_PROIBIDO = /validad[oa]s?\b|valida[çc][ãa]o|irregular|fraude|\berros?\b|fantasma/i;
