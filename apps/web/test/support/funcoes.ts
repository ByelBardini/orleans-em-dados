// As respostas de /api/funcoes e /api/funcoes/serie com valores à mão. O schema recusa a fixture fora do contrato.
import { funcoesSchema, funcoesSerieSchema, type Funcoes, type FuncoesSerie } from '@orleans-em-dados/contracts';
import { respostaGravada } from './respostas';

// Sem a Câmara: empenhado 1.000.000, liquidado 800.000, pago 500.000.
const SAUDE = {
  codigo: '10',
  nome: 'Saúde',
  empenhado: 600000,
  liquidado: 500000,
  pago: 300000,
  participacao: { empenhado: 60, liquidado: 62.5, pago: 60 },
  porMorador: { empenhado: 24.31, liquidado: 20.25, pago: 12.15 },
  subfuncoes: [{ codigo: '10.301', nome: 'Atenção Básica', empenhado: 600000, liquidado: 500000, pago: 300000 }],
};

const TRANSPORTE = {
  codigo: '26',
  nome: 'Transporte',
  empenhado: 400000,
  liquidado: 300000,
  pago: 200000,
  participacao: { empenhado: 40, liquidado: 37.5, pago: 40 },
  porMorador: { empenhado: 16.2, liquidado: 12.15, pago: 8.1 },
  subfuncoes: [
    { codigo: '26.782', nome: 'Transporte Rodoviário', empenhado: 350000, liquidado: 250000, pago: 150000 },
    { codigo: 'FU26', nome: 'Demais Subfunções', empenhado: 50000, liquidado: 50000, pago: 50000 },
  ],
};

export const funcoes = (campos: Partial<Funcoes> = {}): Funcoes =>
  funcoesSchema.parse({
    ano: 2025,
    meta: { ...respostaGravada('api_funcoes_ano_2025').meta },
    conferencia: 'conferido',
    diferenca: null,
    conferenciaEducacao: 'sem_betha',
    diferencaEducacao: null,
    total: { empenhado: 1000000, liquidado: 800000, pago: 500000 },
    divisor: { ano: 2025, populacao: 24686, tipo: 'estimativa' },
    porMorador: { empenhado: 40.51, liquidado: 32.41, pago: 20.25 },
    funcoes: [SAUDE, TRANSPORTE],
    camara: {
      codigo: '01',
      nome: 'Legislativa',
      empenhado: 70000,
      liquidado: 65000,
      pago: 60000,
      subfuncoes: [{ codigo: '01.031', nome: 'Ação Legislativa', empenhado: 70000, liquidado: 65000, pago: 60000 }],
    },
    ...campos,
  });

const comparacao = (
  estado: 'conferido' | 'diferenca',
  pago = { dca: 500000, tce: 500000, diferenca: 0, maior: null as null | 'dca' | 'tce' },
) => ({
  estado,
  etapas: [
    { etapa: 'empenhado', dca: 1000000, tce: 1000000, diferenca: 0, maior: null },
    { etapa: 'liquidado', dca: 800000, tce: 800000, diferenca: 0, maior: null },
    { etapa: 'pago', ...pago },
  ],
});

/** A DCA registra R$ 1.000,00 a mais que o TCE-SC no pago. */
export const funcoesComDiferenca = () =>
  funcoes({
    conferencia: 'diferenca',
    diferenca: funcoesSchema.shape.diferenca.parse({
      total: comparacao('diferenca', { dca: 501000, tce: 500000, diferenca: 1000, maior: 'dca' }),
      legislativa: comparacao('conferido'),
    }),
  });

const anoDaSerie = (ano: number, conferencia: 'conferido' | 'sem_tce', participacaoDaSaude: number) => ({
  ano,
  conferencia,
  conferenciaEducacao: 'sem_betha' as const,
  total: { empenhado: 1000000 + (ano - 2018), liquidado: 800000, pago: 500000 },
  funcoes: [
    {
      codigo: '10',
      nome: 'Saúde',
      empenhado: 600000,
      liquidado: 500000,
      pago: 300000,
      participacao: { empenhado: participacaoDaSaude, liquidado: 62.5, pago: 60 },
    },
    {
      codigo: '26',
      nome: 'Transporte',
      empenhado: 400000,
      liquidado: 300000,
      pago: 200000,
      participacao: { empenhado: 100 - participacaoDaSaude, liquidado: 37.5, pago: 40 },
    },
  ],
  camara: { codigo: '01', nome: 'Legislativa', empenhado: 70000, liquidado: 65000, pago: 60000 },
});

export const serie = (anos: FuncoesSerie['anos'] = SERIE_PADRAO): FuncoesSerie =>
  funcoesSerieSchema.parse({ valores: 'nominais', anos });

export const SERIE_PADRAO: FuncoesSerie['anos'] = [
  anoDaSerie(2018, 'sem_tce', 55.5),
  anoDaSerie(2024, 'conferido', 58.25),
  anoDaSerie(2025, 'conferido', 60),
];

export { anoDaSerie };
