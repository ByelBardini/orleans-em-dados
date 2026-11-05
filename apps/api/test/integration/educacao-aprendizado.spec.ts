import type { FastifyInstance } from 'fastify';
import { educacaoAprendizadoSchema, type EducacaoAprendizado } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { ibgeRedeEscolar, valorIbge } from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';

let app: FastifyInstance;

const pedir = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/aprendizado' });
  return { status: resposta.statusCode, corpo: educacaoAprendizadoSchema.parse(resposta.json()) };
};

const baixarCsv = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/aprendizado.csv' });
  return { resposta, linhas: resposta.body.split('\r\n') };
};

const etapa = (corpo: EducacaoAprendizado, nome: string) => corpo.ideb?.etapas.find((e) => e.etapa === nome);
const anoDoEnem = (corpo: EducacaoAprendizado, ano: string) => corpo.enem?.anos.find((a) => a.ano === ano);
const parcela = (corpo: EducacaoAprendizado, lugar: string, rede: string, nome: string) =>
  corpo.ideb?.parcelas.find((p) => p.lugar === lugar && p.rede === rede && p.etapa === nome);

const SC = '42';

// A pesquisa 40 real: SC não tem `Ensino médio > Pública` nem a rede municipal, e tem o total e a privada.
const redeEscolarComoNaFonte = () => {
  const lote = ibgeRedeEscolar();
  const doIdebDeSc = (r: (typeof lote.registros)[number]) => r['localidade'] === SC && r['tabela'] === 'pesquisa-40';
  const ajustados = lote.registros
    .filter(
      (r) =>
        !doIdebDeSc(r) ||
        (r['categoria'] !== 'Ensino médio > Pública' && !String(r['categoria']).endsWith('Municipal')),
    )
    .map((r) =>
      doIdebDeSc(r) && r['categoria'] === 'Ensino médio > Pública > Estadual' && r['periodo'] === '2025'
        ? { ...r, valor: '4.3' }
        : r,
    );
  return {
    ...lote,
    registros: [
      ...ajustados,
      valorIbge('pesquisa-40', '78183', 'índice', '2025', '6.9', 'Ensino fundamental > Anos iniciais', SC),
      valorIbge('pesquisa-40', '78186', 'índice', '2025', '4.5', 'Ensino médio', SC),
      valorIbge('pesquisa-40', '78201', 'índice', '2025', '5.8', 'Ensino médio > Privada', SC),
    ],
  };
};

const SEM_NENHUMA_COLETA = {
  ibgeRedeEscolar: null,
  educacao: { inep_alfabetizacao: null, inep_ideb: null, inep_inse: null, inep_enem: null },
};

beforeAll(async () => {
  app = criarApp();
  await app.ready();
});
beforeEach(() => popularCenario());
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/educacao/aprendizado', () => {
  it('com todas as coletas, nada falta', async () => {
    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.disponivel).toBe(true);
    expect(corpo.faltando).toEqual([]);
  });

  describe('alfabetização', () => {
    it('traz a série dos três lugares, ano a ano', async () => {
      const { corpo } = await pedir();

      expect(corpo.alfabetizacao?.ano).toBe('2025');
      expect(corpo.alfabetizacao?.serie).toEqual([
        { ano: '2023', valores: { orleans: 60, santaCatarina: 60, brasil: 56 } },
        { ano: '2024', valores: { orleans: 70, santaCatarina: 62, brasil: 59 } },
        { ano: '2025', valores: { orleans: 65, santaCatarina: 63, brasil: 66 } },
      ]);
    });

    it('diz a rede de cada lugar: Orleans municipal, SC e Brasil pública', async () => {
      const { corpo } = await pedir();

      expect(corpo.alfabetizacao?.redes).toEqual({ orleans: 'municipal', santaCatarina: 'publica', brasil: 'publica' });
    });

    it('a meta de 2030 de SC e do Brasil continua texto, e a de Orleans é número', async () => {
      const { corpo } = await pedir();

      expect(corpo.alfabetizacao?.metas).toEqual([
        { ano: '2024', orleans: 68, santaCatarina: 65, brasil: 60 },
        { ano: '2025', orleans: 70, santaCatarina: 67, brasil: 64 },
        { ano: '2030', orleans: 80, santaCatarina: '> 80', brasil: '> 80' },
      ]);
    });

    it('traz a participação na avaliação', async () => {
      const { corpo } = await pedir();

      expect(corpo.alfabetizacao?.participacao).toEqual({ orleans: 84, santaCatarina: 88, brasil: 89 });
    });

    it('sem a coleta, o bloco é nulo, a consulta aparece em "faltando" e o resto segue', async () => {
      await popularCenario({ educacao: { inep_alfabetizacao: null } });

      const { corpo } = await pedir();

      expect(corpo.alfabetizacao).toBeNull();
      expect(corpo.faltando).toEqual(['inep_alfabetizacao']);
      expect(corpo.ideb?.ano).toBe('2025');
    });
  });

  describe('IDEB', () => {
    it('as etapas vêm na ordem da escola', async () => {
      const { corpo } = await pedir();

      expect(corpo.ideb?.etapas.map((e) => e.etapa)).toEqual(['anos_iniciais', 'anos_finais', 'medio']);
    });

    it('o médio de Orleans tem lacuna em 2021 e 2023: nulo, nunca zero', async () => {
      const { corpo } = await pedir();

      expect(etapa(corpo, 'medio')?.series.publica?.orleans).toEqual([
        { ano: 2021, valor: null },
        { ano: 2023, valor: null },
        { ano: 2025, valor: 3.9 },
      ]);
    });

    it('cada rede de Orleans tem a própria série', async () => {
      const { corpo } = await pedir();

      const series = etapa(corpo, 'anos_iniciais')?.series;
      expect(series?.municipal?.orleans).toEqual([
        { ano: 2021, valor: 5.9 },
        { ano: 2023, valor: 6.8 },
        { ano: 2025, valor: 6.4 },
      ]);
      expect(series?.publica?.orleans.at(-1)).toEqual({ ano: 2025, valor: 6.6 });
      expect(series?.estadual?.orleans.at(-1)).toEqual({ ano: 2025, valor: 6.7 });
    });

    it('a série do Brasil vem do arquivo do INEP', async () => {
      const { corpo } = await pedir();

      expect(etapa(corpo, 'anos_iniciais')?.series.publica?.brasil).toEqual([
        { ano: 2021, valor: 5.5 },
        { ano: 2023, valor: 5.7 },
        { ano: 2025, valor: 6 },
      ]);
    });

    it('SC na rede municipal vem do arquivo do INEP, mesmo se o IBGE trouxer a linha', async () => {
      const { corpo } = await pedir();

      // No IBGE da fixture, 2023 seria 6,9.
      expect(etapa(corpo, 'anos_iniciais')?.series.municipal?.santaCatarina).toEqual([
        { ano: 2021, valor: 6.1 },
        { ano: 2023, valor: 6.3 },
        { ano: 2025, valor: 6.5 },
      ]);
    });

    it('SC na rede pública dos anos iniciais vem do IBGE', async () => {
      const { corpo } = await pedir();

      expect(etapa(corpo, 'anos_iniciais')?.series.publica?.santaCatarina.at(-1)).toEqual({ ano: 2025, valor: 6.7 });
    });

    it('a pública do médio em SC é a linha estadual: a fonte não publica "Ensino médio > Pública"', async () => {
      await popularCenario({ ibgeRedeEscolar: redeEscolarComoNaFonte() });

      const { corpo } = await pedir();

      expect(etapa(corpo, 'medio')?.series.publica?.santaCatarina.at(-1)).toEqual({ ano: 2025, valor: 4.3 });
      expect(etapa(corpo, 'medio')?.comparacao.porRede.publica?.santaCatarina).toBe(4.3);
    });

    it('SC em "todas" e na privada lê a linha sem rede e a privada da fonte', async () => {
      await popularCenario({ ibgeRedeEscolar: redeEscolarComoNaFonte() });

      const { corpo } = await pedir();

      expect(etapa(corpo, 'anos_iniciais')?.comparacao.porRede.todas?.santaCatarina).toBe(6.9);
      expect(etapa(corpo, 'medio')?.comparacao.porRede.privada?.santaCatarina).toBe(5.8);
    });

    it('a comparação traz o último ano por rede, e o que não existe fica nulo', async () => {
      const { corpo } = await pedir();

      const comparacao = etapa(corpo, 'anos_iniciais')?.comparacao;
      expect(comparacao).toMatchObject({ indicador: 'ideb', etapa: 'anos_iniciais', ano: '2025', unidade: 'indice' });
      expect(comparacao?.porRede.publica).toEqual({ orleans: 6.6, santaCatarina: 6.7, brasil: 6 });
      expect(comparacao?.porRede.municipal).toEqual({ orleans: 6.4, santaCatarina: 6.5, brasil: 5.9 });
      expect(comparacao?.porRede.estadual).toEqual({ orleans: 6.7, santaCatarina: 6.8, brasil: null });
    });

    it('rede em que nenhum lugar tem dado na etapa não entra', async () => {
      const { corpo } = await pedir();

      // Anos iniciais: na fixture, nem o IBGE nem o INEP trazem a privada.
      expect(etapa(corpo, 'anos_iniciais')?.series.privada).toBeUndefined();
      expect(etapa(corpo, 'anos_iniciais')?.comparacao.porRede.privada).toBeUndefined();
    });

    it('as parcelas separam prova e aprovação, com o IDEB da mesma rede ao lado', async () => {
      const { corpo } = await pedir();

      expect(parcela(corpo, 'orleans', 'municipal', 'anos_iniciais')).toEqual({
        lugar: 'orleans',
        rede: 'municipal',
        etapa: 'anos_iniciais',
        ideb: 6.4,
        rendimento: 0.96,
        aprovacao: 96,
        matematica: 240,
        portugues: 227,
      });
    });

    it('rede de Orleans sem parcela no arquivo fica sem prova, e o IDEB segue na linha', async () => {
      const { corpo } = await pedir();

      expect(parcela(corpo, 'orleans', 'estadual', 'anos_iniciais')).toMatchObject({
        ideb: 6.7,
        matematica: null,
        aprovacao: null,
      });
    });

    it('sem o arquivo do INEP, Orleans e SC seguem, o Brasil fica nulo e não há prova', async () => {
      await popularCenario({ educacao: { inep_ideb: null } });

      const { corpo } = await pedir();

      expect(corpo.faltando).toEqual(['inep_ideb']);
      expect(corpo.ideb?.fonteDoInep).toBeNull();
      expect(etapa(corpo, 'anos_iniciais')?.comparacao.porRede.publica).toEqual({
        orleans: 6.6,
        santaCatarina: 6.7,
        brasil: null,
      });
      expect(corpo.ideb?.parcelas.every((p) => p.matematica === null && p.aprovacao === null)).toBe(true);
    });

    it('sem a pesquisa do IBGE, o bloco é nulo e o resto segue', async () => {
      await popularCenario({ ibgeRedeEscolar: null });

      const { corpo } = await pedir();

      expect(corpo.ideb).toBeNull();
      expect(corpo.faltando).toEqual(['ibge_rede_escolar']);
      expect(corpo.alfabetizacao?.ano).toBe('2025');
    });
  });

  describe('INSE', () => {
    it('é de 2023, e compara rede com rede', async () => {
      const { corpo } = await pedir();

      expect(corpo.inse?.ano).toBe('2023');
      expect(corpo.inse?.comparacao.ano).toBe('2023');
      expect(corpo.inse?.comparacao.porRede.publica).toEqual({ orleans: 5.5, santaCatarina: 5.4, brasil: 5 });
    });

    it('sem a coleta, só o bloco some', async () => {
      await popularCenario({ educacao: { inep_inse: null } });

      const { corpo } = await pedir();

      expect(corpo.inse).toBeNull();
      expect(corpo.faltando).toEqual(['inep_inse']);
    });
  });

  describe('ENEM', () => {
    it('traz os dois anos, e `ano` é o mais novo', async () => {
      const { corpo } = await pedir();

      expect(corpo.enem?.ano).toBe('2025');
      expect(corpo.enem?.anos.map((a) => a.ano)).toEqual(['2024', '2025']);
    });

    it('rede com menos de 2 escolas não tem linha', async () => {
      const { corpo } = await pedir();

      expect(anoDoEnem(corpo, '2024')?.redes.map((r) => r.rede)).toEqual(['publica', 'estadual']);
    });

    it('a mesma rede volta no ano em que a coleta publica', async () => {
      const { corpo } = await pedir();

      expect(anoDoEnem(corpo, '2025')?.redes.map((r) => r.rede)).toEqual(['publica', 'estadual', 'privada', 'todas']);
    });

    it('rede retida não vira número nem zero na comparação de Orleans, e SC e Brasil seguem', async () => {
      const { corpo } = await pedir();

      const media = anoDoEnem(corpo, '2024')?.comparacoes.find((c) => c.indicador === 'enem_media_5_areas');
      expect(media?.porRede.privada).toEqual({ orleans: null, santaCatarina: 620, brasil: 615 });
    });

    it('presentes ÷ matrículas da 3ª série, na mesma rede e no mesmo ano, com uma casa', async () => {
      const { corpo } = await pedir();

      const redes = anoDoEnem(corpo, '2025')?.redes;
      // 100 ÷ (160 + 20)
      expect(redes?.find((r) => r.rede === 'todas')).toEqual({
        rede: 'todas',
        escolas: 4,
        inscritos: 130,
        presentes: 100,
        terceiraSerie: 180,
        presentesSobreTerceiraSerie: 55.6,
      });
      // 75 ÷ 160
      expect(redes?.find((r) => r.rede === 'estadual')?.presentesSobreTerceiraSerie).toBe(46.9);
    });

    it('a rede pública soma as séries das redes públicas, sem a privada', async () => {
      const { corpo } = await pedir();

      expect(anoDoEnem(corpo, '2025')?.redes.find((r) => r.rede === 'publica')?.terceiraSerie).toBe(160);
    });

    it('sem a pesquisa do IBGE, o percentual fica nulo e os presentes seguem', async () => {
      await popularCenario({ ibgeRedeEscolar: null });

      const { corpo } = await pedir();

      expect(corpo.enem?.fonteDaTerceiraSerie).toBeNull();
      expect(anoDoEnem(corpo, '2025')?.redes.find((r) => r.rede === 'todas')).toMatchObject({
        presentes: 100,
        terceiraSerie: null,
        presentesSobreTerceiraSerie: null,
      });
    });

    it('as médias comparam as cinco áreas e a média, com o Brasil presente', async () => {
      const { corpo } = await pedir();

      const comparacoes = anoDoEnem(corpo, '2025')?.comparacoes;
      expect(comparacoes?.map((c) => c.indicador)).toEqual([
        'enem_media_5_areas',
        'enem_natureza',
        'enem_humanas',
        'enem_linguagens',
        'enem_matematica',
        'enem_redacao',
      ]);
      expect(comparacoes?.[0]?.porRede.publica).toEqual({ orleans: 525, santaCatarina: 525, brasil: 500 });
    });

    it('o recorte da prova aplicada em Orleans não entra: conta quem veio de fora', async () => {
      const { corpo } = await pedir();

      // A fixture traz 500 inscritos em `prova_em_orleans`, na mesma rede e no mesmo ano.
      expect(anoDoEnem(corpo, '2025')?.redes.find((r) => r.rede === 'todas')?.inscritos).toBe(130);
    });

    it('sem a coleta, só o bloco some', async () => {
      await popularCenario({ educacao: { inep_enem: null } });

      const { corpo } = await pedir();

      expect(corpo.enem).toBeNull();
      expect(corpo.faltando).toEqual(['inep_enem']);
      expect(corpo.ideb?.ano).toBe('2025');
    });
  });

  it('sem nenhuma coleta, responde 200 indisponível, com as consultas em "faltando"', async () => {
    await popularCenario(SEM_NENHUMA_COLETA);

    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo).toEqual({
      disponivel: false,
      faltando: ['inep_alfabetizacao', 'ibge_rede_escolar', 'inep_ideb', 'inep_inse', 'inep_enem'],
      alfabetizacao: null,
      ideb: null,
      inse: null,
      enem: null,
    });
  });
});

describe('GET /api/educacao/aprendizado.csv', () => {
  it('é formato longo, com o nome do arquivo da aba', async () => {
    const { resposta, linhas } = await baixarCsv();

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-disposition']).toBe('attachment; filename="educacao-aprendizado.csv"');
    expect(linhas[0]).toBe('﻿Indicador;Lugar;Rede;Etapa;Ano;Valor;Unidade;Fonte');
  });

  it('a alfabetização sai com a rede de cada lugar, e a meta em texto fica em texto', async () => {
    const { linhas } = await baixarCsv();

    const fonte = 'INEP, Indicador Criança Alfabetizada';
    expect(linhas).toContain(`alfabetizacao_2o_ano;Orleans;municipal;ano_2;2025;65;%;${fonte}`);
    expect(linhas).toContain(`alfabetizacao_2o_ano;Brasil;publica;ano_2;2025;66;%;${fonte}`);
    expect(linhas).toContain(`alfabetizacao_meta;Santa Catarina;publica;ano_2;2030;> 80;%;${fonte}`);
    expect(linhas).toContain(`alfabetizacao_participacao;Orleans;municipal;ano_2;2025;84;%;${fonte}`);
  });

  it('a lacuna do IDEB sai vazia, nunca zero', async () => {
    const { linhas } = await baixarCsv();

    const fonte = 'IBGE, pesquisa 40 (IDEB do INEP)';
    expect(linhas).toContain(`ideb;Orleans;publica;medio;2021;;indice;${fonte}`);
    expect(linhas).toContain(`ideb;Orleans;publica;medio;2025;3,9;indice;${fonte}`);
  });

  it('o IDEB do Brasil e o de SC na municipal citam o arquivo do INEP', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas).toContain('ideb;Brasil;publica;anos_iniciais;2025;6;indice;INEP, arquivo do IDEB');
    expect(linhas).toContain('ideb;Santa Catarina;municipal;anos_iniciais;2023;6,3;indice;INEP, arquivo do IDEB');
  });

  it('prova e aprovação saem em linhas próprias', async () => {
    const { linhas } = await baixarCsv();

    const fonte = 'INEP, arquivo do IDEB';
    expect(linhas).toContain(`ideb_matematica;Orleans;municipal;anos_iniciais;2025;240;nota;${fonte}`);
    expect(linhas).toContain(`ideb_aprovacao;Orleans;municipal;anos_iniciais;2025;96;%;${fonte}`);
  });

  it('o ENEM traz o percentual e nenhuma linha de Orleans da rede retida', async () => {
    const { linhas } = await baixarCsv();

    const fonte = 'INEP, microdados do ENEM';
    expect(linhas).toContain(`enem_presentes_sobre_3a_serie;Orleans;todas;medio;2025;55,6;%;${fonte}`);
    expect(linhas.filter((l) => l.startsWith('enem_inscritos;Orleans;privada;medio;2024'))).toEqual([]);
    expect(linhas).toContain(`enem_inscritos;Orleans;privada;medio;2025;30;pessoas;${fonte}`);
  });

  it('sem coleta nenhuma, só o cabeçalho', async () => {
    await popularCenario(SEM_NENHUMA_COLETA);

    const { resposta, linhas } = await baixarCsv();

    expect(resposta.statusCode).toBe(200);
    expect(linhas.filter(Boolean)).toHaveLength(1);
  });
});
