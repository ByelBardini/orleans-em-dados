// Arquivos do INEP → lotes de educacao_valores e educacao_financas. Só a localização Total entra.
// Arquivo municipal ausente: Orleans só vem dos extratos se a rota for pedida (`--de-extratos`), e o
// `filtro` do lote diz de onde veio cada lugar.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RegistroBruto } from '@orleans-em-dados/importador-nucleo';
import { contagemPublicavel, decimalDaFonte, taxaDoInep } from '../validacoes';
import { BRASIL, ORLEANS, SANTA_CATARINA, type Rede } from '../vocabulario';
import { acharArquivo, registrosPorCodigo, type Celula } from './arquivos';
import { pessoas, registroDeFinanca, registroDeValor, type Lote } from './snapshot';

export type OpcoesDoInep = {
  origem: string;
  /** Pasta dos extratos, para o que o arquivo municipal não traz. Sem ela, arquivo municipal ausente falha. */
  deExtratos?: string;
};

const LUGAR_DA_LINHA: Record<string, string> = { Brasil: BRASIL, 'Santa Catarina': SANTA_CATARINA };

const REDE_DA_LINHA: Record<string, Rede> = {
  Total: 'todas',
  Pública: 'publica',
  Publica: 'publica',
  Privada: 'privada',
  Federal: 'federal',
  Estadual: 'estadual',
  Municipal: 'municipal',
};

function redeDe(texto: Celula): Rede | null {
  // O IDEB traz notas de rodapé no rótulo: "Total (4)", "Privada (1)".
  const limpo = String(texto ?? '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
  return REDE_DA_LINHA[limpo] ?? null;
}

type Coluna = { indicador: string; etapa: string; recorte: string };

type Definicao = {
  chave: string;
  ano: number;
  periodo: string;
  unidade: string;
  arquivoEstadual: RegExp;
  arquivoMunicipal: RegExp;
  secaoDoExtrato: string;
  colunas: Record<string, Coluna>;
};

const FUNDAMENTAL: Record<string, string> = {
  FUN: 'fundamental',
  FUN_AI: 'anos_iniciais',
  FUN_AF: 'anos_finais',
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`FUN_0${i + 1}`, `ano_${i + 1}`])),
};
const MEDIO: Record<string, string> = {
  MED: 'medio',
  MED_01: 'serie_1',
  MED_02: 'serie_2',
  MED_03: 'serie_3',
  MED_04: 'serie_4',
  MED_NS: 'medio_nao_seriado',
};
const INFANTIL: Record<string, string> = { ED_INF: 'educacao_infantil', CRE: 'creche', PRE: 'pre_escola' };

const colunasDeEtapa = (indicador: string, etapas: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(etapas).map(([sufixo, etapa]) => [`${sufixo}_CAT_0`, { indicador, etapa, recorte: '' }]),
  );

const colunasDeRecorte = (indicador: string, etapas: Record<string, string>, grupos: Record<number, string>) =>
  Object.fromEntries(
    Object.entries(etapas).flatMap(([sufixo, etapa]) =>
      Object.entries(grupos).map(([n, recorte]) => [`${sufixo}_CAT_${n}`, { indicador, etapa, recorte }]),
    ),
  );

const GRUPOS_DE_FORMACAO = { 1: 'grupo_1', 2: 'grupo_2', 3: 'grupo_3', 4: 'grupo_4', 5: 'grupo_5' };
const NIVEIS_DE_ESFORCO = {
  1: 'nivel_1',
  2: 'nivel_2',
  3: 'nivel_3',
  4: 'nivel_4',
  5: 'nivel_5',
  6: 'nivel_6',
};

const rendimento = Object.fromEntries(
  [
    [1, 'aprovacao'],
    [2, 'reprovacao'],
    [3, 'abandono'],
  ].flatMap(([n, indicador]) =>
    Object.entries({ ...FUNDAMENTAL, ...MEDIO }).map(([sufixo, etapa]) => [
      `${n}_CAT_${sufixo}`,
      { indicador: indicador as string, etapa, recorte: '' },
    ]),
  ),
);

// A transição escreve o sufixo sem separador: 1_CAT1_CATFUN_AI. Não há 4ª série nem não seriado.
const transicao = Object.fromEntries(
  [
    [1, 'promocao'],
    [2, 'repetencia'],
    [3, 'evasao'],
    [4, 'migracao_eja'],
  ].flatMap(([n, indicador]) =>
    Object.entries({ ...FUNDAMENTAL, MED: 'medio', MED_01: 'serie_1', MED_02: 'serie_2', MED_03: 'serie_3' }).map(
      ([sufixo, etapa]) => [`1_CAT${n}_CAT${sufixo}`, { indicador: indicador as string, etapa, recorte: '' }],
    ),
  ),
);

const INDICES_POR_ARQUIVO: Definicao[] = [
  {
    chave: 'inep_rendimento',
    ano: 2025,
    periodo: '2025',
    unidade: '%',
    arquivoEstadual: /^tx_rend_brasil_regioes_ufs_2025\.xlsx$/i,
    arquivoMunicipal: /^tx_rend_municipios_2025\.xlsx$/i,
    secaoDoExtrato: 'rendimento_2025',
    colunas: rendimento,
  },
  {
    chave: 'inep_transicao',
    ano: 2022,
    periodo: '2021-2022',
    unidade: '%',
    arquivoEstadual: /^tx_transicao_brasil_regioes_ufs_2021_2022\.xlsx$/i,
    arquivoMunicipal: /^tx_transicao_municipios_2021_2022\.xlsx$/i,
    secaoDoExtrato: 'transicao_2021_2022',
    colunas: transicao,
  },
  {
    chave: 'inep_distorcao',
    ano: 2025,
    periodo: '2025',
    unidade: '%',
    arquivoEstadual: /^tdi_brasil_regioes_ufs_2025\.xlsx$/i,
    arquivoMunicipal: /^tdi_municipios_2025\.xlsx$/i,
    secaoDoExtrato: 'distorcao_idade_serie_2025',
    colunas: colunasDeEtapa('distorcao', { ...FUNDAMENTAL, ...MEDIO, MED_NS: 'medio_nao_seriado' }),
  },
  {
    chave: 'inep_turmas',
    ano: 2025,
    periodo: '2025',
    unidade: 'alunos',
    arquivoEstadual: /^atu_brasil_regioes_ufs_2025\.xlsx$/i,
    arquivoMunicipal: /^atu_municipios_2025\.xlsx$/i,
    secaoDoExtrato: 'alunos_por_turma_2025',
    colunas: colunasDeEtapa('alunos_por_turma', { ...INFANTIL, ...FUNDAMENTAL, MULT_ETA: 'multietapa', ...MEDIO }),
  },
  {
    chave: 'inep_horas',
    ano: 2025,
    periodo: '2025',
    unidade: 'horas',
    arquivoEstadual: /^had_brasil_regioes_ufs_2025\.xlsx$/i,
    arquivoMunicipal: /^had_municipios_2025\.xlsx$/i,
    secaoDoExtrato: 'horas_aula_2025',
    colunas: colunasDeEtapa('horas_aula', { ...INFANTIL, ...FUNDAMENTAL, ...MEDIO }),
  },
  {
    chave: 'inep_docentes_superior',
    ano: 2025,
    periodo: '2025',
    unidade: '%',
    arquivoEstadual: /^dsu_brasil_regioes_ufs_2025\.xlsx$/i,
    arquivoMunicipal: /^dsu_municipios_2025\.xlsx$/i,
    secaoDoExtrato: 'docentes_com_superior_2025',
    colunas: colunasDeEtapa('docentes_superior', {
      ...INFANTIL,
      FUN: 'fundamental',
      FUN_AI: 'anos_iniciais',
      FUN_AF: 'anos_finais',
      MED: 'medio',
      EJA: 'eja',
      EJA_FUN: 'eja_fundamental',
      EJA_MED: 'eja_medio',
    }),
  },
  {
    chave: 'inep_adequacao',
    ano: 2025,
    periodo: '2025',
    unidade: '%',
    arquivoEstadual: /^afd_brasil_regioes_ufs_2025\.xlsx$/i,
    arquivoMunicipal: /^afd_municipios_2025\.xlsx$/i,
    secaoDoExtrato: 'adequacao_docente_2025',
    colunas: colunasDeRecorte(
      'adequacao',
      {
        ED_INF: 'educacao_infantil',
        FUN: 'fundamental',
        FUN_AI: 'anos_iniciais',
        FUN_AF: 'anos_finais',
        MED: 'medio',
        EJA_FUN: 'eja_fundamental',
        EJA_MED: 'eja_medio',
      },
      GRUPOS_DE_FORMACAO,
    ),
  },
  {
    chave: 'inep_regularidade',
    ano: 2025,
    periodo: '2025',
    unidade: '%',
    arquivoEstadual: /^ird_brasil_regioes_ufs_2025\.xlsx$/i,
    arquivoMunicipal: /^ird_municipios_2025\.xlsx$/i,
    secaoDoExtrato: 'regularidade_docente_2025',
    colunas: {
      EDU_BAS_CAT_1: { indicador: 'regularidade', etapa: '', recorte: 'baixa' },
      EDU_BAS_CAT_2: { indicador: 'regularidade', etapa: '', recorte: 'media_baixa' },
      EDU_BAS_CAT_3: { indicador: 'regularidade', etapa: '', recorte: 'media_alta' },
      EDU_BAS_CAT_4: { indicador: 'regularidade', etapa: '', recorte: 'alta' },
    },
  },
  {
    chave: 'inep_esforco',
    ano: 2025,
    periodo: '2025',
    unidade: '%',
    arquivoEstadual: /^ied_brasil_regioes_ufs_2025\.xlsx$/i,
    arquivoMunicipal: /^ied_municipios_2025\.xlsx$/i,
    secaoDoExtrato: 'esforco_docente_2025',
    colunas: colunasDeRecorte(
      'esforco',
      { FUN: 'fundamental', FUN_AI: 'anos_iniciais', FUN_AF: 'anos_finais', MED: 'medio' },
      NIVEIS_DE_ESFORCO,
    ),
  },
];

function exigir(pasta: string, nome: RegExp): string {
  const achado = acharArquivo(pasta, nome);
  if (!achado) throw new Error(`Arquivo não encontrado em ${pasta}: ${nome.source}`);
  return achado;
}

/** Os registros de uma linha da planilha, um por coluna do indicador. */
function registrosDaLinha(
  { colunas, unidade, periodo }: Definicao,
  lugar: string,
  rede: Rede,
  campos: Record<string, Celula>,
): RegistroBruto[] {
  return Object.entries(colunas)
    .filter(([codigo]) => codigo in campos)
    .map(([codigo, { indicador, etapa, recorte }]) =>
      registroDeValor({
        indicador,
        lugar,
        rede,
        etapa,
        recorte,
        periodo,
        valor: taxaDoInep(campos[codigo]),
        unidade,
      }),
    );
}

const primeiroCodigo = (definicao: Definicao) => Object.keys(definicao.colunas)[0] as string;

async function lerEstadual(definicao: Definicao, caminho: string): Promise<RegistroBruto[]> {
  const registros: RegistroBruto[] = [];
  const transicao = definicao.chave === 'inep_transicao';
  const colunaDoLugar = transicao ? 'CODIGO' : 'UNIDGEO';
  const colunaDaLocalizacao = transicao ? 'NO_LOCALIZACAO' : 'NO_CATEGORIA';
  const codigos = [colunaDoLugar, colunaDaLocalizacao, 'NO_DEPENDENCIA', primeiroCodigo(definicao)];
  for await (const { campos } of registrosPorCodigo(caminho, codigos)) {
    const lugar = LUGAR_DA_LINHA[String(campos[colunaDoLugar] ?? '').trim()];
    if (!lugar || String(campos[colunaDaLocalizacao] ?? '').trim() !== 'Total') continue;
    const rede = redeDe(campos.NO_DEPENDENCIA ?? null);
    if (!rede) throw new Error(`${path.basename(caminho)}: dependência inesperada`);
    registros.push(...registrosDaLinha(definicao, lugar, rede, campos));
  }
  return registros;
}

async function lerMunicipal(definicao: Definicao, caminho: string): Promise<RegistroBruto[]> {
  const registros: RegistroBruto[] = [];
  const colunaDaLocalizacao = definicao.chave === 'inep_transicao' ? 'NO_LOCALIZACAO' : 'NO_CATEGORIA';
  const codigos = ['CO_MUNICIPIO', colunaDaLocalizacao, 'NO_DEPENDENCIA', primeiroCodigo(definicao)];
  for await (const { campos } of registrosPorCodigo(caminho, codigos)) {
    if (String(campos.CO_MUNICIPIO) !== ORLEANS) continue;
    if (String(campos[colunaDaLocalizacao] ?? '').trim() !== 'Total') continue;
    const rede = redeDe(campos.NO_DEPENDENCIA ?? null);
    if (!rede) throw new Error(`${path.basename(caminho)}: dependência inesperada`);
    registros.push(...registrosDaLinha(definicao, ORLEANS, rede, campos));
  }
  return registros;
}

type LinhaDoExtrato = { localizacao: string; dependencia: string; valores: Record<string, unknown> };

async function lerJson(pasta: string, nome: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(pasta, nome), 'utf8')) as Record<string, unknown>;
}

/** Orleans a partir de `inep-orleans.json`: mesmas colunas, com as chaves do extrato. */
export function registrosDoExtrato(definicao: Definicao, linhas: readonly LinhaDoExtrato[]): RegistroBruto[] {
  const permitidas = new Set(
    Object.values(definicao.colunas).map(({ indicador, etapa, recorte }) => `${indicador}:${etapa}:${recorte}`),
  );
  const unico = Object.values(definicao.colunas)[0]?.indicador as string;
  const registros: RegistroBruto[] = [];
  for (const { localizacao, dependencia, valores } of linhas) {
    if (localizacao !== 'Total') continue;
    const rede = redeDe(dependencia);
    if (!rede) throw new Error(`${definicao.secaoDoExtrato}: dependência inesperada no extrato`);
    const adicionar = (indicador: string, etapa: string, recorte: string, valor: unknown) => {
      if (!permitidas.has(`${indicador}:${etapa}:${recorte}`)) {
        throw new Error(`${definicao.secaoDoExtrato}: ${indicador}/${etapa}/${recorte} fora do layout`);
      }
      registros.push(
        registroDeValor({
          indicador,
          lugar: ORLEANS,
          rede,
          etapa,
          recorte,
          periodo: definicao.periodo,
          valor: taxaDoInep(valor),
          unidade: definicao.unidade,
        }),
      );
    };
    for (const [chave, conteudo] of Object.entries(valores)) {
      const porIndicador = Object.values(definicao.colunas).some((c) => c.indicador === chave);
      if (porIndicador) {
        for (const [etapa, v] of Object.entries(conteudo as object)) adicionar(chave, etapa, '', v);
      } else if (conteudo !== null && typeof conteudo === 'object') {
        for (const [recorte, v] of Object.entries(conteudo)) adicionar(unico, chave, recorte, v);
      } else if (permitidas.has(`${unico}:${chave}:`)) {
        adicionar(unico, chave, '', conteudo);
      } else {
        adicionar(unico, '', chave, conteudo);
      }
    }
  }
  return registros;
}

type Origens = Record<string, string>;

async function orleansDe(
  definicao: { secaoDoExtrato: string; arquivoMunicipal: RegExp },
  { origem, deExtratos }: OpcoesDoInep,
): Promise<{ caminho: string | null; extrato: Record<string, unknown> | null }> {
  const caminho = acharArquivo(origem, definicao.arquivoMunicipal);
  if (caminho) return { caminho, extrato: null };
  if (!deExtratos) {
    throw new Error(
      `Arquivo municipal ausente (${definicao.arquivoMunicipal.source}): baixe o arquivo ou peça --de-extratos`,
    );
  }
  return { caminho: null, extrato: await lerJson(deExtratos, 'inep-orleans.json') };
}

async function loteDeIndices(definicao: Definicao, opcoes: OpcoesDoInep): Promise<Lote> {
  const estadual = exigir(opcoes.origem, definicao.arquivoEstadual);
  const { caminho, extrato } = await orleansDe(definicao, opcoes);
  const deFora = await lerEstadual(definicao, estadual);
  const deOrleans = caminho
    ? await lerMunicipal(definicao, caminho)
    : registrosDoExtrato(definicao, extrato?.[definicao.secaoDoExtrato] as LinhaDoExtrato[]);
  return {
    chave: definicao.chave,
    ano: definicao.ano,
    registros: [...deOrleans, ...deFora],
    filtro: filtroDoLote(
      { [ORLEANS]: caminho ? path.basename(caminho) : `extrato:inep-orleans.json#${definicao.secaoDoExtrato}` },
      path.basename(estadual),
    ),
  };
}

const filtroDoLote = (orleans: Origens, ...estaduais: string[]) => {
  const arquivo = estaduais.join(', ');
  return {
    localizacao: 'Total',
    origemPorLugar: { ...orleans, [SANTA_CATARINA]: arquivo, [BRASIL]: arquivo },
    extrato: Object.values(orleans).some((o) => o.startsWith('extrato:')),
  };
};

// ---- Remuneração da RAIS: um arquivo por abrangência, e cada um com os próprios códigos.

const SIGILO_DA_RAIS = ['a', 'b', 'c', 'd', 'e'];
const ESCOLARIDADE: Record<string, string> = {
  Total: 'total',
  'Com Superior': 'com_superior',
  'Sem Superior': 'sem_superior',
};

type LinhaDaRais = {
  docentes: Celula;
  localizados: Celula;
  q1: Celula;
  mediana: Celula;
  media: Celula;
  q3: Celula;
  carga: Celula;
  h40: Celula;
};

function registrosDaRais(lugar: string, rede: Rede, escolaridade: string, linha: LinhaDaRais): RegistroBruto[] {
  const medida = (recorte: string, bruto: Celula, percentual = false) => {
    const decimal = decimalDaFonte(bruto, 2, SIGILO_DA_RAIS);
    return registroDeFinanca({
      indicador: 'remuneracao_rais',
      lugar,
      rede,
      recorte: `${escolaridade}:${recorte}`,
      periodo: '2021',
      valor: percentual ? null : decimal,
      percentual: percentual ? decimal : null,
    });
  };
  // Até 4 docentes, a contagem fica de fora: esta tabela não guarda "menos de 5".
  const docentes = Number(linha.docentes);
  return [
    medida('docentes', docentes > 0 && docentes < 5 ? null : linha.docentes),
    medida('localizados_rais', linha.localizados, true),
    medida('primeiro_quartil', linha.q1),
    medida('mediana', linha.mediana),
    medida('media', linha.media),
    medida('terceiro_quartil', linha.q3),
    medida('carga_semanal', linha.carga),
    medida('media_40h', linha.h40),
  ];
}

async function loteDaRais({ origem }: OpcoesDoInep): Promise<Lote> {
  const registros: RegistroBruto[] = [];
  const municipal = exigir(origem, /^remuneracao_docentes_municipios_2021\.xlsx$/i);
  const estadual = exigir(origem, /^remuneracao_docentes_uf_2021\.xlsx$/i);
  const nacional = exigir(origem, /^remuneracao_docentes_brasil_2021\.xlsx$/i);
  const cat = (c: Record<string, Celula>, n: number, sep = '') => c[`ED_BAS_CAT${sep}${n}`] ?? null;
  const daCategoria = (c: Record<string, Celula>, sep: string): LinhaDaRais => ({
    docentes: cat(c, 1, sep),
    localizados: cat(c, 2, sep),
    q1: cat(c, 3, sep),
    mediana: cat(c, 4, sep),
    media: cat(c, 5, sep),
    q3: cat(c, 6, sep),
    carga: cat(c, 8, sep),
    h40: cat(c, 9, sep),
  });

  for await (const { campos } of registrosPorCodigo(municipal, [
    'CO_MUNICIPIO',
    'NO_DEPENDENCIA',
    'NO_CATEGORIA',
    'ED_BAS_CAT9',
  ])) {
    if (String(campos.CO_MUNICIPIO) !== ORLEANS) continue;
    const rede = redeDe(campos.NO_DEPENDENCIA ?? null);
    const escolaridade = ESCOLARIDADE[String(campos.NO_CATEGORIA)];
    if (!rede || !escolaridade) throw new Error('Remuneração municipal: dependência ou escolaridade inesperada');
    registros.push(...registrosDaRais(ORLEANS, rede, escolaridade, daCategoria(campos, '')));
  }
  for await (const { campos } of registrosPorCodigo(estadual, [
    'SG_UF',
    'NO_DEPENDENCIA',
    'NO_CATEGORIA',
    'ED_BAS_CAT_9',
  ])) {
    if (campos.SG_UF !== 'SC') continue;
    const rede = redeDe(campos.NO_DEPENDENCIA ?? null);
    const escolaridade = ESCOLARIDADE[String(campos.NO_CATEGORIA)];
    if (!rede || !escolaridade) throw new Error('Remuneração estadual: dependência ou escolaridade inesperada');
    registros.push(...registrosDaRais(SANTA_CATARINA, rede, escolaridade, daCategoria(campos, '_')));
  }
  for await (const { campos } of registrosPorCodigo(nacional, [
    'NO_CODIGO',
    'DEPENDENCIA',
    'Escolaridade',
    'rem_40_horas',
  ])) {
    if (campos.NO_CODIGO !== 'Brasil') continue;
    const rede = redeDe(campos.DEPENDENCIA ?? null);
    const escolaridade = ESCOLARIDADE[String(campos.Escolaridade)];
    if (!rede || !escolaridade) throw new Error('Remuneração nacional: dependência ou escolaridade inesperada');
    registros.push(
      ...registrosDaRais(BRASIL, rede, escolaridade, {
        docentes: campos.n_censo ?? null,
        localizados: campos.localizados ?? null,
        q1: campos.quartil_1 ?? null,
        mediana: campos.mediana ?? null,
        media: campos.media ?? null,
        q3: campos.quartil3 ?? null,
        carga: campos.carga_media ?? null,
        h40: campos.rem_40_horas ?? null,
      }),
    );
  }
  return {
    chave: 'inep_remuneracao',
    ano: 2021,
    registros,
    filtro: {
      arquivos: [path.basename(municipal), path.basename(estadual), path.basename(nacional)],
      extrato: false,
    },
  };
}

// ---- INSE: rede 5 é a pública (estadual e municipal), localização 0 é o total, e há linhas repetidas.

const REDE_DO_INSE: Record<number, Rede> = {
  0: 'todas',
  1: 'federal',
  2: 'estadual',
  3: 'municipal',
  4: 'privada',
  5: 'publica',
};

function registrosDoInse(lugar: string, rede: Rede, campos: Record<string, Celula>): RegistroBruto[] {
  const base = { indicador: 'inse', lugar, rede, periodo: '2023' };
  return [
    pessoas({ ...base, recorte: 'alunos' }, contagemPublicavel(Number(campos.QTD_ALUNOS_INSE))),
    registroDeValor({ ...base, valor: decimalDaFonte(campos.MEDIA_INSE, 2), unidade: 'indice' }),
    ...Array.from({ length: 8 }, (_, i) =>
      registroDeValor({
        ...base,
        recorte: `nivel_${i + 1}`,
        valor: taxaDoInep(campos[`PC_NIVEL_${i + 1}`]),
        unidade: '%',
      }),
    ),
  ];
}

export async function loteDoInse(arquivos: { municipal: string; estadual: string; nacional: string }): Promise<Lote> {
  const codigos = ['NU_ANO_SAEB', 'TP_TIPO_REDE', 'TP_LOCALIZACAO', 'QTD_ALUNOS_INSE', 'MEDIA_INSE', 'PC_NIVEL_8'];
  const porId = new Map<string, RegistroBruto>();
  const assinaturaPorLinha = new Map<string, string>();
  const incluir = (lugar: string, campos: Record<string, Celula>) => {
    const rede = REDE_DO_INSE[Number(campos.TP_TIPO_REDE)];
    if (!rede || Number(campos.TP_LOCALIZACAO) !== 0) return;
    const chave = `${lugar}:${rede}`;
    const assinatura = JSON.stringify(campos);
    const anterior = assinaturaPorLinha.get(chave);
    if (anterior !== undefined) {
      if (anterior !== assinatura) throw new Error(`INSE: linhas diferentes para ${chave}`);
      return;
    }
    assinaturaPorLinha.set(chave, assinatura);
    for (const r of registrosDoInse(lugar, rede, campos)) porId.set(r.id, r);
  };

  for await (const { campos } of registrosPorCodigo(arquivos.municipal, [...codigos, 'CO_MUNICIPIO'])) {
    if (String(campos.CO_MUNICIPIO) === ORLEANS) incluir(ORLEANS, campos);
  }
  for await (const { campos } of registrosPorCodigo(arquivos.estadual, [...codigos, 'CO_UF', 'TP_CAPITAL'])) {
    if (Number(campos.CO_UF) === 42 && Number(campos.TP_CAPITAL) === 0) incluir(SANTA_CATARINA, campos);
  }
  for await (const { campos } of registrosPorCodigo(arquivos.nacional, [...codigos, 'TP_CAPITAL'])) {
    if (Number(campos.TP_CAPITAL) === 0) incluir(BRASIL, campos);
  }
  return {
    chave: 'inep_inse',
    ano: 2023,
    registros: [...porId.values()],
    filtro: {
      arquivos: Object.values(arquivos).map((a) => path.basename(a)),
      redes: 'TP_TIPO_REDE 0 a 5; 5 é a pública (estadual e municipal)',
      extrato: false,
    },
  };
}

// ---- Alfabetização: a meta de 2030 é texto ("> 80") nos estaduais.

const ETAPA_DA_ALFABETIZACAO = 'ano_2';
const ANOS_DE_RESULTADO = ['2023', '2024', '2025'];
const ANOS_DE_META = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

function meta(lugar: string, rede: Rede, periodo: string, bruto: unknown) {
  const base = { indicador: 'alfabetizacao_meta', lugar, rede, etapa: ETAPA_DA_ALFABETIZACAO, periodo, unidade: '%' };
  if (typeof bruto === 'string' && !/^-?\d+([.,]\d+)?$/.test(bruto.trim()) && !['-', '--', ''].includes(bruto.trim())) {
    return registroDeValor({ ...base, valor: null, texto: bruto.trim() });
  }
  return registroDeValor({ ...base, valor: taxaDoInep(bruto) });
}

function registrosDaAlfabetizacao(lugar: string, rede: Rede, campos: Record<string, Celula>): RegistroBruto[] {
  const base = { lugar, rede, etapa: ETAPA_DA_ALFABETIZACAO, unidade: '%' };
  return [
    ...ANOS_DE_RESULTADO.map((periodo) =>
      registroDeValor({
        ...base,
        indicador: 'alfabetizacao_2o_ano',
        periodo,
        valor: taxaDoInep(campos[`PC_ALUNO_ALFABETIZADO_${periodo}`]),
      }),
    ),
    ...ANOS_DE_META.map((periodo) => meta(lugar, rede, periodo, campos[`META_FINAL_${periodo}`])),
    registroDeValor({
      ...base,
      indicador: 'alfabetizacao_participacao',
      periodo: '2025',
      valor: taxaDoInep(campos.PC_AVALIADOS_LP),
    }),
  ];
}

type AlfabetizacaoDoExtrato = {
  percentual: Record<string, unknown>;
  meta: Record<string, unknown>;
  participacao_pct: unknown;
};

const registrosDaAlfabetizacaoDoExtrato = ({ percentual, meta: metas, participacao_pct }: AlfabetizacaoDoExtrato) => {
  const base = { lugar: ORLEANS, rede: 'municipal' as const, etapa: ETAPA_DA_ALFABETIZACAO, unidade: '%' };
  return [
    ...Object.entries(percentual).map(([periodo, v]) =>
      registroDeValor({ ...base, indicador: 'alfabetizacao_2o_ano', periodo, valor: taxaDoInep(v) }),
    ),
    ...Object.entries(metas).map(([periodo, v]) => meta(ORLEANS, 'municipal', periodo, v)),
    registroDeValor({
      ...base,
      indicador: 'alfabetizacao_participacao',
      periodo: '2025',
      valor: taxaDoInep(participacao_pct),
    }),
  ];
};

async function loteDaAlfabetizacao(opcoes: OpcoesDoInep): Promise<Lote> {
  const estadual = exigir(opcoes.origem, /^resultados_e_metas_ufs_2025.*\.xlsx$/i);
  const { caminho, extrato } = await orleansDe(
    { secaoDoExtrato: 'alfabetizacao_2o_ano', arquivoMunicipal: /^resultados_e_metas_municipios_2025.*\.xlsx$/i },
    opcoes,
  );
  const codigos = ['NOME_UF', 'REDE', 'PC_ALUNO_ALFABETIZADO_2025', 'META_FINAL_2030', 'PC_AVALIADOS_LP'];
  const registros: RegistroBruto[] = [];
  for await (const { campos } of registrosPorCodigo(estadual, codigos)) {
    // "Santa Catarina*": o asterisco é nota de rodapé do arquivo.
    const lugar =
      LUGAR_DA_LINHA[
        String(campos.NOME_UF ?? '')
          .replace('*', '')
          .trim()
      ];
    if (!lugar) continue;
    if (String(campos.REDE).trim().toUpperCase() !== 'PÚBLICA') throw new Error('Alfabetização: rede inesperada');
    registros.push(...registrosDaAlfabetizacao(lugar, 'publica', campos));
  }
  if (caminho) {
    for await (const { campos } of registrosPorCodigo(caminho, ['CO_MUNICIPIO', 'PC_ALUNO_ALFABETIZADO_2025'])) {
      if (String(campos.CO_MUNICIPIO) === ORLEANS) {
        registros.push(...registrosDaAlfabetizacao(ORLEANS, 'municipal', campos));
      }
    }
  } else {
    registros.push(...registrosDaAlfabetizacaoDoExtrato(extrato?.alfabetizacao_2o_ano as AlfabetizacaoDoExtrato));
  }
  return {
    chave: 'inep_alfabetizacao',
    ano: 2025,
    registros,
    filtro: {
      redes: 'Orleans é rede municipal; SC e Brasil, rede pública',
      ...filtroDoLote(
        { [ORLEANS]: caminho ? path.basename(caminho) : 'extrato:inep-orleans.json#alfabetizacao_2o_ano' },
        path.basename(estadual),
      ),
    },
  };
}

// ---- IDEB: Brasil e SC vêm dos arquivos; Orleans, e a série de SC nas demais redes, do IBGE.

const ANOS_DO_IDEB = ['2005', '2007', '2009', '2011', '2013', '2015', '2017', '2019', '2021', '2023', '2025'];
const SEM_DADO_DO_IDEB = ['ND', '*', '**', '***', '-', '--', '---', 'n/d'];

const etapaDaAba = (aba: string) =>
  /Iniciais|\(AI\)/i.test(aba)
    ? 'anos_iniciais'
    : /Finais|\(AF\)/i.test(aba)
      ? 'anos_finais'
      : /\(EM\)/i.test(aba)
        ? 'medio'
        : null;

/**
 * Na aba de anos finais do Brasil, a coluna do IDEB 2023 vem sem código. Só vale a coluna vazia que
 * fica exatamente entre as de 2021 e 2025; qualquer outra forma continua sem dado.
 */
function comIdeb2023SemCodigo(
  campos: Record<string, Celula>,
  celulas: readonly Celula[],
  cabecalho: readonly string[],
): Record<string, Celula> {
  if ('VL_OBSERVADO_2023' in campos) return campos;
  const posicao = cabecalho.indexOf('VL_OBSERVADO_2021') + 1;
  if (posicao === 0 || cabecalho[posicao] !== '' || cabecalho[posicao + 1] !== 'VL_OBSERVADO_2025') return campos;
  return { ...campos, VL_OBSERVADO_2023: celulas[posicao] ?? null };
}

function parcelasDoIdeb(
  lugar: string,
  rede: Rede,
  etapa: string,
  {
    rendimento,
    matematica,
    portugues,
    aprovacao,
  }: Record<'rendimento' | 'matematica' | 'portugues' | 'aprovacao', unknown>,
) {
  const base = { lugar, rede, etapa, periodo: '2025' };
  const dec = (v: unknown) => decimalDaFonte(v, 2, SEM_DADO_DO_IDEB);
  return [
    registroDeValor({ ...base, indicador: 'ideb_rendimento', valor: dec(rendimento), unidade: 'indice' }),
    registroDeValor({ ...base, indicador: 'ideb_matematica', valor: dec(matematica), unidade: 'nota' }),
    registroDeValor({ ...base, indicador: 'ideb_portugues', valor: dec(portugues), unidade: 'nota' }),
    registroDeValor({
      ...base,
      indicador: 'ideb_aprovacao',
      valor: decimalDaFonte(aprovacao, 1, SEM_DADO_DO_IDEB),
      unidade: '%',
    }),
  ];
}

/**
 * Uma aba do IDEB. `VL_INDICADOR_REND_2025` vem com o código errado numa aba de UFs: lá, a coluna de
 * 2025 repete `VL_INDICADOR_REND_2023`, e a repetição é reconhecida pelo `#2`.
 */
function registrosDoIdeb(
  lugar: string,
  rede: Rede,
  etapa: string,
  campos: Record<string, Celula>,
  comSerie: boolean,
): RegistroBruto[] {
  const rendimento = campos.VL_INDICADOR_REND_2025 ?? campos['VL_INDICADOR_REND_2023#2'];
  return [
    ...(comSerie
      ? ANOS_DO_IDEB.map((periodo) =>
          registroDeValor({
            indicador: 'ideb',
            lugar,
            rede,
            etapa,
            periodo,
            valor: decimalDaFonte(campos[`VL_OBSERVADO_${periodo}`], 1, SEM_DADO_DO_IDEB),
            unidade: 'indice',
          }),
        )
      : []),
    ...parcelasDoIdeb(lugar, rede, etapa, {
      rendimento,
      matematica: campos.VL_NOTA_MATEMATICA_2025,
      portugues: campos.VL_NOTA_PORTUGUES_2025,
      aprovacao: campos.VL_APROVACAO_2025_SI_4,
    }),
  ];
}

const CODIGOS_DO_IDEB = [
  'VL_OBSERVADO_2025',
  'VL_NOTA_MATEMATICA_2025',
  'VL_NOTA_PORTUGUES_2025',
  'VL_APROVACAO_2025_SI_4',
];

type IdebDoExtrato = {
  rede: string;
  rendimento_2025: unknown;
  matematica_2025: unknown;
  portugues_2025: unknown;
  aprovacao_2025: unknown;
};

const SECOES_DO_IDEB: Record<string, string> = {
  anos_iniciais: 'anos_iniciais',
  anos_finais: 'anos_finais',
  ensino_medio: 'medio',
};

async function loteDoIdeb(opcoes: OpcoesDoInep): Promise<Lote> {
  const nacional = exigir(opcoes.origem, /^divulgacao_brasil_ideb_2025\.xlsx$/i);
  const estadual = exigir(opcoes.origem, /^divulgacao_regioes_ufs_ideb_2025\.xlsx$/i);
  const municipais = [
    /^divulgacao_anos_iniciais_municipios_2025\.xlsx$/i,
    /^divulgacao_anos_finais_municipios_2025\.xlsx$/i,
    /^divulgacao_ensino_medio_municipios_2025\.xlsx$/i,
  ].map((nome) => acharArquivo(opcoes.origem, nome));
  const registros: RegistroBruto[] = [];

  for await (const { aba, campos, celulas, cabecalho } of registrosPorCodigo(nacional, [...CODIGOS_DO_IDEB, 'rede'])) {
    const etapa = etapaDaAba(aba);
    const rede = redeDe(campos.rede ?? null);
    if (etapa && rede && celulas[0] === 'Brasil') {
      registros.push(...registrosDoIdeb(BRASIL, rede, etapa, comIdeb2023SemCodigo(campos, celulas, cabecalho), true));
    }
  }
  // Nas UFs, as duas primeiras colunas não têm código: lugar e rede ficam por posição.
  for await (const { aba, campos, celulas } of registrosPorCodigo(estadual, CODIGOS_DO_IDEB)) {
    const etapa = etapaDaAba(aba);
    const rede = redeDe(celulas[1] ?? null);
    if (!etapa || !rede || String(celulas[0]).trim() !== 'Santa Catarina') continue;
    registros.push(...registrosDoIdeb(SANTA_CATARINA, rede, etapa, campos, rede === 'municipal'));
  }

  let origemDeOrleans: string;
  if (municipais.every(Boolean)) {
    for (const caminho of municipais as string[]) {
      for await (const { aba, campos } of registrosPorCodigo(caminho, [...CODIGOS_DO_IDEB, 'CO_MUNICIPIO', 'REDE'])) {
        const rede = redeDe(campos.REDE ?? null);
        const etapa = etapaDaAba(aba) ?? etapaDaAba(path.basename(caminho));
        if (String(campos.CO_MUNICIPIO) === ORLEANS && rede && etapa) {
          registros.push(...registrosDoIdeb(ORLEANS, rede, etapa, campos, false));
        }
      }
    }
    origemDeOrleans = (municipais as string[]).map((c) => path.basename(c)).join(', ');
  } else {
    if (!opcoes.deExtratos)
      throw new Error('Arquivos municipais do IDEB ausentes: baixe os arquivos ou peça --de-extratos');
    const { ideb } = (await lerJson(opcoes.deExtratos, 'inep-orleans.json')) as {
      ideb: Record<string, IdebDoExtrato[]>;
    };
    for (const [secao, etapa] of Object.entries(SECOES_DO_IDEB)) {
      for (const linha of ideb[secao] ?? []) {
        const rede = redeDe(linha.rede);
        if (!rede) throw new Error('IDEB: rede inesperada no extrato');
        registros.push(
          ...parcelasDoIdeb(ORLEANS, rede, etapa, {
            rendimento: linha.rendimento_2025,
            matematica: linha.matematica_2025,
            portugues: linha.portugues_2025,
            aprovacao: linha.aprovacao_2025,
          }),
        );
      }
    }
    origemDeOrleans = 'extrato:inep-orleans.json#ideb';
  }
  return {
    chave: 'inep_ideb',
    ano: 2025,
    registros,
    filtro: {
      serie: 'ideb só para o Brasil; Orleans e SC vêm do IBGE, e o arquivo de UFs do INEP não traz rede municipal',
      ...filtroDoLote({ [ORLEANS]: origemDeOrleans }, path.basename(nacional), path.basename(estadual)),
    },
  };
}

/** Os lotes do INEP que vêm dos indicadores. ENEM e ensino superior têm extrator próprio. */
export async function extrairInep(opcoes: OpcoesDoInep): Promise<Lote[]> {
  const lotes: Lote[] = [];
  for (const definicao of INDICES_POR_ARQUIVO) lotes.push(await loteDeIndices(definicao, opcoes));
  lotes.push(await loteDaRais(opcoes));
  lotes.push(
    await loteDoInse({
      municipal: exigir(opcoes.origem, /^inse_2023_municipios\.xlsx$/i),
      estadual: exigir(opcoes.origem, /^inse_2023_estados\.xlsx$/i),
      nacional: exigir(opcoes.origem, /^inse_2023_brasil\.xlsx$/i),
    }),
  );
  lotes.push(await loteDaAlfabetizacao(opcoes));
  lotes.push(await loteDoIdeb(opcoes));
  return lotes;
}
