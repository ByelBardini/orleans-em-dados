import type { FastifyInstance } from 'fastify';
import { educacaoProfessoresSchema } from '@orleans-em-dados/contracts';
import { pool } from '@orleans-em-dados/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { popularCenario } from '../../../../packages/importadores/fixtures/src/banco-de-teste';
import { ibgeRedeEscolar } from '../../../../packages/importadores/fixtures/src/snapshots';
import { criarApp } from '../../src/app';

let app: FastifyInstance;

const pedir = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/professores' });
  return { status: resposta.statusCode, corpo: educacaoProfessoresSchema.parse(resposta.json()) };
};

const baixarCsv = async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/educacao/professores.csv' });
  return { resposta, linhas: resposta.body.split('\r\n') };
};

const SEM_NADA = {
  ibgeRedeEscolar: null,
  educacao: {
    inep_turmas: null,
    inep_horas: null,
    inep_docentes_superior: null,
    inep_adequacao: null,
    inep_regularidade: null,
    inep_remuneracao: null,
    siope_remuneracao: null,
    siope_remuneracao_carga: null,
  },
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

describe('GET /api/educacao/professores', () => {
  it('com todas as coletas, nada falta', async () => {
    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.disponivel).toBe(true);
    expect(corpo.faltando).toEqual([]);
  });

  it('sem nenhuma coleta, responde 200, com os blocos nulos e todas as consultas em faltando', async () => {
    await popularCenario(SEM_NADA);

    const { status, corpo } = await pedir();

    expect(status).toBe(200);
    expect(corpo.disponivel).toBe(false);
    expect(corpo.turmas).toBeNull();
    expect(corpo.temporarios).toBeNull();
    expect(corpo.rais).toBeNull();
    expect([...corpo.faltando].sort()).toEqual([
      'ibge_rede_escolar',
      'inep_adequacao',
      'inep_docentes_superior',
      'inep_horas',
      'inep_regularidade',
      'inep_remuneracao',
      'inep_turmas',
      'siope_remuneracao',
      'siope_remuneracao_carga',
    ]);
  });

  it('sem a coleta da RAIS, só o bloco dela some', async () => {
    await popularCenario({ educacao: { inep_remuneracao: null } });

    const { corpo } = await pedir();

    expect(corpo.rais).toBeNull();
    expect(corpo.faltando).toEqual(['inep_remuneracao']);
    expect(corpo.remuneracao?.anos).toHaveLength(3);
  });

  describe('turmas e horas', () => {
    it('compara rede com rede, sem misturar com o total', async () => {
      const { corpo } = await pedir();

      const anosIniciais = corpo.turmas?.comparacoes.find((c) => c.etapa === 'anos_iniciais');
      expect(corpo.turmas?.ano).toBe('2025');
      expect(anosIniciais?.unidade).toBe('alunos');
      expect(anosIniciais?.porRede.municipal).toEqual({ orleans: 15.5, santaCatarina: 21.5, brasil: 22 });
      expect(anosIniciais?.porRede.todas).toBeUndefined();
    });

    it('rede que Orleans não tem fica nula em Orleans, nunca zero', async () => {
      const { corpo } = await pedir();

      const anosIniciais = corpo.turmas?.comparacoes.find((c) => c.etapa === 'anos_iniciais');
      expect(anosIniciais?.porRede.estadual?.orleans).toBeNull();
      expect(anosIniciais?.porRede.estadual?.santaCatarina).toBe(22.5);
    });

    it('as etapas vão da creche ao ensino médio, em ordem', async () => {
      const { corpo } = await pedir();

      expect(corpo.turmas?.comparacoes.map((c) => c.etapa)).toEqual([
        'creche',
        'pre_escola',
        'anos_iniciais',
        'anos_finais',
        'medio',
      ]);
    });

    it('horas de aula vêm em horas, nos três lugares', async () => {
      const { corpo } = await pedir();

      const creche = corpo.horas?.comparacoes.find((c) => c.etapa === 'creche');
      expect(creche?.indicador).toBe('horas_aula');
      expect(creche?.unidade).toBe('horas');
      expect(creche?.porRede.todas).toEqual({ orleans: 9, santaCatarina: 9, brasil: 7.5 });
    });
  });

  describe('formação', () => {
    it('cada etapa traz os cinco grupos, com o indicador nomeando o grupo', async () => {
      const { corpo } = await pedir();

      const infantil = corpo.formacao?.etapas.find((e) => e.etapa === 'educacao_infantil');
      expect(infantil?.grupos.map((g) => g.grupo)).toEqual(['grupo_1', 'grupo_2', 'grupo_3', 'grupo_4', 'grupo_5']);
      expect(infantil?.grupos[4]?.comparacao.indicador).toBe('adequacao_grupo_5');
      expect(infantil?.grupos[4]?.comparacao.porRede.todas).toEqual({ orleans: 23, santaCatarina: 9, brasil: 15 });
    });

    it('grupo com zero segue zero', async () => {
      const { corpo } = await pedir();

      const infantil = corpo.formacao?.etapas.find((e) => e.etapa === 'educacao_infantil');
      expect(infantil?.grupos[3]?.comparacao.porRede.todas?.orleans).toBe(0);
    });

    it('docentes com superior é outro indicador, por etapa', async () => {
      const { corpo } = await pedir();

      const medio = corpo.docentesSuperior?.comparacoes.find((c) => c.etapa === 'medio');
      expect(medio?.indicador).toBe('docentes_superior');
      expect(medio?.porRede.todas).toEqual({ orleans: 92, santaCatarina: 94, brasil: 96 });
    });
  });

  describe('regularidade', () => {
    it('cada nível compara a mesma rede nos três lugares', async () => {
      const { corpo } = await pedir();

      const baixa = corpo.regularidade?.niveis.find((n) => n.nivel === 'baixa')?.comparacao;
      expect(baixa?.porRede.municipal).toEqual({ orleans: 20, santaCatarina: 20, brasil: 12 });
      expect(baixa?.porRede.estadual).toEqual({ orleans: 80, santaCatarina: 77, brasil: 30 });
    });

    it('os níveis vão de baixa a alta', async () => {
      const { corpo } = await pedir();

      expect(corpo.regularidade?.niveis.map((n) => n.nivel)).toEqual(['baixa', 'media_baixa', 'media_alta', 'alta']);
    });
  });

  describe('alunos por docente', () => {
    it('é matrículas ÷ docentes da rede municipal, com uma casa, ano a ano', async () => {
      const { corpo } = await pedir();

      expect(corpo.alunosPorDocente?.rede).toBe('municipal');
      const creche = corpo.alunosPorDocente?.etapas.find((e) => e.etapa === 'creche');
      expect(creche?.anos).toEqual([
        { ano: '2024', matriculas: 400, docentes: 40, alunosPorDocente: 10 },
        // 410 ÷ 40 = 10,25
        { ano: '2025', matriculas: 410, docentes: 40, alunosPorDocente: 10.3 },
      ]);
    });

    it('a pré-escola tem a própria conta', async () => {
      const { corpo } = await pedir();

      const pre = corpo.alunosPorDocente?.etapas.find((e) => e.etapa === 'pre_escola');
      expect(pre?.anos.at(-1)).toEqual({ ano: '2025', matriculas: 310, docentes: 50, alunosPorDocente: 6.2 });
    });

    it('sem docente na fonte, a conta fica nula e a matrícula segue', async () => {
      const lote = ibgeRedeEscolar();
      await popularCenario({
        ibgeRedeEscolar: {
          ...lote,
          registros: lote.registros.filter((r) => r.categoria !== 'Docentes > Ensino infantil > Creche > Municipal'),
        },
      });

      const { corpo } = await pedir();

      const creche = corpo.alunosPorDocente?.etapas.find((e) => e.etapa === 'creche');
      expect(creche?.anos.at(-1)).toEqual({ ano: '2025', matriculas: 410, docentes: null, alunosPorDocente: null });
    });
  });

  describe('temporários', () => {
    it('um ano por foto de maio, do mais antigo ao mais novo', async () => {
      const { corpo } = await pedir();

      expect(corpo.temporarios?.anos.map((a) => a.periodo)).toEqual(['2024-05', '2025-05', '2026-05']);
    });

    it('traz carga e profissionais do magistério e dos outros, à parte', async () => {
      const { corpo } = await pedir();

      expect(corpo.temporarios?.anos.at(-1)).toEqual({
        periodo: '2026-05',
        magisterio: { cargaTemporaria: 45, profissionais: 150 },
        outros: { cargaTemporaria: 50, profissionais: 120 },
      });
    });

    it('grupo de menos de 5 pessoas sai como o texto da fonte', async () => {
      const { corpo } = await pedir();

      expect(corpo.temporarios?.anos[0]?.outros.profissionais).toBe('menos de 5');
    });
  });

  describe('remuneração', () => {
    it('medianas por 40 horas, por grupo e vínculo', async () => {
      const { corpo } = await pedir();

      expect(corpo.remuneracao?.anos[1]).toEqual({
        periodo: '2025-05',
        magisterio: { todos: 6000, efetivo: 7000, temporario: 5500 },
        outros: { todos: null, efetivo: 2500, temporario: null },
      });
    });

    it('mediana nula, com menos de 10 pessoas, segue nula', async () => {
      const { corpo } = await pedir();

      expect(corpo.remuneracao?.anos.at(-1)?.outros.efetivo).toBeNull();
    });
  });

  describe('RAIS', () => {
    it('Orleans e Brasil na rede municipal; SC, sem linha municipal, na pública', async () => {
      const { corpo } = await pedir();

      expect(corpo.rais?.ano).toBe('2021');
      expect(corpo.rais?.linhas.map(({ lugar, rede, mediaPor40h }) => [lugar, rede, mediaPor40h])).toEqual([
        ['orleans', 'municipal', 3900],
        ['santaCatarina', 'publica', 5300],
        ['brasil', 'municipal', 5150],
      ]);
    });
  });
});

describe('GET /api/educacao/professores.csv', () => {
  it('sai em formato longo, com o nome de arquivo da aba', async () => {
    const { resposta, linhas } = await baixarCsv();

    expect(resposta.headers['content-disposition']).toContain('educacao-professores.csv');
    expect(linhas[0]).toContain('Indicador;Lugar;Rede;Etapa;Ano;Valor;Unidade;Fonte');
  });

  it('o grupo da formação vem no indicador, e o lugar sem dado sai vazio', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas).toContainEqual(
      expect.stringMatching(/^adequacao_grupo_5;Orleans;todas;educacao_infantil;2025;23;%;/),
    );
    expect(linhas).toContainEqual(
      expect.stringMatching(/^alunos_por_turma;Orleans;estadual;anos_iniciais;2025;;alunos;/),
    );
  });

  it('a foto de maio fica no ano, e a mediana nula, vazia', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas).toContainEqual(
      expect.stringMatching(/^carga_temporaria_magisterio;Orleans;municipal;;2026-05;45;%;/),
    );
    expect(linhas).toContainEqual(
      expect.stringMatching(/^mediana_40h_outros_efetivo;Orleans;municipal;;2026-05;;reais;/),
    );
  });

  it('a conta de alunos por docente leva matrículas e docentes junto', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas).toContainEqual(
      expect.stringMatching(/^alunos_por_docente;Orleans;municipal;creche;2024;10;alunos;/),
    );
    expect(linhas).toContainEqual(expect.stringMatching(/^matriculas;Orleans;municipal;creche;2024;400;matriculas;/));
    expect(linhas).toContainEqual(expect.stringMatching(/^docentes;Orleans;municipal;creche;2024;40;docentes;/));
  });

  it('a RAIS diz a rede de cada lugar', async () => {
    const { linhas } = await baixarCsv();

    expect(linhas).toContainEqual(
      expect.stringMatching(/^remuneracao_rais_media_40h;Santa Catarina;publica;;2021;5300;reais;/),
    );
  });

  it('sem nenhuma coleta, só o cabeçalho', async () => {
    await popularCenario(SEM_NADA);

    const { linhas } = await baixarCsv();

    expect(linhas.filter((l) => l !== '')).toHaveLength(1);
  });
});
