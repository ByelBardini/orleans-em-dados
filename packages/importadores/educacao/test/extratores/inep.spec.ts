import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extrairInep, loteDoInse } from '../../src/extratores/inep';
import type { Lote } from '../../src/extratores/snapshot';
import { idsDe, pastaTemporaria, planilha, registroDe } from '../support/arquivos';

// Um conjunto mínimo de arquivos fictícios: cada planilha só tem as colunas que o teste olha e o que o layout exige.
const rendimentoEstadual = (linhas: (string | number)[][]) =>
  [
    ['Taxas de Rendimento - título'],
    ['NU_ANO_CENSO', 'UNIDGEO', 'NO_CATEGORIA', 'NO_DEPENDENCIA', '1_CAT_FUN', '2_CAT_FUN', '3_CAT_FUN'],
    ...linhas,
  ] as (string | number)[][];

const indiceSimples = async (
  pasta: string,
  arquivo: string,
  coluna: string,
  colunaDoLugar = 'UNIDGEO',
  localizacao = 'NO_CATEGORIA',
) =>
  planilha(pasta, arquivo, [
    {
      nome: 'dados',
      linhas: [
        [colunaDoLugar, localizacao, 'NO_DEPENDENCIA', coluna],
        ['Brasil', 'Total', 'Total', 1],
      ],
    },
  ]);

const INSE_COLUNAS = [
  'NU_ANO_SAEB',
  'TP_TIPO_REDE',
  'TP_LOCALIZACAO',
  'QTD_ALUNOS_INSE',
  'MEDIA_INSE',
  'PC_NIVEL_1',
  'PC_NIVEL_8',
];

async function inse(pasta: string) {
  const municipal = await planilha(pasta, 'INSE_2023_municipios.xlsx', [
    {
      nome: 'INSE',
      linhas: [
        ['CO_MUNICIPIO', ...INSE_COLUNAS],
        [4211702, 2023, 5, 0, 50, 5.5, 1, 2],
        [4211702, 2023, 5, 0, 50, 5.5, 1, 2], // duplicata da fonte
        [4211702, 2023, 5, 1, 40, 5.4, 1, 2], // urbana: fica de fora
        [4211702, 2023, 6, 0, 60, 5.6, 1, 2], // rede 6 inclui a federal: fica de fora
        [4200000, 2023, 5, 0, 999, 9.9, 1, 2], // outro município
      ],
    },
  ]);
  const estadual = await planilha(pasta, 'INSE_2023_estados.xlsx', [
    {
      nome: 'INSE',
      linhas: [
        ['CO_UF', 'TP_CAPITAL', ...INSE_COLUNAS],
        [42, 0, 2023, 5, 0, 70, 5.7, 1, 2],
        [42, 1, 2023, 5, 0, 71, 5.8, 1, 2], // capital: fica de fora
        [11, 0, 2023, 5, 0, 72, 5.9, 1, 2], // outra UF
      ],
    },
  ]);
  const nacional = await planilha(pasta, 'INSE_2023_brasil.xlsx', [
    {
      nome: 'INSE',
      linhas: [
        ['TP_CAPITAL', ...INSE_COLUNAS],
        [0, 2023, 0, 0, 90, 5.1, 1, 2],
      ],
    },
  ]);
  return { municipal, estadual, nacional };
}

// O conjunto todo que `extrairInep` exige, com o rendimento dado e o resto mínimo.
async function pastaCompleta(comMunicipal: boolean) {
  const pasta = pastaTemporaria();
  await planilha(pasta, 'tx_rend_brasil_regioes_ufs_2025.xlsx', [
    {
      nome: 'dados',
      linhas: rendimentoEstadual([
        [2025, 'Brasil', 'Total', 'Pública', 97.1, 2.8, 0.1],
        [2025, 'Brasil', 'Urbana', 'Pública', 50, 50, 0],
        [2025, 'Santa Catarina', 'Total', 'Pública', '--', '--', '--'],
        [2025, 'Paraná', 'Total', 'Pública', 1, 1, 1],
      ]),
    },
  ]);
  if (comMunicipal) {
    await planilha(pasta, 'tx_rend_municipios_2025.xlsx', [
      {
        nome: 'MUNICÍPIOS',
        linhas: [
          ['CO_MUNICIPIO', 'NO_CATEGORIA', 'NO_DEPENDENCIA', '1_CAT_FUN', '2_CAT_FUN', '3_CAT_FUN'],
          [4211702, 'Total', 'Municipal', 96, 4, 0],
          [4211702, 'Rural', 'Municipal', 10, 90, 0],
          [4200000, 'Total', 'Municipal', 1, 1, 1],
        ],
      },
    ]);
  }
  await indiceSimples(
    pasta,
    'TX_TRANSICAO_BRASIL_REGIOES_UFS_2021_2022.xlsx',
    '1_CAT1_CATFUN',
    'CODIGO',
    'NO_LOCALIZACAO',
  );
  await indiceSimples(pasta, 'TDI_BRASIL_REGIOES_UFS_2025.xlsx', 'FUN_CAT_0');
  await indiceSimples(pasta, 'ATU_BRASIL_REGIOES_UFS_2025.xlsx', 'ED_INF_CAT_0');
  await indiceSimples(pasta, 'HAD_BRASIL_REGIOES_UFS_2025.xlsx', 'ED_INF_CAT_0');
  await indiceSimples(pasta, 'DSU_BRASIL_REGIOES_UFS_2025.xlsx', 'ED_INF_CAT_0');
  await indiceSimples(pasta, 'AFD_BRASIL_REGIOES_UFS_2025.xlsx', 'ED_INF_CAT_1');
  await indiceSimples(pasta, 'IRD_BRASIL_REGIOES_UFS_2025.xlsx', 'EDU_BAS_CAT_1');
  await indiceSimples(pasta, 'IED_BRASIL_REGIOES_UFS_2025.xlsx', 'FUN_CAT_1');
  for (const [arquivo, coluna] of [
    ['AFD_MUNICIPIOS_2025.xlsx', 'ED_INF_CAT_1'],
    ['IRD_MUNICIPIOS_2025.xlsx', 'EDU_BAS_CAT_1'],
    ['IED_MUNICIPIOS_2025.xlsx', 'FUN_CAT_1'],
    ...(comMunicipal
      ? [
          ['TX_TRANSICAO_MUNICIPIOS_2021_2022.xlsx', '1_CAT1_CATFUN'],
          ['TDI_MUNICIPIOS_2025.xlsx', 'FUN_CAT_0'],
          ['ATU_MUNICIPIOS_2025.xlsx', 'ED_INF_CAT_0'],
          ['HAD_MUNICIPIOS_2025.xlsx', 'ED_INF_CAT_0'],
          ['DSU_MUNICIPIOS_2025.xlsx', 'ED_INF_CAT_0'],
        ]
      : []),
  ] as [string, string][]) {
    const localizacao = coluna.startsWith('1_CAT1') ? 'NO_LOCALIZACAO' : 'NO_CATEGORIA';
    await planilha(pasta, arquivo, [
      {
        nome: 'dados',
        linhas: [
          ['CO_MUNICIPIO', localizacao, 'NO_DEPENDENCIA', coluna],
          [4211702, 'Total', 'Municipal', 7],
        ],
      },
    ]);
  }
  await planilha(pasta, 'Remuneracao_docentes_Municipios_2021.xlsx', [
    {
      nome: 'dados',
      linhas: [
        ['CO_MUNICIPIO', 'NO_DEPENDENCIA', 'NO_CATEGORIA', 'ED_BAS_CAT1', 'ED_BAS_CAT2', 'ED_BAS_CAT4', 'ED_BAS_CAT9'],
        [4211702, 'Municipal', 'Total', 20, 100, 3000.4, 3944.979],
        [4211702, 'Municipal', 'Sem Superior', 1, 'a', 'a', 'a'],
      ],
    },
  ]);
  await planilha(pasta, 'Remuneracao_docentes_UF_2021.xlsx', [
    {
      nome: 'dados',
      linhas: [
        ['SG_UF', 'NO_DEPENDENCIA', 'NO_CATEGORIA', 'ED_BAS_CAT_1', 'ED_BAS_CAT_4', 'ED_BAS_CAT_9'],
        ['SC', 'Pública', 'Total', 200, 4000, 5000],
        ['RO', 'Pública', 'Total', 200, 'd', 'd'],
      ],
    },
  ]);
  await planilha(pasta, 'Remuneracao_docentes_Brasil_2021.xlsx', [
    {
      nome: 'dados',
      linhas: [
        ['NO_CODIGO', 'DEPENDENCIA', 'Escolaridade', 'n_censo', 'mediana', 'rem_40_horas'],
        ['Brasil', 'Municipal', 'Total', 3000, 3500, 5154.89],
      ],
    },
  ]);
  await inse(pasta);
  await planilha(pasta, 'resultados_e_metas_ufs_2025_v3.xlsx', [
    {
      nome: 'Alfabet',
      linhas: [
        ['ANO DA AVALIAÇÃO', 'NOME UF', 'REDE'],
        [
          'ANO',
          'NOME_UF',
          'REDE',
          'PC_ALUNO_ALFABETIZADO_2025',
          'META_FINAL_2025',
          'META_FINAL_2030',
          'PC_AVALIADOS_LP',
        ],
        [2025, 'Santa Catarina*', 'PÚBLICA', 63, 67, '> 80', 87.8],
        [2025, 'Brasil', 'PÚBLICA', 66, 64, '> 80', 89],
        [2025, 'Rondônia', 'PÚBLICA', 1, 1, '> 80', 1],
      ],
    },
  ]);
  if (comMunicipal) {
    await planilha(pasta, 'resultados_e_metas_municipios_2025_3.xlsx', [
      {
        nome: 'Alfabet',
        linhas: [
          ['CO_MUNICIPIO', 'PC_ALUNO_ALFABETIZADO_2025', 'META_FINAL_2030', 'PC_AVALIADOS_LP'],
          [4211702, 65, 80, 84],
        ],
      },
    ]);
  }
  if (comMunicipal) {
    for (const [arquivo, aba] of [
      ['divulgacao_anos_iniciais_municipios_2025.xlsx', 'Municípios (Anos Iniciais)'],
      ['divulgacao_anos_finais_municipios_2025.xlsx', 'Municípios (Anos Finais)'],
      ['divulgacao_ensino_medio_municipios_2025.xlsx', 'Municípios (EM)'],
    ] as const) {
      await planilha(pasta, arquivo, [
        {
          nome: aba,
          linhas: [
            [
              'CO_MUNICIPIO',
              'REDE',
              'VL_APROVACAO_2025_SI_4',
              'VL_OBSERVADO_2025',
              'VL_NOTA_MATEMATICA_2025',
              'VL_NOTA_PORTUGUES_2025',
            ],
            [4211702, 'Municipal', 96, 6.4, 239, 227],
          ],
        },
      ]);
    }
  }
  const colunasDoIdeb = [
    'VL_APROVACAO_2025_SI_4',
    'VL_OBSERVADO_2023',
    'VL_OBSERVADO_2025',
    'VL_NOTA_MATEMATICA_2025',
    'VL_NOTA_PORTUGUES_2025',
  ];
  await planilha(pasta, 'divulgacao_brasil_ideb_2025.xlsx', [
    {
      nome: 'Brasil (Anos Iniciais)',
      linhas: [
        ['BRASIL', 'rede', ...colunasDoIdeb, 'VL_INDICADOR_REND_2025'],
        ['Brasil', 'Privada (1)', 99.123, 7.1, 7.5, 240.1, 230.2, 0.991],
        ['Fonte: MEC/Inep.', null, null, null, null, null, null, null],
      ],
    },
    {
      // Regressão: na planilha de 2025, esta aba traz a coluna do IDEB 2023 sem código (05/11/2026).
      nome: 'Brasil (Anos Finais)',
      linhas: [
        [
          'BRASIL',
          'rede',
          'VL_APROVACAO_2025_SI_4',
          'VL_OBSERVADO_2021',
          null,
          'VL_OBSERVADO_2025',
          'VL_NOTA_MATEMATICA_2025',
          'VL_NOTA_PORTUGUES_2025',
          'VL_INDICADOR_REND_2025',
        ],
        ['Brasil', 'Total', 90, 4.9, 5.2, 5.3, 260, 250, 0.9],
      ],
    },
  ]);
  await planilha(pasta, 'divulgacao_regioes_ufs_ideb_2025.xlsx', [
    {
      nome: 'UF e Regiões (AI)',
      linhas: [
        [null, null, ...colunasDoIdeb, 'VL_INDICADOR_REND_2023', 'VL_INDICADOR_REND_2023'],
        ['Santa Catarina', 'Municipal', 97, '-', 6.5, 230, 220, 0.8, 0.97],
        ['Santa Catarina', 'Estadual', 98, 6, 6.6, 231, 221, 0.8, 0.98],
        ['Paraná', 'Municipal', 97, 6, 6.5, 230, 220, 0.8, 0.97],
      ],
    },
  ]);
  return pasta;
}

// Extrato mínimo, com a forma de docs/educacao/extratos/inep-orleans.json.
function extratos() {
  const pasta = pastaTemporaria();
  const linha = (valores: unknown) => [
    { localizacao: 'Total', dependencia: 'Municipal', valores },
    { localizacao: 'Rural', dependencia: 'Municipal', valores },
  ];
  writeFileSync(
    path.join(pasta, 'inep-orleans.json'),
    JSON.stringify({
      rendimento_2025: linha({
        aprovacao: { fundamental: 90 },
        reprovacao: { fundamental: 9 },
        abandono: { fundamental: 1 },
      }),
      transicao_2021_2022: linha({ promocao: { fundamental: 94.4 } }),
      distorcao_idade_serie_2025: linha({ fundamental: 9 }),
      alunos_por_turma_2025: linha({ creche: 6.5 }),
      horas_aula_2025: linha({ creche: null }),
      docentes_com_superior_2025: linha({ creche: 85.7 }),
      alfabetizacao_2o_ano: { percentual: { 2025: 65 }, meta: { 2030: 80 }, participacao_pct: 84 },
      ideb: {
        anos_iniciais: [
          {
            rede: 'Municipal',
            rendimento_2025: 0.96,
            matematica_2025: 239.84,
            portugues_2025: 227.45,
            aprovacao_2025: 96.3,
          },
        ],
      },
    }),
  );
  return pasta;
}

const lotePor = (lotes: Lote[], chave: string) => {
  const lote = lotes.find((l) => l.chave === chave);
  if (!lote) throw new Error(`sem ${chave}`);
  return lote;
};

// Monta e lê planilhas de verdade: sob a suíte inteira, passa dos 5 s padrão.
describe('extrairInep com os arquivos municipais', { timeout: 30_000 }, () => {
  it('filtra CO_MUNICIPIO, SC e Brasil, só na localização Total, e dá a rede pelo NO_DEPENDENCIA', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true) });

    expect(idsDe(lotePor(lotes, 'inep_rendimento'))).toEqual([
      '4211702:municipal:fundamental::aprovacao:2025',
      '4211702:municipal:fundamental::reprovacao:2025',
      '4211702:municipal:fundamental::abandono:2025',
      '1:publica:fundamental::aprovacao:2025',
      '1:publica:fundamental::reprovacao:2025',
      '1:publica:fundamental::abandono:2025',
      '42:publica:fundamental::aprovacao:2025',
      '42:publica:fundamental::reprovacao:2025',
      '42:publica:fundamental::abandono:2025',
    ]);
  });

  it('"--" vira nulo, não zero', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true) });

    expect(registroDe(lotePor(lotes, 'inep_rendimento'), '42:publica:fundamental::aprovacao:2025')?.valor).toBeNull();
  });

  it('o lote diz que Orleans veio do arquivo', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true) });

    expect(lotePor(lotes, 'inep_rendimento').filtro).toMatchObject({
      extrato: false,
      origemPorLugar: { '4211702': 'tx_rend_municipios_2025.xlsx' },
    });
  });

  it('transição vai para o ano 2022 com o período da fonte', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true) });
    const transicao = lotePor(lotes, 'inep_transicao');

    expect(transicao.ano).toBe(2022);
    expect(registroDe(transicao, '1:todas:fundamental::promocao:2021-2022')?.valor).toBe('1');
  });

  it('a meta "> 80" continua texto, e a numérica continua número', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true) });
    const alfabetizacao = lotePor(lotes, 'inep_alfabetizacao');

    expect(registroDe(alfabetizacao, '42:publica:ano_2::alfabetizacao_meta:2030')).toMatchObject({
      valor: null,
      texto: '> 80',
    });
    expect(registroDe(alfabetizacao, '4211702:municipal:ano_2::alfabetizacao_meta:2030')).toMatchObject({
      valor: '80',
      texto: null,
    });
  });

  it('asterisco de nota de rodapé no nome da UF não tira SC do lote', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true) });

    expect(registroDe(lotePor(lotes, 'inep_alfabetizacao'), '42:publica:ano_2::alfabetizacao_2o_ano:2025')?.valor).toBe(
      '63',
    );
  });

  it('remuneração: símbolo de sigilo vira nulo, e contagem abaixo de 5 fica de fora', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true) });
    const rais = lotePor(lotes, 'inep_remuneracao');

    expect(registroDe(rais, '4211702:municipal:sem_superior:mediana:remuneracao_rais:2021')?.valor).toBeNull();
    expect(registroDe(rais, '4211702:municipal:sem_superior:docentes:remuneracao_rais:2021')?.valor).toBeNull();
    expect(registroDe(rais, '4211702:municipal:total:media_40h:remuneracao_rais:2021')?.valor).toBe('3944.98');
    expect(registroDe(rais, '42:publica:total:media_40h:remuneracao_rais:2021')?.valor).toBe('5000.00');
    expect(registroDe(rais, '1:municipal:total:media_40h:remuneracao_rais:2021')?.valor).toBe('5154.89');
  });

  it('IDEB: rede com nota de rodapé é reconhecida, e a série do Brasil entra', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true) });
    const ideb = lotePor(lotes, 'inep_ideb');

    expect(registroDe(ideb, '4211702:municipal:anos_finais::ideb_matematica:2025')?.valor).toBe('239.00');
    expect(registroDe(ideb, '1:privada:anos_iniciais::ideb:2025')?.valor).toBe('7.5');
    expect(registroDe(ideb, '1:privada:anos_iniciais::ideb_aprovacao:2025')?.valor).toBe('99.1');
  });

  it('IDEB do Brasil: coluna sem código entre 2021 e 2025 é a de 2023', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true) });

    expect(registroDe(lotePor(lotes, 'inep_ideb'), '1:todas:anos_finais::ideb:2023')?.valor).toBe('5.2');
  });

  it('IDEB de SC: série só na rede municipal, e o símbolo "-" vira nulo', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true), deExtratos: extratos() });
    const ideb = lotePor(lotes, 'inep_ideb');

    expect(registroDe(ideb, '42:municipal:anos_iniciais::ideb:2023')?.valor).toBeNull();
    expect(registroDe(ideb, '42:municipal:anos_iniciais::ideb:2025')?.valor).toBe('6.5');
    expect(registroDe(ideb, '42:estadual:anos_iniciais::ideb:2025')).toBeUndefined();
    expect(registroDe(ideb, '42:estadual:anos_iniciais::ideb_matematica:2025')?.valor).toBe('231.00');
  });

  it('IDEB de SC: a coluna de 2025 com o código de 2023 repetido é o rendimento de 2025', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(true), deExtratos: extratos() });

    expect(registroDe(lotePor(lotes, 'inep_ideb'), '42:municipal:anos_iniciais::ideb_rendimento:2025')?.valor).toBe(
      '0.97',
    );
  });
});

describe('extrairInep sem os arquivos municipais', () => {
  it('sem a rota pedida, falha dizendo o que falta', async () => {
    await expect(extrairInep({ origem: await pastaCompleta(false) })).rejects.toThrow(
      /Arquivo municipal ausente \(.*tx_rend_municipios.*\).*--de-extratos/,
    );
  });

  it('com a rota, Orleans vem do extrato só na localização Total, e o filtro diz isso', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(false), deExtratos: extratos() });
    const rendimento = lotePor(lotes, 'inep_rendimento');

    expect(rendimento.filtro).toMatchObject({
      extrato: true,
      origemPorLugar: { '4211702': 'extrato:inep-orleans.json#rendimento_2025' },
    });
    expect(idsDe(rendimento).filter((id) => id.startsWith('4211702'))).toEqual([
      '4211702:municipal:fundamental::aprovacao:2025',
      '4211702:municipal:fundamental::reprovacao:2025',
      '4211702:municipal:fundamental::abandono:2025',
    ]);
  });

  it('lote com arquivo municipal presente não vira extrato', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(false), deExtratos: extratos() });

    expect(lotePor(lotes, 'inep_regularidade').filtro).toMatchObject({ extrato: false });
  });

  it('null do extrato continua nulo', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(false), deExtratos: extratos() });

    expect(registroDe(lotePor(lotes, 'inep_horas'), '4211702:municipal:creche::horas_aula:2025')?.valor).toBeNull();
  });

  it('as parcelas do IDEB de Orleans vêm do extrato; a série, não', async () => {
    const lotes = await extrairInep({ origem: await pastaCompleta(false), deExtratos: extratos() });
    const ideb = lotePor(lotes, 'inep_ideb');

    expect(registroDe(ideb, '4211702:municipal:anos_iniciais::ideb_matematica:2025')?.valor).toBe('239.84');
    expect(idsDe(ideb).filter((id) => /^4211702:.*:ideb:/.test(id))).toEqual([]);
  });
});

describe('loteDoInse', () => {
  it('rede 5 é a pública, a duplicata sai, e urbana, capital e rede 6 ficam de fora', async () => {
    const lote = await loteDoInse(await inse(pastaTemporaria()));

    expect(idsDe(lote).filter((id) => id.endsWith(':alunos:inse:2023'))).toEqual([
      '4211702:publica::alunos:inse:2023',
      '42:publica::alunos:inse:2023',
      '1:todas::alunos:inse:2023',
    ]);
    expect(registroDe(lote, '4211702:publica::alunos:inse:2023')?.valor).toBe('50');
    expect(registroDe(lote, '42:publica::alunos:inse:2023')?.valor).toBe('70');
  });

  it('média vem em duas casas, e os níveis ficam no recorte', async () => {
    const lote = await loteDoInse(await inse(pastaTemporaria()));

    expect(registroDe(lote, '4211702:publica:::inse:2023')).toMatchObject({ valor: '5.50', unidade: 'indice' });
    expect(registroDe(lote, '4211702:publica::nivel_8:inse:2023')).toMatchObject({ valor: '2', unidade: '%' });
  });

  it('duas linhas diferentes para a mesma rede falham, em vez de escolher uma', async () => {
    const pasta = pastaTemporaria();
    const arquivos = await inse(pasta);
    const municipal = await planilha(pasta, 'conflito.xlsx', [
      {
        nome: 'INSE',
        linhas: [
          ['CO_MUNICIPIO', ...INSE_COLUNAS],
          [4211702, 2023, 5, 0, 50, 5.5, 1, 2],
          [4211702, 2023, 5, 0, 51, 5.5, 1, 2],
        ],
      },
    ]);

    await expect(loteDoInse({ ...arquivos, municipal })).rejects.toThrow(
      /INSE: linhas diferentes para 4211702:publica/,
    );
  });

  it('arquivo sem as colunas falha', async () => {
    const pasta = pastaTemporaria();
    const arquivos = await inse(pasta);
    const nacional = await planilha(pasta, 'novo.xlsx', [
      {
        nome: 'INSE',
        linhas: [
          ['TP_CAPITAL', 'OUTRA'],
          [0, 1],
        ],
      },
    ]);

    await expect(loteDoInse({ ...arquivos, nacional })).rejects.toThrow(/novo\.xlsx: layout inesperado/);
  });
});
