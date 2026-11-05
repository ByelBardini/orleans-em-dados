import type { FastifyInstance } from 'fastify';
import { educacaoDinheiroSchema, educacaoResumoSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { BRASIL, ORLEANS, SC, valor } from '../../../../packages/importadores/fixtures/src/educacao';
import { snapshot } from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';

let app: FastifyInstance;

const pedir = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/resumo' });
  return { status: resposta.statusCode, corpo: educacaoResumoSchema.parse(resposta.json()) };
};

// A fixture das abas não tem a rede pública nos anos iniciais: os lotes são deste spec, com valores próprios.
const nosAnosIniciais = (id: number, indicador: string, unidade: string, tres: [string, string, string]) =>
  snapshot(
    id,
    [ORLEANS, SC, BRASIL].flatMap((lugar, i) => [
      valor({ indicador, lugar, rede: 'publica', etapa: 'anos_iniciais', periodo: '2025', valor: tres[i], unidade }),
      valor({ indicador, lugar, rede: 'privada', etapa: 'anos_iniciais', periodo: '2025', valor: '1.0', unidade }),
    ]),
    { ano: 2025 },
  );
const comProfessores = {
  inep_turmas: [nosAnosIniciais(900304, 'alunos_por_turma', 'alunos', ['17.5', '21.0', '20.5'])],
  inep_docentes_superior: [nosAnosIniciais(900306, 'docentes_superior', '%', ['91.5', '93.5', '90.5'])],
};

beforeAll(async () => {
  app = criarApp();
  await app.ready();
});
beforeEach(() => popularCenario({ educacao: comProfessores }));
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/educacao/resumo', () => {
  it('com todas as coletas, nada falta', async () => {
    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.disponivel).toBe(true);
    expect(corpo.faltando).toEqual([]);
  });

  it('as matrículas são a soma das quatro etapas, da creche ao ensino médio', async () => {
    const { corpo } = await pedir();

    // 560 + 390 + 1716 + 615, à mão, dos totais da pesquisa 13 da fixture
    expect(corpo.matriculas?.total).toBe(3281);
    expect(corpo.matriculas?.etapas.map((e) => e.total)).toEqual([560, 390, 1716, 615]);
  });

  it('alfabetização: Orleans é municipal, SC e o Brasil são públicas, e a meta é a de Orleans no ano', async () => {
    const { corpo } = await pedir();

    expect(corpo.alfabetizacao).toMatchObject({
      ano: '2025',
      redes: { orleans: 'municipal', santaCatarina: 'publica', brasil: 'publica' },
      valores: { orleans: 65, santaCatarina: 63, brasil: 66 },
      metaDeOrleans: 70,
    });
  });

  it('creche: o Censo não abre rede, e isso vem escrito em `rede`, com 2010 ao lado', async () => {
    const { corpo } = await pedir();

    expect(corpo.creche).toMatchObject({ rede: 'todas', ano: '2022', anoAnterior: '2010' });
    expect(corpo.creche?.valores.orleans).toEqual(expect.any(Number));
    expect(corpo.creche?.orleansNoAnoAnterior).toEqual(expect.any(Number));
  });

  it('o que a Prefeitura informou ao MEC sobre a creche vem nas palavras do painel', async () => {
    const { corpo } = await pedir();

    expect(corpo.procuraPorCreche?.solicitacoesNaoAtendidas).toBe('Não há demanda');
  });

  it('abandono é da rede pública, no ensino médio, não o total das redes', async () => {
    const { corpo } = await pedir();

    expect(corpo.abandono?.rede).toBe('publica');
    // Na fixture, todas as redes dariam 4, 5 e 4.
    expect(corpo.abandono?.valores).toEqual({ orleans: 6, santaCatarina: 5, brasil: 5 });
    expect(corpo.abandono?.anosIniciais).toEqual({ orleans: 0, santaCatarina: 0.5, brasil: 1 });
    expect(corpo.abandono?.anosFinais).toEqual({ orleans: 0, santaCatarina: 0.5, brasil: 2 });
  });

  it('IDEB é dos anos iniciais, na rede pública', async () => {
    const { corpo } = await pedir();

    expect(corpo.ideb).toMatchObject({ ano: '2025', rede: 'publica' });
    expect(corpo.ideb?.valores).toEqual({ orleans: 6.6, santaCatarina: 6.7, brasil: 6 });
  });

  it('sem o arquivo do INEP, o Brasil fica sem IDEB, e Orleans e SC seguem', async () => {
    await popularCenario({ educacao: { ...comProfessores, inep_ideb: null } });

    const { corpo } = await pedir();

    expect(corpo.ideb?.valores).toEqual({ orleans: 6.6, santaCatarina: 6.7, brasil: null });
    expect(corpo.faltando).toEqual(['inep_ideb']);
  });

  it('docentes com superior e turmas são da rede pública, nos anos iniciais', async () => {
    const { corpo } = await pedir();

    expect(corpo.docentesSuperior).toMatchObject({
      rede: 'publica',
      valores: { orleans: 91.5, santaCatarina: 93.5, brasil: 90.5 },
    });
    expect(corpo.turmas).toMatchObject({
      rede: 'publica',
      valores: { orleans: 17.5, santaCatarina: 21, brasil: 20.5 },
    });
  });

  it('sem a linha da rede pública, o cartão é nulo, nunca o total das redes', async () => {
    await popularCenario();

    const { corpo } = await pedir();

    expect(corpo.turmas).toBeNull();
    expect(corpo.docentesSuperior).toBeNull();
  });

  it('natureza da instituição é o campo do Censo Superior', async () => {
    const { corpo } = await pedir();

    expect(corpo.superior).toMatchObject({ instituicao: 'FICTICIA', natureza: 'Privada sem fins lucrativos' });
  });

  it('o mínimo é o último exercício do SIOPE, com o SICONFI ao lado', async () => {
    const { corpo } = await pedir();

    expect(corpo.minimo?.ano).toBe(2025);
    expect(corpo.minimo?.minimo).toBe(25);
    expect(corpo.minimo?.percentual).toBe(28);
    expect(corpo.minimo?.siconfi?.percentual).toBe(27.5);
    expect(corpo.minimo?.difereDoSiconfi).toBe(true);
  });

  it('o gasto é o último exercício da aba Dinheiro, com o mesmo nível de conferência e o mesmo divisor', async () => {
    const { corpo } = await pedir();
    const naAba = educacaoDinheiroSchema
      .parse((await app.inject({ method: 'GET', url: '/api/educacao/dinheiro' })).json())
      .gasto?.anos.at(-1);

    expect(corpo.gasto?.ano).toBe(2025);
    expect(corpo.gasto?.divisor).toEqual({ ano: 2025, populacao: 24200, tipo: 'estimativa' });
    expect(corpo.gasto).toMatchObject({
      liquidado: naAba?.liquidado,
      conferencia: naAba?.conferencia,
      igualAoAnexo8: naAba?.igualAoAnexo8,
      porMorador: naAba?.porMorador,
    });
  });

  it.each([
    ['inep_alfabetizacao', 'alfabetizacao'],
    ['mec_retrato', 'procuraPorCreche'],
    ['inep_rendimento', 'abandono'],
    ['inep_turmas', 'turmas'],
    ['inep_docentes_superior', 'docentesSuperior'],
    ['siope_anexo8', 'minimo'],
    ['inep_superior', 'superior'],
  ] as const)('sem %s, só %s fica nulo, e o resto segue', async (chave, bloco) => {
    await popularCenario({ educacao: { ...comProfessores, [chave]: null } });

    const { corpo } = await pedir();

    expect(corpo[bloco]).toBeNull();
    expect(corpo.faltando).toEqual([chave]);
    const outros = Object.entries(corpo).filter(
      ([campo, v]) => !['disponivel', 'faltando', bloco].includes(campo) && v === null,
    );
    expect(outros).toEqual([]);
  });

  it('sem coleta nenhuma, responde 200 e diz o que falta, sem número', async () => {
    await popularCenario({
      siconfiFuncoes: [],
      siconfiIndices: [],
      ibgeEducacaoCenso: null,
      ibgeEducacaoComparacao: null,
      ibgeRedeEscolar: null,
      educacao: {
        inep_alfabetizacao: null,
        mec_retrato: null,
        inep_rendimento: null,
        inep_ideb: null,
        inep_turmas: null,
        inep_docentes_superior: null,
        siope_anexo8: null,
        inep_superior: null,
      },
    });

    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.disponivel).toBe(false);
    expect(corpo.faltando).toContain('siconfi_funcoes');
    expect(corpo.faltando).toContain('inep_rendimento');
    expect(corpo.matriculas).toBeNull();
    expect(corpo.gasto).toBeNull();
  });
});

describe('GET /api/educacao/resumo.csv', () => {
  const baixar = async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/educacao/resumo.csv' });
    return { resposta, linhas: resposta.body.split('\r\n') };
  };

  it('sai em formato longo, com o nome do arquivo da aba', async () => {
    const { resposta, linhas } = await baixar();

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-disposition']).toContain('educacao-resumo.csv');
    expect(linhas[0]).toContain('Indicador;Lugar;Rede;Etapa;Ano;Valor;Unidade;Fonte');
  });

  it('cada lugar da alfabetização sai com a própria rede', async () => {
    const { linhas } = await baixar();

    const alfabetizacao = linhas.filter((l) => l.startsWith('alfabetizacao_2o_ano;'));
    expect(alfabetizacao.map((l) => l.split(';').slice(1, 3))).toEqual([
      ['Orleans', 'municipal'],
      ['Santa Catarina', 'publica'],
      ['Brasil', 'publica'],
    ]);
  });

  it('o total de matrículas sai na rede "todas"', async () => {
    const { linhas } = await baixar();

    expect(linhas.find((l) => l.startsWith('matriculas;Orleans;todas;total;'))).toContain(';2025;3281;');
  });

  it('natureza da instituição sai em texto, e o abandono na rede pública', async () => {
    const { linhas } = await baixar();

    expect(linhas.find((l) => l.startsWith('superior_natureza;'))).toContain('Privada sem fins lucrativos');
    expect(linhas.find((l) => l.startsWith('frequencia_escolar;Orleans;todas;0 a 3 anos;2010;'))).toContain('2010');
    expect(linhas.find((l) => l.startsWith('abandono;Orleans;'))).toMatch(/^abandono;Orleans;publica;medio;2025;6;%;/);
  });
});
