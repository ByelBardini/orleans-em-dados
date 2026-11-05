import type { FastifyInstance } from 'fastify';
import { educacaoAcessoSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { criarApp } from '../../src/app';

let app: FastifyInstance;

const pedir = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/acesso' });
  return { status: resposta.statusCode, corpo: educacaoAcessoSchema.parse(resposta.json()) };
};

const baixarCsv = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/acesso.csv' });
  return { resposta, linhas: resposta.body.split('\r\n') };
};

const faixa = (corpo: Awaited<ReturnType<typeof pedir>>['corpo'], nome: string) =>
  corpo.frequencia?.faixas.find((f) => f.faixa === nome);

beforeAll(async () => {
  app = criarApp();
  await app.ready();
});
beforeEach(() => popularCenario());
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/educacao/acesso', () => {
  it('com todas as coletas, nada falta', async () => {
    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.disponivel).toBe(true);
    expect(corpo.faltando).toEqual([]);
  });

  describe('frequência', () => {
    it('as faixas vêm em ordem de idade, sem "25 anos ou mais"', async () => {
      const { corpo } = await pedir();

      expect(corpo.frequencia?.faixas.map((f) => f.faixa)).toEqual([
        '0 a 3 anos',
        '4 a 5 anos',
        '6 a 14 anos',
        '15 a 17 anos',
        '18 a 24 anos',
      ]);
    });

    it('compara os três lugares em 2022, sem separar rede', async () => {
      const { corpo } = await pedir();

      const comparacao = faixa(corpo, '4 a 5 anos')?.comparacao;
      expect(comparacao?.ano).toBe('2022');
      expect(comparacao?.porRede).toEqual({ todas: { orleans: 85, santaCatarina: 90, brasil: 87 } });
    });

    it('2010 é quem frequentava ÷ população, em cada lugar', async () => {
      const { corpo } = await pedir();

      // 470 ÷ 600; os dois outros lugares têm a mesma proporção na fixture
      expect(faixa(corpo, '4 a 5 anos')?.noAnoAnterior).toEqual({
        orleans: 78.3,
        santaCatarina: 78.3,
        brasil: 78.3,
      });
    });

    it('6 a 14 anos, em 2010, soma "6 anos" e "7 a 14 anos" nas duas variáveis', async () => {
      const { corpo } = await pedir();

      // (250 + 2600) ÷ (250 + 2650)
      expect(faixa(corpo, '6 a 14 anos')?.noAnoAnterior.orleans).toBe(98.3);
    });

    it('18 a 24 anos, em 2010, soma "18 ou 19 anos" e "20 a 24 anos"', async () => {
      const { corpo } = await pedir();

      // (290 + 490) ÷ (800 + 1900)
      expect(faixa(corpo, '18 a 24 anos')?.noAnoAnterior.orleans).toBe(28.9);
    });

    it.each([
      ['0 a 3 anos', 60],
      ['4 a 5 anos', 100],
      ['6 a 14 anos', 100],
      ['15 a 17 anos', 100],
    ])('%s traz a linha de meta de %d%%', async (nome, valor) => {
      const { corpo } = await pedir();

      expect(faixa(corpo, nome)?.comparacao.meta?.valor).toBe(valor);
    });

    it('18 a 24 anos não tem linha de meta', async () => {
      const { corpo } = await pedir();

      expect(faixa(corpo, '18 a 24 anos')?.comparacao.meta).toBeUndefined();
    });

    it('a referência da meta cita a meta do PNE e o prazo', async () => {
      const { corpo } = await pedir();

      expect(faixa(corpo, '15 a 17 anos')?.comparacao.meta?.referencia).toBe(
        'até 2029, para toda a faixa de 6 a 17 anos, no Plano Nacional de Educação',
      );
    });

    it('sem a comparação, Orleans segue, os outros lugares ficam nulos e a consulta aparece em "faltando"', async () => {
      await popularCenario({ ibgeEducacaoComparacao: null });

      const { corpo } = await pedir();

      expect(corpo.faltando).toEqual(['ibge_educacao_comparacao']);
      expect(faixa(corpo, '4 a 5 anos')?.comparacao.porRede.todas).toEqual({
        orleans: 85,
        santaCatarina: null,
        brasil: null,
      });
    });

    it('sem o Censo de Orleans, o bloco é nulo e os outros seguem', async () => {
      await popularCenario({ ibgeEducacaoCenso: null });

      const { status, corpo } = await pedir();

      expect(status).toBe(200);
      expect(corpo.frequencia).toBeNull();
      expect(corpo.outroMunicipio).toBeNull();
      expect(corpo.faltando).toEqual(['ibge_educacao_censo']);
      expect(corpo.retrato?.ano).toBe('2025');
    });
  });

  describe('matrículas', () => {
    it('lê o ano mais recente com dado', async () => {
      const { corpo } = await pedir();

      expect(corpo.matriculas?.ano).toBe('2025');
    });

    it('creche e pré-escola abrem a rede pela folha da fonte', async () => {
      const { corpo } = await pedir();

      expect(corpo.matriculas?.etapas.slice(0, 2)).toEqual([
        { etapa: 'creche', total: 560, municipal: 410, estadual: null, federal: null, privada: 150 },
        { etapa: 'pre_escola', total: 390, municipal: 310, estadual: null, federal: null, privada: 80 },
      ]);
    });

    it('fundamental e médio somam as séries de cada rede', async () => {
      const { corpo } = await pedir();

      expect(corpo.matriculas?.etapas.slice(2)).toEqual([
        // 80 + 82 + 84 + 86 + 88; 70 + 72 + 74 + 76 + 78 + 180 + 177 + 170 + 165; 30 + 30 + 28 + 28 + 26 + 24 + 24 + 22 + 22
        { etapa: 'fundamental', total: 1716, municipal: 420, estadual: 1062, federal: null, privada: 234 },
        // Municipal é `-` em toda série: nulo, nunca zero
        { etapa: 'medio', total: 615, municipal: null, estadual: 540, federal: null, privada: 75 },
      ]);
    });

    it('o total soma as quatro etapas', async () => {
      const { corpo } = await pedir();

      // 560 + 390 + 1716 + 615
      expect(corpo.matriculas?.total).toBe(3281);
    });

    it('escolas e docentes vêm por etapa, sem soma', async () => {
      const { corpo } = await pedir();

      expect(corpo.matriculas?.escolasEDocentes).toEqual([
        { etapa: 'educacao_infantil', escolas: 14, docentes: 70 },
        { etapa: 'fundamental', escolas: 12, docentes: 150 },
        { etapa: 'medio', escolas: 3, docentes: 60 },
      ]);
    });

    it('sem a coleta da rede escolar, o bloco é nulo e a consulta aparece em "faltando"', async () => {
      await popularCenario({ ibgeRedeEscolar: null });

      const { corpo } = await pedir();

      expect(corpo.matriculas).toBeNull();
      expect(corpo.faltando).toEqual(['ibge_rede_escolar']);
    });
  });

  describe('estudar em outra cidade', () => {
    it('divide quem estuda em outro município pelo total da tabela', async () => {
      const { corpo } = await pedir();

      expect(corpo.outroMunicipio).toMatchObject({ ano: '2022', estudantes: 5000, emOutroMunicipio: 500 });
      // 500 ÷ 5000, 150000 ÷ 1500000, 4000000 ÷ 40000000
      expect(corpo.outroMunicipio?.comparacao.porRede.todas).toEqual({ orleans: 10, santaCatarina: 10, brasil: 10 });
    });
  });

  describe('Retrato do MEC', () => {
    it('traz as respostas da Prefeitura em texto', async () => {
      const { corpo } = await pedir();

      expect(corpo.retrato).toMatchObject({
        ano: '2025',
        solicitacoesNaoAtendidas: 'Não há demanda',
        listaUnificada: 'Sim, cadastro único do município',
        idadeInicial: 'De 3 a 6 meses',
      });
    });

    it('a fonte do bloco sempre diz que a Prefeitura informou ao MEC', async () => {
      const { corpo } = await pedir();

      expect(corpo.retrato?.fonte.nome).toContain('a Prefeitura informou ao MEC');
    });

    it('quantidade na lista sem valor é nula, nunca zero', async () => {
      const { corpo } = await pedir();

      expect(corpo.retrato?.quantidadeNaLista).toBeNull();
    });

    it('o nível de Orleans sai da resposta, e a distribuição é dos municípios de SC, em ordem', async () => {
      const { corpo } = await pedir();

      expect(corpo.retrato?.nivelDeOrleans).toBe('basico');
      expect(corpo.retrato?.distribuicaoEmSc).toEqual([
        { nivel: 'inicial', municipios: 40 },
        { nivel: 'elementar', municipios: 150 },
        { nivel: 'basico', municipios: 90 },
        { nivel: 'avancado', municipios: 15 },
      ]);
    });

    it('sem a coleta, o bloco é nulo e o resto segue', async () => {
      await popularCenario({ educacao: { mec_retrato: null } });

      const { status, corpo } = await pedir();

      expect(status).toBe(200);
      expect(corpo.retrato).toBeNull();
      expect(corpo.faltando).toEqual(['mec_retrato']);
      expect(corpo.disponivel).toBe(true);
      expect(corpo.frequencia).not.toBeNull();
    });
  });

  it('sem nenhuma coleta, responde 200 indisponível, com as quatro consultas em "faltando"', async () => {
    await popularCenario({
      ibgeEducacaoCenso: null,
      ibgeEducacaoComparacao: null,
      ibgeRedeEscolar: null,
      educacao: { mec_retrato: null },
    });

    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo).toEqual({
      disponivel: false,
      faltando: ['ibge_educacao_censo', 'ibge_educacao_comparacao', 'ibge_rede_escolar', 'mec_retrato'],
      frequencia: null,
      matriculas: null,
      outroMunicipio: null,
      retrato: null,
    });
  });
});

describe('GET /api/educacao/acesso.csv', () => {
  it('é formato longo, para o Excel em português, com o nome do arquivo da aba', async () => {
    const { resposta, linhas } = await baixarCsv();

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-disposition']).toBe('attachment; filename="educacao-acesso.csv"');
    expect(linhas[0]).toBe('﻿Indicador;Lugar;Rede;Etapa;Ano;Valor;Unidade;Fonte');
  });

  it('uma linha por lugar, com vírgula decimal, e 2010 é linha à parte', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas).toContain('frequencia_escolar;Orleans;todas;4 a 5 anos;2022;85;%;IBGE, Censo 2022');
    expect(linhas).toContain('frequencia_escolar;Brasil;todas;4 a 5 anos;2022;87;%;IBGE, Censo 2022');
    expect(linhas).toContain(
      'frequencia_escolar;Orleans;todas;4 a 5 anos;2010;78,3;%;IBGE, Censo 2010: quem frequentava ÷ população',
    );
  });

  it('matrícula de rede sem dado sai vazia, nunca zero, e o total é rede "todas"', async () => {
    const { linhas } = await baixarCsv();

    const fonte = 'IBGE, sinopse do Censo Escolar (INEP)';
    expect(linhas).toContain(`matriculas;Orleans;municipal;medio;2025;;matriculas;${fonte}`);
    expect(linhas).toContain(`matriculas;Orleans;estadual;medio;2025;540;matriculas;${fonte}`);
    expect(linhas).toContain(`matriculas;Orleans;todas;medio;2025;615;matriculas;${fonte}`);
  });

  it('as respostas do Retrato saem em texto, com a Prefeitura na fonte, e a fila sai vazia', async () => {
    const { linhas } = await baixarCsv();

    const fonte = 'MEC, Retrato da Educação Infantil: a Prefeitura informou ao MEC';
    expect(linhas).toContain(
      `retrato_solicitacoes_nao_atendidas_creche;Orleans;municipal;;2025;Não há demanda;texto;${fonte}`,
    );
    expect(linhas).toContain(`retrato_quantidade_na_lista_de_espera;Orleans;municipal;;2025;;criancas;${fonte}`);
    expect(linhas).toContain(`retrato_distribuicao_basico;Santa Catarina;municipal;;2025;90;municipios;${fonte}`);
  });

  it('sem coleta nenhuma, só o cabeçalho', async () => {
    await popularCenario({
      ibgeEducacaoCenso: null,
      ibgeEducacaoComparacao: null,
      ibgeRedeEscolar: null,
      educacao: { mec_retrato: null },
    });

    const { resposta, linhas } = await baixarCsv();

    expect(resposta.statusCode).toBe(200);
    expect(linhas.filter(Boolean)).toHaveLength(1);
  });
});
