// Snapshots fictícios de cada consulta de educação, escritos à mão: um lugar por coluna e valores
// redondos, para o teste da API e da tela conferir o número sem precisar de conta. Nenhum dado real.
// Cobre as redes pública, municipal, estadual, privada e todas; Orleans, SC e Brasil; e as etapas das abas.
import type { RegistroBruto, Snapshot } from '@orleans-em-dados/importador-nucleo';
import { snapshot } from './snapshots';

export const ORLEANS = '4211702';
export const SC = '42';
export const BRASIL = '1';

type Campos = {
  indicador: string;
  lugar: string;
  rede: string;
  etapa?: string;
  recorte?: string;
  periodo: string;
  valor?: string | null;
  texto?: string | null;
  unidade: string;
};

export const valor = ({
  indicador,
  lugar,
  rede,
  etapa = '',
  recorte = '',
  periodo,
  valor: v = null,
  texto = null,
  unidade,
}: Campos) => ({
  id: [lugar, rede, etapa, recorte, indicador, periodo].join(':'),
  indicador,
  lugar,
  rede,
  etapa,
  recorte,
  periodo,
  valor: v,
  texto,
  unidade,
});

export const financa = (
  indicador: string,
  periodo: string,
  v: string | null,
  {
    recorte = '',
    percentual = null,
    lugar = ORLEANS,
    rede = 'municipal',
  }: { recorte?: string; percentual?: string | null; lugar?: string; rede?: string } = {},
) => ({
  id: [lugar, rede, recorte, indicador, periodo].join(':'),
  indicador,
  lugar,
  rede,
  recorte,
  periodo,
  valor: v,
  percentual,
});

type TresLugares = [string | null, string | null, string | null];

/** Orleans, SC e Brasil de um indicador, numa etapa e rede. Valor nulo é rede sem dado. */
const nosTresLugares = (
  indicador: string,
  rede: string,
  etapa: string,
  periodo: string,
  unidade: string,
  [orleans, sc, brasil]: TresLugares,
  recorte = '',
) => [
  valor({ indicador, lugar: ORLEANS, rede, etapa, recorte, periodo, valor: orleans, unidade }),
  valor({ indicador, lugar: SC, rede, etapa, recorte, periodo, valor: sc, unidade }),
  valor({ indicador, lugar: BRASIL, rede, etapa, recorte, periodo, valor: brasil, unidade }),
];

const lote = (consultaId: number, ano: number, registros: RegistroBruto[]): Snapshot[] => [
  snapshot(consultaId, registros, { ano }),
];

const rendimento = (
  rede: string,
  etapa: string,
  aprovacao: TresLugares,
  reprovacao: TresLugares,
  abandono: TresLugares,
) => [
  ...nosTresLugares('aprovacao', rede, etapa, '2025', '%', aprovacao),
  ...nosTresLugares('reprovacao', rede, etapa, '2025', '%', reprovacao),
  ...nosTresLugares('abandono', rede, etapa, '2025', '%', abandono),
];

export const inepRendimento = () =>
  lote(900301, 2025, [
    ...rendimento('publica', 'fundamental', ['96.0', '97.0', '95.0'], ['4.0', '2.5', '3.0'], ['0.0', '0.5', '2.0']),
    ...rendimento('publica', 'medio', ['84.0', '86.0', '88.0'], ['10.0', '9.0', '7.0'], ['6.0', '5.0', '5.0']),
    ...rendimento('publica', 'serie_1', ['80.0', '82.0', '84.0'], ['12.0', '11.0', '10.0'], ['8.0', '7.0', '6.0']),
    ...rendimento('municipal', 'fundamental', ['95.0', '98.0', '96.0'], ['5.0', '2.0', '3.0'], ['0.0', '0.0', '1.0']),
    ...rendimento('municipal', 'ano_2', ['90.0', '95.0', '97.0'], ['10.0', '5.0', '3.0'], ['0.0', '0.0', '0.0']),
    ...rendimento('estadual', 'fundamental', ['97.0', '96.0', '94.0'], ['3.0', '3.5', '4.0'], ['0.0', '0.5', '2.0']),
    ...rendimento('estadual', 'medio', ['84.0', '86.0', '88.0'], ['10.0', '9.0', '7.0'], ['6.0', '5.0', '5.0']),
    ...rendimento('privada', 'fundamental', ['99.0', '99.5', '99.0'], ['1.0', '0.5', '1.0'], ['0.0', '0.0', '0.0']),
    ...rendimento('privada', 'medio', ['98.0', '98.5', '99.0'], ['2.0', '1.5', '1.0'], ['0.0', '0.0', '0.0']),
    ...rendimento('todas', 'fundamental', ['97.0', '97.5', '96.0'], ['3.0', '2.0', '3.0'], ['0.0', '0.5', '1.0']),
    ...rendimento('todas', 'medio', ['90.0', '90.0', '92.0'], ['6.0', '5.0', '4.0'], ['4.0', '5.0', '4.0']),
    // Anos iniciais e finais, e a 1ª série estadual: a aba Permanência.
    ...rendimento('publica', 'anos_iniciais', ['98.0', '98.5', '97.0'], ['2.0', '1.0', '2.0'], ['0.0', '0.5', '1.0']),
    ...rendimento('publica', 'anos_finais', ['94.0', '95.5', '93.0'], ['6.0', '4.0', '5.0'], ['0.0', '0.5', '2.0']),
    ...rendimento('municipal', 'anos_iniciais', ['97.0', '98.0', '96.0'], ['3.0', '2.0', '3.0'], ['0.0', '0.0', '1.0']),
    ...rendimento('municipal', 'anos_finais', ['92.0', '97.0', '95.0'], ['8.0', '3.0', '4.0'], ['0.0', '0.0', '1.0']),
    ...rendimento('estadual', 'serie_1', ['70.0', '80.0', '84.0'], ['20.0', '12.0', '10.0'], ['10.0', '8.0', '6.0']),
    // Municipal sem ensino médio em Orleans: linha sem dado, nunca zero.
    ...rendimento('municipal', 'medio', [null, '80.0', '84.0'], [null, '15.0', '11.0'], [null, '5.0', '5.0']),
  ]);

export const inepTransicao = () =>
  lote(900302, 2022, [
    ...nosTresLugares('promocao', 'publica', 'fundamental', '2021-2022', '%', ['93.0', '94.0', '93.5']),
    ...nosTresLugares('repetencia', 'publica', 'fundamental', '2021-2022', '%', ['4.0', '3.0', '3.5']),
    ...nosTresLugares('evasao', 'publica', 'fundamental', '2021-2022', '%', ['2.0', '2.5', '2.5']),
    ...nosTresLugares('migracao_eja', 'publica', 'fundamental', '2021-2022', '%', ['1.0', '0.5', '0.5']),
    ...nosTresLugares('evasao', 'publica', 'medio', '2021-2022', '%', ['9.0', '8.0', '7.5']),
    ...nosTresLugares('evasao', 'estadual', 'medio', '2021-2022', '%', ['9.0', '8.5', '8.0']),
    ...nosTresLugares('evasao', 'privada', 'medio', '2021-2022', '%', ['1.0', '1.5', '1.0']),
    ...nosTresLugares('evasao', 'todas', 'medio', '2021-2022', '%', ['8.0', '7.0', '7.0']),
    ...nosTresLugares('evasao', 'publica', 'anos_iniciais', '2021-2022', '%', ['0.5', '1.0', '1.5']),
    ...nosTresLugares('evasao', 'municipal', 'anos_iniciais', '2021-2022', '%', [null, '0.5', '1.0']),
    // A transição municipal não existe em Orleans: aviso na tela, sem zero.
    ...nosTresLugares('evasao', 'municipal', 'fundamental', '2021-2022', '%', [null, '2.0', '2.5']),
  ]);

export const inepDistorcao = () =>
  lote(900303, 2025, [
    ...nosTresLugares('distorcao', 'publica', 'fundamental', '2025', '%', ['9.0', '9.5', '11.0']),
    ...nosTresLugares('distorcao', 'publica', 'medio', '2025', '%', ['17.0', '15.0', '18.0']),
    ...nosTresLugares('distorcao', 'publica', 'anos_finais', '2025', '%', ['15.0', '13.0', '14.0']),
    ...nosTresLugares('distorcao', 'municipal', 'anos_finais', '2025', '%', ['18.0', '13.5', '19.0']),
    // Municipal sem ensino médio em Orleans.
    ...nosTresLugares('distorcao', 'municipal', 'medio', '2025', '%', [null, '20.0', '22.0']),
    ...nosTresLugares('distorcao', 'municipal', 'fundamental', '2025', '%', ['8.0', '8.5', '12.0']),
    ...nosTresLugares('distorcao', 'estadual', 'fundamental', '2025', '%', ['10.0', '11.0', '13.0']),
    ...nosTresLugares('distorcao', 'privada', 'fundamental', '2025', '%', ['1.0', '1.5', '2.0']),
    ...nosTresLugares('distorcao', 'todas', 'fundamental', '2025', '%', ['9.0', '9.0', '10.0']),
  ]);

export const inepTurmas = () =>
  lote(900304, 2025, [
    ...nosTresLugares('alunos_por_turma', 'todas', 'creche', '2025', 'alunos', ['6.5', '10.5', '13.5']),
    ...nosTresLugares('alunos_por_turma', 'todas', 'pre_escola', '2025', 'alunos', ['8.5', '16.0', '17.0']),
    ...nosTresLugares('alunos_por_turma', 'todas', 'fundamental', '2025', 'alunos', ['18.5', '22.5', '22.0']),
    ...nosTresLugares('alunos_por_turma', 'todas', 'medio', '2025', 'alunos', ['27.0', '29.0', '28.5']),
    ...nosTresLugares('alunos_por_turma', 'publica', 'fundamental', '2025', 'alunos', ['18.0', '23.0', '23.5']),
    ...nosTresLugares('alunos_por_turma', 'municipal', 'fundamental', '2025', 'alunos', ['17.0', '21.0', '22.5']),
    ...nosTresLugares('alunos_por_turma', 'estadual', 'fundamental', '2025', 'alunos', ['20.0', '25.0', '26.0']),
    ...nosTresLugares('alunos_por_turma', 'privada', 'fundamental', '2025', 'alunos', ['15.0', '18.0', '17.5']),
    ...nosTresLugares('alunos_por_turma', 'municipal', 'anos_iniciais', '2025', 'alunos', ['15.5', '21.5', '22.0']),
    ...nosTresLugares('alunos_por_turma', 'estadual', 'anos_iniciais', '2025', 'alunos', [null, '22.5', '22.5']),
  ]);

export const inepHoras = () =>
  lote(900305, 2025, [
    ...nosTresLugares('horas_aula', 'todas', 'creche', '2025', 'horas', ['9.0', '9.0', '7.5']),
    ...nosTresLugares('horas_aula', 'todas', 'fundamental', '2025', 'horas', ['4.0', '4.5', '5.0']),
    ...nosTresLugares('horas_aula', 'publica', 'fundamental', '2025', 'horas', ['4.0', '4.5', '5.0']),
    ...nosTresLugares('horas_aula', 'municipal', 'fundamental', '2025', 'horas', ['4.0', '4.5', '5.0']),
    ...nosTresLugares('horas_aula', 'estadual', 'fundamental', '2025', 'horas', ['4.0', '4.0', '5.5']),
    ...nosTresLugares('horas_aula', 'privada', 'fundamental', '2025', 'horas', ['4.5', '5.0', '5.0']),
  ]);

export const inepDocentesSuperior = () =>
  lote(900306, 2025, [
    ...nosTresLugares('docentes_superior', 'todas', 'educacao_infantil', '2025', '%', ['82.0', '88.0', '82.5']),
    ...nosTresLugares('docentes_superior', 'todas', 'fundamental', '2025', '%', ['90.0', '92.5', '89.5']),
    ...nosTresLugares('docentes_superior', 'todas', 'medio', '2025', '%', ['92.0', '94.0', '96.0']),
    ...nosTresLugares('docentes_superior', 'publica', 'fundamental', '2025', '%', ['89.0', '92.0', '89.0']),
    ...nosTresLugares('docentes_superior', 'municipal', 'fundamental', '2025', '%', ['88.0', '91.0', '87.0']),
    ...nosTresLugares('docentes_superior', 'estadual', 'fundamental', '2025', '%', ['90.0', '93.0', '92.0']),
    ...nosTresLugares('docentes_superior', 'privada', 'fundamental', '2025', '%', ['95.0', '96.0', '94.0']),
  ]);

const grupos = (
  rede: string,
  etapa: string,
  porGrupo: [TresLugares, TresLugares, TresLugares, TresLugares, TresLugares],
) => porGrupo.flatMap((tres, i) => nosTresLugares('adequacao', rede, etapa, '2025', '%', tres, `grupo_${i + 1}`));

export const inepAdequacao = () =>
  lote(900307, 2025, [
    ...grupos('todas', 'educacao_infantil', [
      ['36.0', '61.0', '64.0'],
      ['1.0', '1.0', '1.0'],
      ['40.0', '26.0', '17.0'],
      ['0.0', '3.0', '3.0'],
      ['23.0', '9.0', '15.0'],
    ]),
    ...grupos('publica', 'fundamental', [
      ['66.0', '71.0', '67.0'],
      ['0.0', '1.0', '1.0'],
      ['24.0', '19.0', '19.0'],
      ['1.0', '2.0', '2.0'],
      ['9.0', '7.0', '11.0'],
    ]),
    ...grupos('municipal', 'fundamental', [
      ['70.0', '72.0', '66.0'],
      ['0.0', '1.0', '1.0'],
      ['20.0', '18.0', '20.0'],
      ['1.0', '2.0', '2.0'],
      ['9.0', '7.0', '11.0'],
    ]),
    ...grupos('estadual', 'medio', [
      ['71.0', '68.0', '66.0'],
      ['0.0', '2.0', '2.0'],
      ['27.0', '25.0', '27.0'],
      ['0.0', '3.0', '3.0'],
      ['2.0', '2.0', '2.0'],
    ]),
    ...grupos('privada', 'fundamental', [
      ['80.0', '75.0', '70.0'],
      ['1.0', '2.0', '2.0'],
      ['15.0', '18.0', '20.0'],
      ['2.0', '3.0', '4.0'],
      ['2.0', '2.0', '4.0'],
    ]),
  ]);

const regularidade = (
  rede: string,
  baixa: TresLugares,
  mediaBaixa: TresLugares,
  mediaAlta: TresLugares,
  alta: TresLugares,
) => [
  ...nosTresLugares('regularidade', rede, '', '2025', '%', baixa, 'baixa'),
  ...nosTresLugares('regularidade', rede, '', '2025', '%', mediaBaixa, 'media_baixa'),
  ...nosTresLugares('regularidade', rede, '', '2025', '%', mediaAlta, 'media_alta'),
  ...nosTresLugares('regularidade', rede, '', '2025', '%', alta, 'alta'),
];

export const inepRegularidade = () =>
  lote(900308, 2025, [
    ...regularidade(
      'todas',
      ['40.0', '30.0', '10.0'],
      ['55.0', '46.0', '36.0'],
      ['5.0', '22.0', '44.0'],
      ['0.0', '2.0', '10.0'],
    ),
    ...regularidade(
      'publica',
      ['50.0', '35.0', '11.0'],
      ['45.0', '45.0', '37.0'],
      ['5.0', '18.0', '43.0'],
      ['0.0', '2.0', '9.0'],
    ),
    ...regularidade(
      'municipal',
      ['20.0', '20.0', '12.0'],
      ['60.0', '50.0', '38.0'],
      ['20.0', '28.0', '42.0'],
      ['0.0', '2.0', '8.0'],
    ),
    ...regularidade(
      'estadual',
      ['80.0', '77.0', '30.0'],
      ['20.0', '20.0', '40.0'],
      ['0.0', '3.0', '25.0'],
      ['0.0', '0.0', '5.0'],
    ),
    ...regularidade(
      'privada',
      ['10.0', '20.0', '9.0'],
      ['40.0', '40.0', '30.0'],
      ['40.0', '30.0', '45.0'],
      ['10.0', '10.0', '16.0'],
    ),
  ]);

export const inepEsforco = () =>
  lote(900309, 2025, [
    ...['1', '2', '3', '4', '5', '6'].flatMap((n, i) =>
      nosTresLugares(
        'esforco',
        'todas',
        'fundamental',
        '2025',
        '%',
        (
          [
            ['10.0', '12.0', '21.0'],
            ['5.0', '10.0', '18.0'],
            ['40.0', '34.0', '28.0'],
            ['32.0', '34.0', '26.0'],
            ['10.0', '7.0', '5.0'],
            ['3.0', '3.0', '2.0'],
          ] as TresLugares[]
        )[i] as TresLugares,
        `nivel_${n}`,
      ),
    ),
    ...nosTresLugares('esforco', 'municipal', 'fundamental', '2025', '%', ['12.0', '14.0', '22.0'], 'nivel_1'),
    ...nosTresLugares('esforco', 'publica', 'fundamental', '2025', '%', ['9.0', '13.0', '22.0'], 'nivel_1'),
    ...nosTresLugares('esforco', 'estadual', 'medio', '2025', '%', ['3.0', '5.0', '2.0'], 'nivel_1'),
    ...nosTresLugares('esforco', 'privada', 'fundamental', '2025', '%', ['20.0', '25.0', '30.0'], 'nivel_1'),
  ]);

const rais = (lugar: string, rede: string, mediana: string, media40h: string) => [
  financa('remuneracao_rais', '2021', mediana, { lugar, rede, recorte: 'total:mediana' }),
  financa('remuneracao_rais', '2021', media40h, { lugar, rede, recorte: 'total:media_40h' }),
  financa('remuneracao_rais', '2021', '30.00', { lugar, rede, recorte: 'total:carga_semanal' }),
];

export const inepRemuneracao = () =>
  lote(900310, 2021, [
    ...rais(ORLEANS, 'municipal', '3400.00', '3900.00'),
    ...rais(SC, 'publica', '3200.00', '5300.00'),
    ...rais(SC, 'estadual', '3100.00', '5250.00'),
    ...rais(BRASIL, 'municipal', '3350.00', '5150.00'),
    ...rais(BRASIL, 'privada', '2800.00', '3800.00'),
  ]);

const inse = (lugar: string, rede: string, media: string, alunos: string, niveis: string[]) => [
  valor({ indicador: 'inse', lugar, rede, periodo: '2023', valor: media, unidade: 'indice' }),
  valor({ indicador: 'inse', lugar, rede, recorte: 'alunos', periodo: '2023', valor: alunos, unidade: 'pessoas' }),
  ...niveis.map((v, i) =>
    valor({ indicador: 'inse', lugar, rede, recorte: `nivel_${i + 1}`, periodo: '2023', valor: v, unidade: '%' }),
  ),
];

export const inepInse = () =>
  lote(900311, 2023, [
    ...inse(ORLEANS, 'publica', '5.50', '500', ['0', '1', '6', '13', '22', '33', '23', '2']),
    ...inse(SC, 'publica', '5.40', '200000', ['0', '2', '7', '16', '25', '26', '22', '2']),
    ...inse(BRASIL, 'publica', '5.00', '6800000', ['2', '12', '15', '20', '20', '16', '13', '2']),
    ...inse(SC, 'privada', '6.40', '5000', ['0', '0', '0', '2', '7', '17', '52', '22']),
    ...inse(BRASIL, 'todas', '5.10', '7000000', ['1', '11', '15', '20', '20', '16', '14', '3']),
  ]);

const alfabetizacao = (
  lugar: string,
  rede: string,
  resultados: [string, string, string],
  metas: [string, string, string | null],
  participacao: string,
) => [
  ...(['2023', '2024', '2025'] as const).map((periodo, i) =>
    valor({
      indicador: 'alfabetizacao_2o_ano',
      lugar,
      rede,
      etapa: 'ano_2',
      periodo,
      valor: resultados[i],
      unidade: '%',
    }),
  ),
  valor({
    indicador: 'alfabetizacao_meta',
    lugar,
    rede,
    etapa: 'ano_2',
    periodo: '2024',
    valor: metas[0],
    unidade: '%',
  }),
  valor({
    indicador: 'alfabetizacao_meta',
    lugar,
    rede,
    etapa: 'ano_2',
    periodo: '2025',
    valor: metas[1],
    unidade: '%',
  }),
  metas[2] === null
    ? valor({
        indicador: 'alfabetizacao_meta',
        lugar,
        rede,
        etapa: 'ano_2',
        periodo: '2030',
        texto: '> 80',
        unidade: '%',
      })
    : valor({
        indicador: 'alfabetizacao_meta',
        lugar,
        rede,
        etapa: 'ano_2',
        periodo: '2030',
        valor: metas[2],
        unidade: '%',
      }),
  valor({
    indicador: 'alfabetizacao_participacao',
    lugar,
    rede,
    etapa: 'ano_2',
    periodo: '2025',
    valor: participacao,
    unidade: '%',
  }),
];

export const inepAlfabetizacao = () =>
  lote(900312, 2025, [
    ...alfabetizacao(ORLEANS, 'municipal', ['60', '70', '65'], ['68', '70', '80'], '84'),
    ...alfabetizacao(SC, 'publica', ['60', '62', '63'], ['65', '67', null], '88'),
    ...alfabetizacao(BRASIL, 'publica', ['56', '59', '66'], ['60', '64', null], '89'),
  ]);

const serieDoIdeb = (lugar: string, rede: string, etapa: string, serie: Record<string, string | null>) =>
  Object.entries(serie).map(([periodo, v]) =>
    valor({ indicador: 'ideb', lugar, rede, etapa, periodo, valor: v, unidade: 'indice' }),
  );

const parcelas = (
  lugar: string,
  rede: string,
  etapa: string,
  rendimento: string,
  matematica: string,
  portugues: string,
  aprovacao: string,
) => [
  valor({ indicador: 'ideb_rendimento', lugar, rede, etapa, periodo: '2025', valor: rendimento, unidade: 'indice' }),
  valor({ indicador: 'ideb_matematica', lugar, rede, etapa, periodo: '2025', valor: matematica, unidade: 'nota' }),
  valor({ indicador: 'ideb_portugues', lugar, rede, etapa, periodo: '2025', valor: portugues, unidade: 'nota' }),
  valor({ indicador: 'ideb_aprovacao', lugar, rede, etapa, periodo: '2025', valor: aprovacao, unidade: '%' }),
];

export const inepIdeb = () =>
  lote(900313, 2025, [
    ...serieDoIdeb(BRASIL, 'publica', 'anos_iniciais', { 2021: '5.5', 2023: '5.7', 2025: '6.0' }),
    ...serieDoIdeb(BRASIL, 'municipal', 'anos_iniciais', { 2021: '5.4', 2023: '5.6', 2025: '5.9' }),
    ...serieDoIdeb(BRASIL, 'estadual', 'medio', { 2021: '3.9', 2023: '4.1', 2025: '4.2' }),
    ...serieDoIdeb(BRASIL, 'privada', 'medio', { 2021: '5.6', 2023: '5.8', 2025: '5.9' }),
    ...serieDoIdeb(BRASIL, 'todas', 'anos_finais', { 2021: '5.1', 2023: '5.0', 2025: '5.2' }),
    ...serieDoIdeb(SC, 'municipal', 'anos_iniciais', { 2021: '6.1', 2023: '6.3', 2025: '6.5' }),
    ...serieDoIdeb(SC, 'municipal', 'anos_finais', { 2021: '5.0', 2023: null, 2025: '5.2' }),
    ...parcelas(ORLEANS, 'municipal', 'anos_iniciais', '0.96', '240.00', '227.00', '96.0'),
    ...parcelas(ORLEANS, 'estadual', 'medio', '0.84', '269.00', '281.00', '85.0'),
    ...parcelas(ORLEANS, 'publica', 'medio', '0.84', '269.00', '281.00', '85.0'),
    ...parcelas(SC, 'municipal', 'anos_iniciais', '0.98', '235.00', '222.00', '98.0'),
    ...parcelas(BRASIL, 'publica', 'anos_iniciais', '0.98', '220.00', '208.00', '98.0'),
  ]);

const enem = (lugar: string, rede: string, periodo: string, inscritos: string, presentes: string, media: string) => [
  valor({ indicador: 'enem_inscritos', lugar, rede, etapa: 'medio', periodo, valor: inscritos, unidade: 'pessoas' }),
  valor({ indicador: 'enem_presentes', lugar, rede, etapa: 'medio', periodo, valor: presentes, unidade: 'pessoas' }),
  valor({ indicador: 'enem_media_5_areas', lugar, rede, etapa: 'medio', periodo, valor: media, unidade: 'nota' }),
  ...['natureza', 'humanas', 'linguagens', 'matematica', 'redacao'].map((area) =>
    valor({ indicador: `enem_${area}`, lugar, rede, etapa: 'medio', periodo, valor: media, unidade: 'nota' }),
  ),
];

const escolasDoEnem = (rede: string, periodo: string, n: string) =>
  valor({ indicador: 'enem_escolas', lugar: ORLEANS, rede, etapa: 'medio', periodo, valor: n, unidade: 'escolas' });

export const inepEnem = () => [
  ...lote(900314, 2024, [
    escolasDoEnem('todas', '2024', '4'),
    escolasDoEnem('estadual', '2024', '3'),
    // Rede de uma escola: só a contagem, sem nota nem "quem fez a prova".
    escolasDoEnem('privada', '2024', '1'),
    ...enem(ORLEANS, 'estadual', '2024', '110', '80', '530.00'),
    ...enem(ORLEANS, 'publica', '2024', '110', '80', '530.00'),
    ...enem(SC, 'estadual', '2024', '30000', '21000', '530.00'),
    ...enem(SC, 'publica', '2024', '32000', '22000', '535.00'),
    ...enem(SC, 'privada', '2024', '9000', '8000', '620.00'),
    ...enem(SC, 'todas', '2024', '43000', '32000', '560.00'),
    ...enem(BRASIL, 'estadual', '2024', '1200000', '880000', '505.00'),
    ...enem(BRASIL, 'publica', '2024', '1300000', '950000', '510.00'),
    ...enem(BRASIL, 'privada', '2024', '260000', '245000', '615.00'),
    ...enem(BRASIL, 'todas', '2024', '1560000', '1190000', '530.00'),
  ]),
  ...lote(900314, 2025, [
    escolasDoEnem('todas', '2025', '4'),
    escolasDoEnem('estadual', '2025', '2'),
    escolasDoEnem('privada', '2025', '2'),
    ...enem(ORLEANS, 'todas', '2025', '130', '100', '545.00'),
    ...enem(ORLEANS, 'publica', '2025', '100', '75', '525.00'),
    ...enem(ORLEANS, 'estadual', '2025', '100', '75', '525.00'),
    ...enem(ORLEANS, 'privada', '2025', '30', '25', '610.00'),
    ...enem(SC, 'publica', '2025', '38000', '24000', '525.00'),
    ...enem(SC, 'estadual', '2025', '36000', '23000', '520.00'),
    ...enem(SC, 'privada', '2025', '10000', '9000', '615.00'),
    ...enem(SC, 'todas', '2025', '50000', '35000', '550.00'),
    ...enem(BRASIL, 'publica', '2025', '1450000', '1030000', '500.00'),
    ...enem(BRASIL, 'estadual', '2025', '1380000', '960000', '495.00'),
    ...enem(BRASIL, 'privada', '2025', '270000', '250000', '610.00'),
    ...enem(BRASIL, 'todas', '2025', '1740000', '1290000', '525.00'),
    valor({
      indicador: 'enem_inscritos',
      lugar: ORLEANS,
      rede: 'todas',
      etapa: 'medio',
      recorte: 'prova_em_orleans',
      periodo: '2025',
      valor: '500',
      unidade: 'pessoas',
    }),
  ]),
];

const noCenso = (indicador: string, v: string, unidade: string, recorte = '') =>
  valor({ indicador, lugar: ORLEANS, rede: 'todas', recorte, periodo: '2024', valor: v, unidade });

const curso = (
  nome: string,
  vagas: string,
  ingressantes: string,
  matriculas: string,
  concluintes: string,
  corte?: [string, string],
) => [
  noCenso('superior_curso_vagas', vagas, 'vagas', nome),
  noCenso('superior_curso_ingressantes', ingressantes, 'pessoas', nome),
  noCenso('superior_curso_matriculas', matriculas, 'pessoas', nome),
  noCenso('superior_curso_concluintes', concluintes, 'pessoas', nome),
  ...(corte
    ? [
        noCenso('superior_curso_mulheres', corte[0], 'pessoas', nome),
        noCenso('superior_curso_noturno', corte[1], 'pessoas', nome),
      ]
    : []),
];

const naAvaliacao = (
  indicador: string,
  periodo: string,
  v: string | null,
  unidade: string,
  recorte = '',
  texto: string | null = null,
) => valor({ indicador, lugar: ORLEANS, rede: 'todas', recorte, periodo, valor: v, texto, unidade });

export const inepSuperior = () =>
  lote(900315, 2024, [
    valor({
      indicador: 'superior_instituicao',
      lugar: ORLEANS,
      rede: 'todas',
      periodo: '2024',
      texto: 'FICTICIA',
      unidade: 'texto',
    }),
    valor({
      indicador: 'superior_natureza',
      lugar: ORLEANS,
      rede: 'todas',
      periodo: '2024',
      texto: 'Privada sem fins lucrativos',
      unidade: 'texto',
    }),
    noCenso('superior_cursos', '2', 'cursos'),
    noCenso('superior_vagas', '150', 'vagas'),
    noCenso('superior_inscritos', '200', 'pessoas'),
    noCenso('superior_ingressantes', '100', 'pessoas'),
    noCenso('superior_matriculas', '300', 'pessoas'),
    noCenso('superior_concluintes', '40', 'pessoas'),
    noCenso('superior_perfil', '180', 'pessoas', 'mulheres'),
    noCenso('superior_perfil', '250', 'pessoas', 'noturno'),
    noCenso('superior_perfil', '220', 'pessoas', 'de_18_a_24'),
    noCenso('superior_perfil', '200', 'pessoas', 'escola_publica'),
    noCenso('superior_perfil', '60', 'pessoas', 'prouni'),
    noCenso('superior_perfil', '10', 'pessoas', 'fies'),
    noCenso('superior_ead_instituicoes', '3', 'instituicoes'),
    noCenso('superior_ead_matriculas', '10', 'pessoas'),
    noCenso('superior_ead_ingressantes', '8', 'pessoas'),
    noCenso('superior_docentes', '50', 'pessoas'),
    noCenso('superior_docentes', '10', 'pessoas', 'doutores'),
    noCenso('superior_docentes', '25', 'pessoas', 'mestres'),
    noCenso('superior_docentes', '15', 'pessoas', 'especialistas'),
    noCenso('superior_docentes', '12', 'pessoas', 'tempo_integral'),
    noCenso('superior_tecnicos', '20', 'pessoas'),
    ...curso('Curso Grande (bacharelado)', '100', '90', '292', '38', ['170', '242']),
    // Menos de 10 matrículas: sem o corte por sexo e turno.
    ...curso('Curso Pequeno (licenciatura)', '50', '10', '8', '6'),
    naAvaliacao('superior_igc_continuo', '2023', '2.50', 'indice'),
    naAvaliacao('superior_igc_faixa', '2023', '3', 'indice'),
    valor({
      indicador: 'superior_igc_distribuicao',
      lugar: SC,
      rede: 'todas',
      recorte: 'faixa_3',
      periodo: '2023',
      valor: '50',
      unidade: 'instituicoes',
    }),
    valor({
      indicador: 'superior_igc_distribuicao',
      lugar: SC,
      rede: 'todas',
      recorte: 'faixa_4',
      periodo: '2023',
      valor: '30',
      unidade: 'instituicoes',
    }),
    naAvaliacao('superior_cpc_participantes', '2023', '20', 'pessoas', 'AREA FICTICIA'),
    naAvaliacao('superior_cpc_continuo', '2023', '3.00', 'indice', 'AREA FICTICIA'),
    naAvaliacao('superior_cpc_faixa', '2023', '4', 'indice', 'AREA FICTICIA'),
    naAvaliacao('superior_cpc_faixa', '2023', null, 'indice', 'AREA SEM CONCEITO', 'SC'),
    naAvaliacao('superior_enade_faixa', '2023', '3', 'indice', 'AREA FICTICIA'),
    naAvaliacao('superior_licenciatura_participantes', '2025', '30', 'pessoas', 'LICENCIATURA FICTICIA'),
    naAvaliacao('superior_licenciatura_proficiencia', '2025', '60.0', '%', 'LICENCIATURA FICTICIA'),
    naAvaliacao('superior_licenciatura_faixa', '2025', '3', 'indice', 'LICENCIATURA FICTICIA'),
  ]);

const percentualDoSiope = (indicador: string, periodo: string, v: string | null) =>
  valor({ indicador: `siope_${indicador}`, lugar: ORLEANS, rede: 'municipal', periodo, valor: v, unidade: '%' });

export const siopeIndicadores = () =>
  (
    [
      [2024, '26.00', '85.00', '13.00', '2.00', '67.00', '31.00', '38.00', '46.00', '20.00'],
      [2025, '28.00', '87.00', '12.00', '1.00', '73.00', '27.00', '38.50', '47.50', null],
    ] as const
  ).flatMap(
    ([ano, indice, fundeb, outras, naoAplicado, infantil, fundamental, despInfantil, despFundamental, naDespesa]) =>
      lote(900401, ano, [
        percentualDoSiope('indice_educacao', String(ano), indice),
        percentualDoSiope('fundeb_remuneracao', String(ano), fundeb),
        percentualDoSiope('fundeb_outras_despesas', String(ano), outras),
        percentualDoSiope('fundeb_nao_aplicado', String(ano), naoAplicado),
        percentualDoSiope('fundeb_em_infantil', String(ano), infantil),
        percentualDoSiope('fundeb_em_fundamental', String(ano), fundamental),
        percentualDoSiope('despesa_infantil', String(ano), despInfantil),
        percentualDoSiope('despesa_fundamental', String(ano), despFundamental),
        percentualDoSiope('educacao_na_despesa_total', String(ano), naDespesa),
      ]),
  );

export const siopeIndicadoresValores = () =>
  (
    [
      [2023, '10000.00', '15000.00', null, '6000.00', '300.00'],
      [2024, '11000.00', '16000.00', '16000.00', '7000.00', null],
      [2025, '13000.00', '21000.00', '19000.00', '8000.00', '375.00'],
    ] as const
  ).flatMap(([ano, infantil, fundamental, basica, professores, naoDocentes]) => {
    const p = String(ano);
    return lote(900404, ano, [
      financa('siope_por_aluno_infantil', p, infantil),
      financa('siope_por_aluno_fundamental', p, fundamental),
      // Educação básica de 2022 e 2023 não sai: o registro não existe.
      ...(basica === null ? [] : [financa('siope_por_aluno_educacao_basica', p, basica)]),
      financa('siope_professores_por_aluno', p, professores),
      financa('siope_nao_docentes_por_aluno', p, naoDocentes),
      financa('siope_saldo_financeiro_fundeb', p, '1000000.00'),
      financa('siope_fundeb_nao_utilizado', p, '0.00'),
      financa('siope_educacao_valor_exigido', p, '20000000.00'),
      financa('siope_educacao_valor_aplicado', p, '22000000.00'),
    ]);
  });

const anexo8 = (
  ano: number,
  aplicado: string,
  percentual: string,
  fundeb: string,
  fundebPct: string,
  liquidado: string,
) => {
  const p = String(ano);
  return lote(900402, ano, [
    financa('indice_educacao', p, aplicado, { percentual }),
    financa('indice_educacao', p, '20000000.00', { recorte: 'exigido' }),
    financa('fundeb_remuneracao', p, fundeb, { percentual: fundebPct }),
    financa('fundeb_remuneracao', p, '10000000.00', { recorte: 'exigido' }),
    financa('gasto_total', p, '40000000.00', { recorte: 'dotacao' }),
    financa('gasto_total', p, '36000000.00', { recorte: 'empenhado' }),
    financa('gasto_total', p, liquidado, { recorte: 'liquidado' }),
    financa('gasto_total', p, liquidado, { recorte: 'pago' }),
    financa('fundeb_contribuicao', p, '15000000.00'),
    financa('fundeb_resultado', p, '1500000.00'),
    financa('receita_impostos', p, '80000000.00'),
    financa('pessoal_ativo', p, '20000000.00'),
    financa('capital', p, '1000000.00', { recorte: 'empenhado' }),
    financa('capital', p, '900000.00', { recorte: 'liquidado' }),
  ]);
};

export const siopeAnexo8 = () => [
  // 2021 abaixo de 25%: o caso da Emenda 119.
  ...anexo8(2021, '18400000.00', '23.00', '12000000.00', '84.00', '30000000.00'),
  ...anexo8(2024, '20800000.00', '26.00', '13000000.00', '91.00', '35000000.00'),
  ...anexo8(2025, '22400000.00', '28.00', '14000000.00', '98.00', '36000000.00'),
];

export const siopeRemuneracao = () =>
  (
    [
      [2024, '5500.00', '6500.00', '5000.00', '2300.00', true],
      [2025, '6000.00', '7000.00', '5500.00', '2500.00', true],
      [2026, '6200.00', '7200.00', '5700.00', null, false],
    ] as const
  ).flatMap(([ano, geral, efetivo, temporario, outros, completo]) => {
    const p = `${ano}-05`;
    return lote(900403, ano, [
      financa('mediana_40h', p, geral, { recorte: 'magisterio:todos' }),
      financa('mediana_40h', p, efetivo, { recorte: 'magisterio:efetivo' }),
      financa('mediana_40h', p, temporario, { recorte: 'magisterio:temporario' }),
      financa('mediana_vencimento_40h', p, '4800.00', { recorte: 'magisterio:efetivo' }),
      financa('mediana_vencimento_40h', p, '4400.00', { recorte: 'magisterio:temporario' }),
      // Menos de 10 pessoas: mediana nula, sem barra.
      financa('mediana_40h', p, outros, { recorte: 'outros:efetivo' }),
      ...(completo ? [financa('total_declarado', String(ano), '12000000.00')] : []),
    ]);
  });

export const siopeRemuneracaoCarga = () =>
  (
    [
      [2024, '35.0', '160', '100', '60'],
      [2025, '40.0', '180', '100', '80'],
      [2026, '45.0', '150', '80', '70'],
    ] as const
  ).flatMap(([ano, pct, todos, efetivos, temporarios]) => {
    const periodo = `${ano}-05`;
    const base = { lugar: ORLEANS, rede: 'municipal', periodo };
    return lote(900405, ano, [
      valor({ ...base, indicador: 'carga_temporaria', recorte: 'magisterio:temporario', valor: pct, unidade: '%' }),
      valor({ ...base, indicador: 'carga_temporaria', recorte: 'outros:temporario', valor: '50.0', unidade: '%' }),
      valor({ ...base, indicador: 'carga_horas', recorte: 'magisterio:todos', valor: '5000', unidade: 'horas' }),
      valor({ ...base, indicador: 'profissionais', recorte: 'magisterio:todos', valor: todos, unidade: 'pessoas' }),
      valor({
        ...base,
        indicador: 'profissionais',
        recorte: 'magisterio:efetivo',
        valor: efetivos,
        unidade: 'pessoas',
      }),
      valor({
        ...base,
        indicador: 'profissionais',
        recorte: 'magisterio:temporario',
        valor: temporarios,
        unidade: 'pessoas',
      }),
      // De 1 a 4 pessoas, só o texto.
      ano === 2024
        ? valor({
            ...base,
            indicador: 'profissionais',
            recorte: 'outros:todos',
            texto: 'menos de 5',
            unidade: 'pessoas',
          })
        : valor({ ...base, indicador: 'profissionais', recorte: 'outros:todos', valor: '120', unidade: 'pessoas' }),
      valor({
        ...base,
        indicador: 'formacao_magisterio',
        recorte: 'licenciatura_plena',
        valor: todos,
        unidade: 'pessoas',
      }),
      valor({
        ...base,
        indicador: 'formacao_magisterio',
        recorte: 'nivel_medio',
        texto: 'menos de 5',
        unidade: 'pessoas',
      }),
    ]);
  });

const retrato = (chave: string, texto: string | null) =>
  valor({ indicador: `retrato_${chave}`, lugar: ORLEANS, rede: 'municipal', periodo: '2025', texto, unidade: 'texto' });

const distribuicao = (recorte: string, municipios: string) =>
  valor({
    indicador: 'retrato_distribuicao',
    lugar: SC,
    rede: 'municipal',
    recorte,
    periodo: '2025',
    valor: municipios,
    unidade: 'municipios',
  });

export const mecRetrato = () =>
  lote(900501, 2025, [
    retrato('solicitacoes_nao_atendidas_creche', 'Não há demanda'),
    // Quantidade na fila: não há número público. Nulo, nunca zero.
    retrato('quantidade_na_lista_de_espera', null),
    retrato('lista_unificada', 'Sim, cadastro único do município'),
    retrato('listas_divulgadas_ao_publico', 'Sim'),
    retrato('criterios_de_prioridade', 'Não há critérios; ordem de cadastramento (ordem de chegada)'),
    retrato('idade_inicial_creche', 'De 3 a 6 meses'),
    retrato('criancas_fora_da_pre_escola_por_falta_de_vaga', 'Não se aplica'),
    retrato('nivel_de_gestao_da_demanda', 'Básico (3º de 4)'),
    distribuicao('inicial', '40'),
    distribuicao('elementar', '150'),
    distribuicao('basico', '90'),
    distribuicao('avancado', '15'),
  ]);

/** Um gerador de lotes por consulta, na chave de `consultas.chave`. */
export const EDUCACAO = {
  inep_rendimento: inepRendimento,
  inep_transicao: inepTransicao,
  inep_distorcao: inepDistorcao,
  inep_turmas: inepTurmas,
  inep_horas: inepHoras,
  inep_docentes_superior: inepDocentesSuperior,
  inep_adequacao: inepAdequacao,
  inep_regularidade: inepRegularidade,
  inep_esforco: inepEsforco,
  inep_remuneracao: inepRemuneracao,
  inep_inse: inepInse,
  inep_alfabetizacao: inepAlfabetizacao,
  inep_ideb: inepIdeb,
  inep_enem: inepEnem,
  inep_superior: inepSuperior,
  siope_indicadores: siopeIndicadores,
  siope_indicadores_valores: siopeIndicadoresValores,
  siope_anexo8: siopeAnexo8,
  siope_remuneracao: siopeRemuneracao,
  siope_remuneracao_carga: siopeRemuneracaoCarga,
  mec_retrato: mecRetrato,
} as const;

export type ChaveDeEducacao = keyof typeof EDUCACAO;
/** Troca os lotes de uma consulta; `null` deixa a fonte sem coleta. */
export type CenarioDeEducacao = Partial<Record<ChaveDeEducacao, Snapshot[] | null>>;
