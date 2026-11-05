import type { FastifyInstance } from 'fastify';
import { educacaoPermanenciaSchema, type EducacaoPermanencia } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { criarApp } from '../../src/app';

let app: FastifyInstance;

const pedir = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/permanencia' });
  return { status: resposta.statusCode, corpo: educacaoPermanenciaSchema.parse(resposta.json()) };
};

const baixarCsv = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/permanencia.csv' });
  return { resposta, linhas: resposta.body.split('\r\n') };
};

const daEtapa = (corpo: EducacaoPermanencia, etapa: string) => corpo.rendimento?.etapas.find((e) => e.etapa === etapa);
const daSerie = (corpo: EducacaoPermanencia, etapa: string) => corpo.series?.series.find((s) => s.etapa === etapa);

const SEM_TAXAS = { inep_rendimento: null, inep_distorcao: null, inep_transicao: null };

beforeAll(async () => {
  app = criarApp();
  await app.ready();
});
beforeEach(() => popularCenario());
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/educacao/permanencia', () => {
  it('com todas as coletas, nada falta', async () => {
    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.disponivel).toBe(true);
    expect(corpo.faltando).toEqual([]);
  });

  describe('como termina o ano', () => {
    it('vem nas três etapas, com o ano e a fonte do lote', async () => {
      const { corpo } = await pedir();

      expect(corpo.rendimento?.ano).toBe('2025');
      expect(corpo.rendimento?.fonte.nome).toBe('INEP, taxas de rendimento');
      expect(corpo.rendimento?.etapas.map((e) => e.etapa)).toEqual(['anos_iniciais', 'anos_finais', 'medio']);
    });

    it('aprovação, reprovação e abandono comparam os três lugares em cada rede', async () => {
      const { corpo } = await pedir();

      const anosFinais = daEtapa(corpo, 'anos_finais');
      expect(anosFinais?.aprovacao.porRede.municipal).toEqual({ orleans: 92, santaCatarina: 97, brasil: 95 });
      expect(anosFinais?.reprovacao.porRede.municipal).toEqual({ orleans: 8, santaCatarina: 3, brasil: 4 });
      expect(anosFinais?.abandono.porRede.publica).toEqual({ orleans: 0, santaCatarina: 0.5, brasil: 2 });
    });

    it('abandono zero é zero, e não nulo', async () => {
      const { corpo } = await pedir();

      expect(daEtapa(corpo, 'anos_iniciais')?.abandono.porRede.municipal?.orleans).toBe(0);
    });

    it('rede sem ensino médio em Orleans vem nula, sem zero, e SC e Brasil seguem', async () => {
      const { corpo } = await pedir();

      expect(daEtapa(corpo, 'medio')?.reprovacao.porRede.municipal).toEqual({
        orleans: null,
        santaCatarina: 15,
        brasil: 11,
      });
    });

    it('sem a coleta de rendimento, o bloco e as séries são nulos, e o resto segue', async () => {
      await popularCenario({ educacao: { inep_rendimento: null } });

      const { status, corpo } = await pedir();

      expect(status).toBe(200);
      expect(corpo.rendimento).toBeNull();
      expect(corpo.series).toBeNull();
      expect(corpo.faltando).toEqual(['inep_rendimento']);
      expect(corpo.disponivel).toBe(true);
      expect(corpo.distorcao).not.toBeNull();
    });
  });

  describe('por série', () => {
    it('as séries vêm em ordem, do 1º ano à 4ª série do médio', async () => {
      const { corpo } = await pedir();

      expect(corpo.series?.series.map((s) => s.etapa)).toEqual([
        'ano_1',
        'ano_2',
        'ano_3',
        'ano_4',
        'ano_5',
        'ano_6',
        'ano_7',
        'ano_8',
        'ano_9',
        'serie_1',
        'serie_2',
        'serie_3',
        'serie_4',
      ]);
    });

    it('traz a taxa do INEP e a matrícula da série em cada rede, em Orleans e no ano da taxa', async () => {
      const { corpo } = await pedir();

      const segundoAno = daSerie(corpo, 'ano_2');
      expect(segundoAno?.reprovacao.porRede.municipal?.orleans).toBe(10);
      // 82 municipais, 72 estaduais e 30 privadas
      expect(segundoAno?.matriculas).toEqual({ publica: 154, municipal: 82, estadual: 72, privada: 30, todas: 184 });
    });

    it('a série do ensino médio lê a categoria "1º série" da fonte', async () => {
      const { corpo } = await pedir();

      expect(daSerie(corpo, 'serie_1')?.matriculas).toEqual({
        publica: 200,
        municipal: null,
        estadual: 200,
        privada: 30,
        todas: 230,
      });
    });

    it('rede sem matrícula na série é nula, nunca zero', async () => {
      const { corpo } = await pedir();

      expect(daSerie(corpo, 'ano_6')?.matriculas.municipal).toBeNull();
    });

    it('matrícula de outro ano não entra: sem a do ano da taxa, fica nula', async () => {
      await pool.query(`UPDATE ibge_valores SET valor = NULL WHERE tabela = 'pesquisa-13' AND periodo = '2025'`);

      const { corpo } = await pedir();

      expect(daSerie(corpo, 'ano_2')?.matriculas).toEqual({
        publica: null,
        municipal: null,
        estadual: null,
        privada: null,
        todas: null,
      });
    });

    it('as duas fontes ficam ditas: a taxa do INEP e a matrícula do IBGE', async () => {
      const { corpo } = await pedir();

      expect(corpo.series?.fonte.nome).toBe('INEP, taxas de rendimento');
      expect(corpo.series?.fonteDasMatriculas.nome).toBe('IBGE, sinopse do Censo Escolar (INEP)');
    });

    it('sem a coleta da rede escolar, as séries são nulas e o rendimento segue', async () => {
      await popularCenario({ ibgeRedeEscolar: null });

      const { corpo } = await pedir();

      expect(corpo.series).toBeNull();
      expect(corpo.rendimento).not.toBeNull();
      expect(corpo.faltando).toEqual(['ibge_rede_escolar']);
    });
  });

  describe('distorção idade-série', () => {
    it('compara as etapas por rede, em 2025', async () => {
      const { corpo } = await pedir();

      expect(corpo.distorcao?.ano).toBe('2025');
      expect(corpo.distorcao?.etapas.map((c) => c.etapa)).toEqual(['anos_iniciais', 'anos_finais', 'medio']);
      expect(corpo.distorcao?.etapas[1]?.porRede.municipal).toEqual({ orleans: 18, santaCatarina: 13.5, brasil: 19 });
    });

    it('sem a coleta, o bloco é nulo e o resto segue', async () => {
      await popularCenario({ educacao: { inep_distorcao: null } });

      const { corpo } = await pedir();

      expect(corpo.distorcao).toBeNull();
      expect(corpo.faltando).toEqual(['inep_distorcao']);
      expect(corpo.evasao).not.toBeNull();
    });
  });

  describe('evasão', () => {
    it('o período é a transição 2021-2022, e não o ano do lote', async () => {
      const { corpo } = await pedir();

      expect(corpo.evasao?.ano).toBe('2021-2022');
      expect(corpo.evasao?.etapas[2]?.ano).toBe('2021-2022');
      expect(corpo.evasao?.etapas[2]?.porRede.publica).toEqual({ orleans: 9, santaCatarina: 8, brasil: 7.5 });
    });

    it('a rede municipal de Orleans vem nula, sem zero', async () => {
      const { corpo } = await pedir();

      expect(corpo.evasao?.etapas[0]?.porRede.municipal).toEqual({ orleans: null, santaCatarina: 0.5, brasil: 1 });
    });

    it('etapa sem linha na rede não inventa a rede', async () => {
      const { corpo } = await pedir();

      expect(corpo.evasao?.etapas[2]?.porRede.municipal).toBeUndefined();
    });

    it('sem a coleta, o bloco é nulo e o resto segue', async () => {
      await popularCenario({ educacao: { inep_transicao: null } });

      const { corpo } = await pedir();

      expect(corpo.evasao).toBeNull();
      expect(corpo.faltando).toEqual(['inep_transicao']);
      expect(corpo.rendimento).not.toBeNull();
    });
  });

  it('sem nenhuma coleta, responde 200 indisponível, com as quatro consultas em "faltando"', async () => {
    await popularCenario({ ibgeRedeEscolar: null, educacao: SEM_TAXAS });

    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo).toEqual({
      disponivel: false,
      faltando: ['inep_rendimento', 'inep_distorcao', 'inep_transicao', 'ibge_rede_escolar'],
      rendimento: null,
      series: null,
      distorcao: null,
      evasao: null,
    });
  });

  it('só com a rede escolar, sem taxa nenhuma, a aba fica indisponível', async () => {
    await popularCenario({ educacao: SEM_TAXAS });

    const { corpo } = await pedir();

    expect(corpo.disponivel).toBe(false);
    expect(corpo.faltando).toEqual(['inep_rendimento', 'inep_distorcao', 'inep_transicao']);
  });
});

describe('GET /api/educacao/permanencia.csv', () => {
  it('baixa como arquivo, em formato longo', async () => {
    const { resposta, linhas } = await baixarCsv();

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-disposition']).toBe('attachment; filename="educacao-permanencia.csv"');
    expect(linhas[0]).toContain('Indicador;Lugar;Rede;Etapa;Ano;Valor;Unidade;Fonte');
  });

  it('traz uma linha por rede e lugar nas taxas de 2025', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas.some((l) => l.startsWith('reprovacao;Orleans;municipal;anos_finais;2025;8'))).toBe(true);
    expect(linhas.some((l) => l.startsWith('distorcao;Brasil;municipal;anos_finais;2025;19'))).toBe(true);
  });

  it('a evasão sai no período da transição, e o lugar sem dado fica vazio, nunca zero', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas.some((l) => l.startsWith('evasao;Orleans;municipal;anos_iniciais;2021-2022;;%;INEP'))).toBe(true);
  });

  it('a matrícula da série sai por rede, só de Orleans', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas.some((l) => l.startsWith('matriculas;Orleans;estadual;ano_2;2025;72;matriculas;IBGE'))).toBe(true);
    expect(linhas.filter((l) => l.startsWith('matriculas;') && !l.startsWith('matriculas;Orleans;'))).toEqual([]);
  });

  it('sem coleta nenhuma, só o cabeçalho', async () => {
    await popularCenario({ ibgeRedeEscolar: null, educacao: SEM_TAXAS });

    const { linhas } = await baixarCsv();

    expect(linhas.filter((l) => l.trim() !== '')).toHaveLength(1);
  });
});
