import type { FastifyInstance } from 'fastify';
import { educacaoCidadeSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { inepSuperior, ORLEANS, valor } from '../../../../packages/importadores/fixtures/src/educacao';
import { ibgeEducacaoCenso, snapshot, valorIbge } from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';

let app: FastifyInstance;

const pedir = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/cidade' });
  return { status: resposta.statusCode, corpo: educacaoCidadeSchema.parse(resposta.json()), texto: resposta.body };
};

const baixarCsv = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/cidade.csv' });
  return { resposta, linhas: resposta.body.split('\r\n') };
};

type RegistroDoSuperior = ReturnType<typeof valor>;

// O lote fictício do ensino superior, com linhas a mais ou sem as que o filtro recusar.
const superiorCom = (extras: RegistroDoSuperior[], manter: (r: RegistroDoSuperior) => boolean = () => true) =>
  inepSuperior().map((lote) =>
    snapshot(lote.meta.consultaId, [...(lote.registros as RegistroDoSuperior[]).filter(manter), ...extras], {
      ano: lote.meta.ano,
    }),
  );

const noCursoFicticio = (indicador: string, v: string | null, texto: string | null, unidade = 'pessoas') =>
  valor({
    indicador,
    lugar: ORLEANS,
    rede: 'todas',
    recorte: 'Curso Mínimo (bacharelado)',
    periodo: '2024',
    valor: v,
    texto,
    unidade,
  });

beforeAll(async () => {
  app = criarApp();
  await app.ready();
});
beforeEach(() => popularCenario());
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/educacao/cidade', () => {
  it('com todas as coletas, nada falta', async () => {
    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.disponivel).toBe(true);
    expect(corpo.faltando).toEqual([]);
  });

  it('sem nenhuma coleta, responde 200 indisponível, com as três consultas em "faltando"', async () => {
    await popularCenario({
      ibgeEducacaoCenso: null,
      ibgeEducacaoComparacao: null,
      educacao: { inep_superior: null },
    });

    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.disponivel).toBe(false);
    expect(corpo.faltando).toEqual(['ibge_educacao_censo', 'ibge_educacao_comparacao', 'inep_superior']);
    expect(corpo.alfabetizacao).toBeNull();
    expect(corpo.oferta).toBeNull();
  });

  it('sem o Censo de Orleans, os blocos dos moradores são nulos e a oferta segue', async () => {
    await popularCenario({ ibgeEducacaoCenso: null });

    const { corpo } = await pedir();

    expect(corpo.faltando).toEqual(['ibge_educacao_censo']);
    expect(corpo.alfabetizacao).toBeNull();
    expect(corpo.escolaridade).toBeNull();
    expect(corpo.moradores).toBeNull();
    expect(corpo.oferta?.matriculas).toBe(300);
  });

  it('sem o lote do ensino superior, oferta, IGC e cursos são nulos e os moradores seguem', async () => {
    await popularCenario({ educacao: { inep_superior: null } });

    const { corpo } = await pedir();

    expect(corpo.faltando).toEqual(['inep_superior']);
    expect(corpo.oferta).toBeNull();
    expect(corpo.igc).toBeNull();
    expect(corpo.cursos).toBeNull();
    expect(corpo.moradores?.graduacao).toBe(590);
  });

  describe('alfabetização', () => {
    it('compara a taxa de 15 anos ou mais nos três lugares em 2022', async () => {
      const { corpo } = await pedir();

      expect(corpo.alfabetizacao?.ano).toBe('2022');
      expect(corpo.alfabetizacao?.total.porRede).toEqual({
        todas: { orleans: 97.5, santaCatarina: 97.3, brasil: 93 },
      });
    });

    it('traz quantos moradores não sabem ler e escrever, da tabela de pessoas', async () => {
      const { corpo } = await pedir();

      expect(corpo.alfabetizacao?.naoAlfabetizados).toBe(500);
    });

    it('abre por sexo e situação do domicílio', async () => {
      const { corpo } = await pedir();

      expect(corpo.alfabetizacao?.porGrupo.map((g) => g.grupo)).toEqual(['Homens', 'Mulheres', 'Urbana', 'Rural']);
      expect(corpo.alfabetizacao?.porGrupo[3]?.comparacao.porRede.todas?.orleans).toBe(96.8);
    });

    it('abre por idade, na ordem, e faixa sem dado fica nula, nunca zero', async () => {
      const { corpo } = await pedir();

      const idades = corpo.alfabetizacao?.porIdade ?? [];
      expect(idades.map((g) => g.grupo)).toEqual([
        '15 a 17 anos',
        '18 e 19 anos',
        '20 a 24 anos',
        '25 a 34 anos',
        '35 a 44 anos',
        '45 a 54 anos',
        '55 a 64 anos',
        '65 anos ou mais',
        '75 anos ou mais',
      ]);
      expect(idades[0]?.comparacao.porRede.todas?.orleans).toBe(99.2);
      expect(idades[1]?.comparacao.porRede.todas?.orleans).toBeNull();
    });
  });

  describe('escolaridade', () => {
    it('anos de estudo vêm em anos, de 25 anos ou mais e de 18 a 24', async () => {
      const { corpo } = await pedir();

      const anos = corpo.escolaridade?.anosDeEstudo ?? [];
      expect(anos.map((g) => g.grupo)).toEqual(['25 anos ou mais', '18 a 24 anos']);
      expect(anos[0]?.comparacao.unidade).toBe('anos');
      expect(anos[0]?.comparacao.porRede.todas?.orleans).toBe(9.6);
      expect(anos[1]?.comparacao.porRede.todas?.orleans).toBe(12);
    });

    it('o denominador da instrução é quem tem 25 anos ou mais, em pessoas', async () => {
      const { corpo } = await pedir();

      expect(corpo.escolaridade?.pessoasDe25AnosOuMais).toBe(16000);
    });

    it.each([
      // 5800 ÷ 16000
      ['sem_instrucao', 36.3],
      // (4400 + 3200) ÷ 16000
      ['medio_ou_mais', 47.5],
      // 3200 ÷ 16000
      ['superior', 20],
    ])('%s é conta a partir das pessoas: %d%%', async (chave, esperado) => {
      const { corpo } = await pedir();

      const nivel = corpo.escolaridade?.niveis.find((n) => n.nivel === chave);
      expect(nivel?.comparacao.porRede.todas?.orleans).toBe(esperado);
      expect(nivel?.comparacao.porRede.todas?.santaCatarina).toBe(esperado);
    });

    // Regressão: a variável 1002667 divide por todos os de 18 anos ou mais (docs/context/ibge.md, 10061).
    it('sem as pessoas da variável 2667, a 1002667 não entra no lugar: o percentual fica nulo', async () => {
      const censo = ibgeEducacaoCenso();
      // Só a 1002667 tem a categoria: a prova não depende da ordem das linhas no banco.
      await popularCenario({
        ibgeEducacaoCenso: snapshot(
          censo.meta.consultaId,
          [
            valorIbge('10061', '1002667', '%', '2022', '99.0', 'Superior completo|25 anos ou mais'),
            ...censo.registros.filter((r) => r.id !== '10061:2667:2022:Superior completo|25 anos ou mais'),
          ],
          { ano: censo.meta.ano },
        ),
      });

      const { corpo } = await pedir();

      const nivel = corpo.escolaridade?.niveis.find((n) => n.nivel === 'superior');
      expect(nivel?.comparacao.porRede.todas?.orleans).toBeNull();
      expect(corpo.escolaridade?.pessoasDe25AnosOuMais).toBe(16000);
    });

    it('sem a comparação, Orleans segue e SC e Brasil ficam nulos', async () => {
      await popularCenario({ ibgeEducacaoComparacao: null });

      const { corpo } = await pedir();

      expect(corpo.faltando).toEqual(['ibge_educacao_comparacao']);
      expect(corpo.escolaridade?.niveis[0]?.comparacao.porRede.todas).toEqual({
        orleans: 47.5,
        santaCatarina: null,
        brasil: null,
      });
    });
  });

  describe('moradores na faculdade', () => {
    it('as contagens são as da tabela, sem ajustar o arredondamento da amostra', async () => {
      const { corpo } = await pedir();

      expect(corpo.moradores).toMatchObject({
        ano: '2022',
        graduacao: 590,
        emOrleans: 401,
        emOutroMunicipio: 190,
        noExterior: 0,
        posGraduacao: 100,
        posEmOutroMunicipio: 45,
      });
    });

    it('graduação em outro município divide pelo total da tabela, nos três lugares', async () => {
      const { corpo } = await pedir();

      // 190 ÷ 590; os outros dois lugares têm a mesma proporção na fixture
      expect(corpo.moradores?.foraDoMunicipio.porRede.todas).toEqual({
        orleans: 32.2,
        santaCatarina: 32.2,
        brasil: 32.2,
      });
    });
  });

  describe('oferta na cidade', () => {
    it('os totais presenciais são do ano do lote, 2024', async () => {
      const { corpo } = await pedir();

      expect(corpo.oferta).toMatchObject({
        ano: '2024',
        cursos: 2,
        vagas: 150,
        inscritos: 200,
        ingressantes: 100,
        matriculas: 300,
        concluintes: 40,
      });
    });

    it('moradores e oferta nunca viram um número só', async () => {
      const { corpo } = await pedir();

      expect(corpo.moradores?.ano).toBe('2022');
      expect(corpo.oferta?.ano).toBe('2024');
      expect(JSON.stringify(corpo)).not.toMatch(/\b890\b/);
    });

    it('a instituição e a natureza vêm só dos campos do INEP', async () => {
      const { corpo } = await pedir();

      expect(corpo.oferta?.instituicao).toBe('FICTICIA');
      expect(corpo.oferta?.natureza).toBe('Privada sem fins lucrativos');
    });

    it('sem o campo do INEP, a natureza fica nula', async () => {
      await popularCenario({
        educacao: { inep_superior: superiorCom([], (r) => r.indicador !== 'superior_natureza') },
      });

      const { corpo } = await pedir();

      expect(corpo.oferta?.natureza).toBeNull();
    });

    it.each([
      ['noturno', 250, 83.3],
      ['escola_publica', 200, 66.7],
      ['de_18_a_24', 220, 73.3],
      ['mulheres', 180, 60],
      ['prouni', 60, 20],
      ['fies', 10, 3.3],
    ])('o perfil %s traz %d pessoas e o percentual sobre as matrículas: %d%%', async (recorte, pessoas, percentual) => {
      const { corpo } = await pedir();

      expect(corpo.oferta?.perfil.find((p) => p.recorte === recorte)).toEqual({ recorte, pessoas, percentual });
    });

    it('perfil em "menos de 5" fica como texto, sem percentual', async () => {
      await popularCenario({
        educacao: {
          inep_superior: superiorCom(
            [
              valor({
                indicador: 'superior_perfil',
                lugar: ORLEANS,
                rede: 'todas',
                recorte: 'fies',
                periodo: '2024',
                texto: 'menos de 5',
                unidade: 'pessoas',
              }),
            ],
            (r) => !(r.indicador === 'superior_perfil' && r.recorte === 'fies'),
          ),
        },
      });

      const { corpo } = await pedir();

      expect(corpo.oferta?.perfil.find((p) => p.recorte === 'fies')).toEqual({
        recorte: 'fies',
        pessoas: 'menos de 5',
        percentual: null,
      });
    });

    it('recorte de cor ou raça e de deficiência não é publicado, mesmo se vier no lote', async () => {
      const extra = (recorte: string) =>
        valor({
          indicador: 'superior_perfil',
          lugar: ORLEANS,
          rede: 'todas',
          recorte,
          periodo: '2024',
          valor: '7',
          unidade: 'pessoas',
        });
      await popularCenario({
        educacao: { inep_superior: superiorCom([extra('deficiencia'), extra('cor_raca_preta')]) },
      });

      const { texto } = await pedir();

      expect(texto).not.toMatch(/deficiencia|cor_raca/);
    });

    it('o ensino a distância só sai em total', async () => {
      const { corpo } = await pedir();

      expect(corpo.oferta?.ead).toEqual({ instituicoes: 3, matriculas: 10, ingressantes: 8 });
    });

    it('docentes trazem o total e a titulação', async () => {
      const { corpo } = await pedir();

      expect(corpo.oferta?.docentes).toEqual({
        total: 50,
        doutores: 10,
        mestres: 25,
        especialistas: 15,
        tempoIntegral: 12,
      });
    });
  });

  describe('IGC', () => {
    it('traz a nota e a faixa de 2023, ano diferente do lote', async () => {
      const { corpo } = await pedir();

      expect(corpo.igc).toMatchObject({ ano: '2023', continuo: 2.5, faixa: 3 });
    });

    it('traz a distribuição de SC por faixa, em ordem, e o total das instituições', async () => {
      const { corpo } = await pedir();

      expect(corpo.igc?.distribuicaoEmSc).toEqual([
        { faixa: 3, instituicoes: 50 },
        { faixa: 4, instituicoes: 30 },
      ]);
      expect(corpo.igc?.instituicoesEmSc).toBe(80);
    });

    it('sem a distribuição de SC, a lista é vazia e o total é nulo', async () => {
      await popularCenario({
        educacao: { inep_superior: superiorCom([], (r) => r.indicador !== 'superior_igc_distribuicao') },
      });

      const { corpo } = await pedir();

      expect(corpo.igc?.distribuicaoEmSc).toEqual([]);
      expect(corpo.igc?.instituicoesEmSc).toBeNull();
      expect(corpo.igc?.faixa).toBe(3);
    });

    it('sem nota nem faixa, o bloco é nulo e a oferta segue', async () => {
      await popularCenario({
        educacao: { inep_superior: superiorCom([], (r) => !r.indicador.startsWith('superior_igc_')) },
      });

      const { corpo } = await pedir();

      expect(corpo.igc).toBeNull();
      expect(corpo.oferta?.matriculas).toBe(300);
    });
  });

  describe('cursos', () => {
    it('vêm da maior matrícula para a menor, com o nome e o grau', async () => {
      const { corpo } = await pedir();

      expect(corpo.cursos?.lista.map((c) => c.curso)).toEqual([
        'Curso Grande (bacharelado)',
        'Curso Pequeno (licenciatura)',
      ]);
      expect(corpo.cursos?.lista[0]).toEqual({
        curso: 'Curso Grande (bacharelado)',
        vagas: 100,
        ingressantes: 90,
        matriculas: 292,
        concluintes: 38,
        mulheres: 170,
        noturno: 242,
      });
    });

    it('curso com menos de 10 matrículas vem sem o corte por sexo e turno', async () => {
      const { corpo } = await pedir();

      const pequeno = corpo.cursos?.lista[1];
      expect(pequeno?.matriculas).toBe(8);
      expect(pequeno?.mulheres).toBeNull();
      expect(pequeno?.noturno).toBeNull();
    });

    it('contagem "menos de 5" chega como texto e o curso fica por último', async () => {
      await popularCenario({
        educacao: {
          inep_superior: superiorCom([
            noCursoFicticio('superior_curso_vagas', '3', null, 'vagas'),
            noCursoFicticio('superior_curso_ingressantes', null, 'menos de 5'),
            noCursoFicticio('superior_curso_matriculas', null, 'menos de 5'),
            noCursoFicticio('superior_curso_concluintes', null, 'menos de 5'),
          ]),
        },
      });

      const { corpo } = await pedir();

      expect(corpo.cursos?.lista.at(-1)).toEqual({
        curso: 'Curso Mínimo (bacharelado)',
        vagas: 3,
        ingressantes: 'menos de 5',
        matriculas: 'menos de 5',
        concluintes: 'menos de 5',
        mulheres: null,
        noturno: null,
      });
    });

    it('zero na turma da noite é dado, não falta', async () => {
      await popularCenario({
        educacao: {
          inep_superior: superiorCom([
            noCursoFicticio('superior_curso_matriculas', '40', null),
            noCursoFicticio('superior_curso_noturno', '0', null),
          ]),
        },
      });

      const { corpo } = await pedir();

      expect(corpo.cursos?.lista.find((c) => c.curso.startsWith('Curso Mínimo'))?.noturno).toBe(0);
    });
  });
});

describe('GET /api/educacao/cidade.csv', () => {
  it('é formato longo, com o nome do arquivo da aba', async () => {
    const { resposta, linhas } = await baixarCsv();

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-disposition']).toContain('educacao-cidade.csv');
    expect(linhas[0]).toContain('Indicador;Lugar;Rede;Etapa;Ano;Valor;Unidade;Fonte');
  });

  it('instrução sai por lugar, em percentual, com vírgula decimal', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas).toContain('instrucao_sem_instrucao;Orleans;todas;;2022;36,3;%;IBGE, Censo 2022');
  });

  it('moradores têm o ano de 2022, e a oferta, 2024, em linhas separadas e sem soma', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas).toContain('moradores_graduacao;Orleans;todas;;2022;590;pessoas;IBGE, Censo 2022');
    expect(linhas).toContain('superior_matriculas;Orleans;todas;;2024;300;pessoas;INEP, Censo da Educação Superior');
    expect(linhas.join('\n')).not.toMatch(/;890;/);
  });

  it('perfil sai em pessoas e em percentual sobre as matrículas', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas).toContain(
      'superior_perfil_noturno;Orleans;todas;;2024;250;pessoas;INEP, Censo da Educação Superior',
    );
    expect(linhas).toContain('superior_perfil_noturno;Orleans;todas;;2024;83,3;%;INEP, Censo da Educação Superior');
  });

  it('o IGC de SC sai por faixa no lugar Santa Catarina', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas).toContain('superior_igc_distribuicao;Santa Catarina;todas;faixa_3;2023;50;instituicoes;INEP, IGC');
  });

  it('curso com "menos de 5" sai em texto, e o corte ausente sai vazio', async () => {
    await popularCenario({
      educacao: { inep_superior: superiorCom([noCursoFicticio('superior_curso_matriculas', null, 'menos de 5')]) },
    });

    const { linhas } = await baixarCsv();

    expect(linhas).toContain(
      'superior_curso_matriculas;Orleans;todas;Curso Mínimo (bacharelado);2024;menos de 5;pessoas;INEP, Censo da Educação Superior',
    );
    expect(linhas).toContain(
      'superior_curso_mulheres;Orleans;todas;Curso Pequeno (licenciatura);2024;;pessoas;INEP, Censo da Educação Superior',
    );
  });

  it('sem coleta nenhuma, só o cabeçalho', async () => {
    await popularCenario({
      ibgeEducacaoCenso: null,
      ibgeEducacaoComparacao: null,
      educacao: { inep_superior: null },
    });

    const { linhas } = await baixarCsv();

    expect(linhas.filter((l) => l.trim() !== '')).toHaveLength(1);
  });
});
