// A resposta de /api/municipio com valores à mão. O schema recusa a fixture que sair do contrato.
import { municipioSchema, type Municipio, type MunicipioDisponivel } from '@orleans-em-dados/contracts';

export const SERIE_DA_POPULACAO: MunicipioDisponivel['populacao']['serie'] = [
  { ano: 2000, populacao: 20031, tipo: 'censo' },
  { ano: 2010, populacao: 21393, tipo: 'censo' },
  { ano: 2021, populacao: 23161, tipo: 'estimativa' },
  { ano: 2022, populacao: 23661, tipo: 'censo' },
  { ano: 2024, populacao: 24474, tipo: 'estimativa' },
  { ano: 2025, populacao: 24686, tipo: 'estimativa' },
  { ano: 2026, populacao: 24901, tipo: 'estimativa' },
];

export const COMPARACAO: NonNullable<MunicipioDisponivel['comparacao']> = {
  coletadoEm: '2026-11-02T06:00:00.000Z',
  anoDoCenso: 2022,
  anoDoCensoAnterior: 2010,
  anoDoPib: 2023,
  orleans: {
    densidade: 43.03,
    urbana: 63.4,
    ate14Anos: 17.5,
    aPartirDe60Anos: 19.2,
    crescimento: 10.6,
    rendimentoMedio: 2065.31,
    rendimentoMediano: 1525.25,
    pibPerCapita: 59547.1,
  },
  santaCatarina: {
    densidade: 79.5,
    urbana: 83.9,
    ate14Anos: 18.1,
    aPartirDe60Anos: 16.3,
    crescimento: 21.8,
    rendimentoMedio: 2220.4,
    rendimentoMediano: 1533.33,
    pibPerCapita: 67459.2,
  },
  brasil: {
    densidade: 23.86,
    urbana: 87.4,
    ate14Anos: 19.8,
    aPartirDe60Anos: 15.6,
    crescimento: 6.5,
    rendimentoMedio: 1638.06,
    rendimentoMediano: 1000,
    pibPerCapita: 53886.5,
  },
};

export const municipio = (campos: Partial<MunicipioDisponivel> = {}): Municipio =>
  municipioSchema.parse({
    disponivel: true,
    meta: {
      fonte: 'IBGE — agregados do SIDRA',
      urlOrigem: 'https://servicodados.ibge.gov.br/api/docs/agregados?versao=3',
      coletadoEm: '2026-11-02T06:00:00.000Z',
    },
    populacao: { serie: SERIE_DA_POPULACAO },
    territorio: { ano: 2022, areaKm2: 549.859, densidade: 43.03 },
    situacao: { ano: 2022, total: 23661, urbana: 15000, rural: 8661 },
    piramide: {
      ano: 2022,
      total: 23661,
      faixas: [
        { faixa: '0 a 4 anos', homens: 739, mulheres: 681 },
        { faixa: '5 a 9 anos', homens: 676, mulheres: 720 },
        { faixa: '80 anos ou mais', homens: 188, mulheres: 275 },
      ],
    },
    rendimento: { ano: 2022, medio: 2065.31, mediano: 1525.25 },
    pib: {
      serie: [
        {
          ano: 2021,
          pib: 1188044,
          perCapita: 51294.86,
          divisor: { ano: 2021, populacao: 23161, tipo: 'estimativa' },
          composicao: {
            agropecuaria: 152445,
            industria: 326660,
            servicos: 424858,
            administracao: 129321,
            impostos: 154760,
          },
        },
        {
          ano: 2023,
          pib: 1408944,
          perCapita: 59547.1,
          divisor: { ano: 2022, populacao: 23661, tipo: 'censo' },
          composicao: null,
        },
      ],
      ultimoAnoDaComposicao: 2021,
    },
    comparacao: COMPARACAO,
    ...campos,
  });

export const municipioIndisponivel = (): Municipio => ({
  disponivel: false,
  faltando: ['ibge_populacao', 'ibge_censo', 'ibge_pib'],
});
