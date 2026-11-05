import { describe, expect, it } from 'vitest';
import {
  extrairSuperior,
  lerIgc,
  lerInstituicao,
  lerOferta,
  loteDoSuperior,
  type DadosDoSuperior,
} from '../../src/extratores/superior';
import { csv, idsDe, pastaTemporaria, planilha, registroDe } from '../support/arquivos';

const COLUNAS =
  'CO_MUNICIPIO;TP_DIMENSAO;TP_GRAU_ACADEMICO;NO_CURSO;CO_IES;QT_CURSO;QT_VG_TOTAL;QT_INSCRITO_TOTAL;QT_ING;QT_MAT;QT_CONC;QT_MAT_FEM;QT_MAT_NOTURNO;QT_MAT_18_24;QT_MAT_PROCESCPUBLICA;QT_MAT_PROUNII;QT_MAT_PROUNIP;QT_MAT_FIES';

// municipio;dimensao;grau;curso;ies;cursos;vagas;inscritos;ing;mat;conc;fem;noturno;18-24;publica;prouni I;prouni P;fies
const CURSOS = [
  '4211702;1;1;DIREITO;77;1;99;120;77;233;28;160;233;100;90;10;5;2',
  '4211702;1;2;SISTEMAS DE INFORMACAO;77;1;50;60;20;9;6;3;9;5;4;1;0;0',
  '4211702;2;1;ADMINISTRACAO;88;1;999;999;3;2;0;1;0;1;1;0;0;0',
  '4211702;2;1;PEDAGOGIA;99;1;999;999;4;3;1;2;0;1;1;0;0;0',
  '4200000;1;1;DIREITO;77;1;500;500;500;500;500;500;500;500;500;500;500;500',
  '4211702;3;1;SEM DIMENSAO;77;1;500;500;500;500;500;500;500;500;500;500;500;500',
];

const oferta = () => lerOferta(csv(pastaTemporaria(), 'cursos.csv', [COLUNAS, ...CURSOS]));

const COLUNAS_DA_IES =
  'CO_IES;NO_IES;SG_IES;TP_CATEGORIA_ADMINISTRATIVA;QT_TEC_TOTAL;QT_DOC_EXE;QT_DOC_EX_DOUT;QT_DOC_EX_MEST;QT_DOC_EX_ESP;QT_DOC_EX_INT';

const instituicao = (categoria = '5') =>
  lerInstituicao(
    csv(pastaTemporaria(), 'ies.csv', [COLUNAS_DA_IES, `77;FACULDADE FICTICIA;FAFI;${categoria};30;40;10;15;15;4`]),
    '77',
  );

const igc = (pasta: string) =>
  planilha(pasta, 'IGC_2023.xlsx', [
    {
      nome: 'IGC',
      linhas: [
        ['Ano', ' Código da IES', ' Nome da IES', 'Sigla da UF', ' IGC (Contínuo)', ' IGC (Faixa)'],
        [2023, 77, 'FACULDADE FICTICIA', 'SC', 2.442, '3'],
        [2023, 78, 'OUTRA', 'SC', 3.9, '4'],
        [2023, 79, 'MAIS UMA', 'SC', 2.1, '3'],
        [2023, 80, 'SEM CONCEITO', 'SC', null, 'SC'],
        [2023, 81, 'DE FORA', 'PR', 4.9, '5'],
      ],
    },
    {
      nome: 'Programas_CAPES',
      linhas: [
        ['CO_IES', 'CO_PROGRAMA'],
        [77, 'x'],
      ],
    },
  ]);

const dados = async (extra: Partial<DadosDoSuperior> = {}): Promise<DadosDoSuperior> => ({
  oferta: await oferta(),
  instituicao: await instituicao(),
  igc: await lerIgc(await igc(pastaTemporaria()), '77'),
  cpc: [],
  enade: [],
  licenciaturas: [],
  arquivos: [],
  ...extra,
});

const B = '4211702:todas';

describe('lerOferta', () => {
  it('só o presencial de Orleans é detalhado', async () => {
    const { cursos } = await oferta();

    expect(cursos.map((c) => c.curso)).toEqual(['Direito', 'Sistemas de Informacao']);
  });

  it('a distância fica em total: instituições distintas, matrículas e ingressantes', async () => {
    const { distancia } = await oferta();

    expect(distancia.instituicoes.size).toBe(2);
    expect(distancia.matriculas).toBe(5);
    expect(distancia.ingressantes).toBe(7);
  });

  it('o Prouni soma integral e parcial', async () => {
    expect((await oferta()).perfil.prouni).toBe(16);
  });
});

describe('loteDoSuperior', () => {
  it('EaD não sai por curso', async () => {
    const ids = idsDe(loteDoSuperior(await dados()));

    expect(ids.some((id) => /Administracao|Pedagogia/.test(id))).toBe(false);
    expect(ids).toContain(`${B}:::superior_ead_matriculas:2024`);
  });

  it('curso com menos de 10 matrículas não tem o corte por sexo e turno', async () => {
    const lote = loteDoSuperior(await dados());

    expect(
      registroDe(lote, `${B}::Sistemas de Informacao (licenciatura):superior_curso_mulheres:2024`),
    ).toBeUndefined();
    expect(registroDe(lote, `${B}::Sistemas de Informacao (licenciatura):superior_curso_noturno:2024`)).toBeUndefined();
    expect(registroDe(lote, `${B}::Sistemas de Informacao (licenciatura):superior_curso_matriculas:2024`)?.valor).toBe(
      '9',
    );
  });

  it('curso com 10 ou mais tem o corte', async () => {
    const lote = loteDoSuperior(await dados());

    expect(registroDe(lote, `${B}::Direito (bacharelado):superior_curso_mulheres:2024`)?.valor).toBe('160');
  });

  it('contagem de 1 a 4 no curso sai como "menos de 5"', async () => {
    const pequena = await oferta();
    (pequena.cursos[1] as { concluintes: number }).concluintes = 4;

    const lote = loteDoSuperior(await dados({ oferta: pequena }));

    expect(
      registroDe(lote, `${B}::Sistemas de Informacao (licenciatura):superior_curso_concluintes:2024`),
    ).toMatchObject({
      valor: null,
      texto: 'menos de 5',
    });
  });

  it.each([
    ['5', 'Privada sem fins lucrativos'],
    ['4', 'Privada com fins lucrativos'],
    ['1', 'Pública Federal'],
  ])('a natureza vem do TP_CATEGORIA_ADMINISTRATIVA %s: %s', async (codigo, esperado) => {
    const lote = loteDoSuperior(await dados({ instituicao: await instituicao(codigo) }));

    expect(registroDe(lote, `${B}:::superior_natureza:2024`)?.texto).toBe(esperado);
  });

  it('categoria que o dicionário não tem falha', async () => {
    await expect(instituicao('0')).rejects.toThrow(/categoria administrativa inesperada/);
  });

  it('a distribuição do IGC conta só as instituições de SC com faixa', async () => {
    const lote = loteDoSuperior(await dados());

    expect(registroDe(lote, '42:todas::faixa_3:superior_igc_distribuicao:2023')?.valor).toBe('2');
    expect(registroDe(lote, '42:todas::faixa_4:superior_igc_distribuicao:2023')?.valor).toBe('1');
    expect(registroDe(lote, '42:todas::faixa_5:superior_igc_distribuicao:2023')).toBeUndefined();
  });

  it('faixa "SC" do CPC é sem conceito: texto, nunca número', async () => {
    const lote = loteDoSuperior(
      await dados({ cpc: [{ area: 'AREA FICTICIA', participantes: 1, continuo: null, faixa: 'SC' }] }),
    );

    expect(registroDe(lote, `${B}::AREA FICTICIA:superior_cpc_faixa:2023`)).toMatchObject({ valor: null, texto: 'SC' });
    expect(registroDe(lote, `${B}::AREA FICTICIA:superior_cpc_participantes:2023`)).toMatchObject({
      valor: null,
      texto: 'menos de 5',
    });
  });

  it('proficiência das licenciaturas é fração na fonte e percentual no lote', async () => {
    const lote = loteDoSuperior(
      await dados({ licenciaturas: [{ area: 'AREA', participantes: 7, proficiencia: 0.429, faixa: '2' }] }),
    );

    expect(registroDe(lote, `${B}::AREA:superior_licenciatura_proficiencia:2025`)?.valor).toBe('42.9');
  });
});

describe('lerIgc', () => {
  it('lê o nome de coluna com espaço e a nota da instituição', async () => {
    const lido = await lerIgc(await igc(pastaTemporaria()), '77');

    expect(lido).toMatchObject({ continuo: 2.442, faixa: '3', totalSc: 3, semFaixaSc: 1 });
  });

  it('instituição fora do arquivo falha', async () => {
    await expect(lerIgc(await igc(pastaTemporaria()), '1')).rejects.toThrow(/sem a instituição 1/);
  });

  it('arquivo sem as colunas falha', async () => {
    const caminho = await planilha(pastaTemporaria(), 'novo.xlsx', [{ nome: 'IGC', linhas: [['Outra'], [1]] }]);

    await expect(lerIgc(caminho, '77')).rejects.toThrow(/novo\.xlsx: layout inesperado/);
  });
});

describe('extrairSuperior', () => {
  it('sem os arquivos, falha', async () => {
    await expect(extrairSuperior({ origem: pastaTemporaria() })).rejects.toThrow(/Arquivo não encontrado/);
  });
});
