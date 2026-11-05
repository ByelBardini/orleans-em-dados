import { describe, expect, it } from 'vitest';
import { extrairEnem, loteDoEnem, redesPublicaveis, somarResultados } from '../../src/extratores/enem';
import { csv, idsDe, pastaTemporaria, registroDe } from '../support/arquivos';

const COLUNAS =
  'CO_ESCOLA;CO_MUNICIPIO_ESC;CO_UF_ESC;TP_DEPENDENCIA_ADM_ESC;CO_MUNICIPIO_PROVA;TP_PRESENCA_CN;TP_PRESENCA_CH;TP_PRESENCA_LC;TP_PRESENCA_MT;NU_NOTA_CN;NU_NOTA_CH;NU_NOTA_LC;NU_NOTA_MT;NU_NOTA_REDACAO';

type Linha = {
  escola?: string;
  municipio?: string;
  uf?: string;
  rede?: string;
  prova?: string;
  presente?: boolean;
  notas?: (number | '')[];
};

const linha = ({
  escola = '1',
  municipio = '4211702',
  uf = '42',
  rede = '2',
  prova = '4200000',
  presente = true,
  notas = [500, 500, 500, 500, 500],
}: Linha) => {
  const p = presente ? '1' : '0';
  return [escola, municipio, uf, rede, prova, p, p, p, p, ...notas].join(';');
};

const somas = (linhas: Linha[], ano = 2025) => {
  const caminho = csv(pastaTemporaria(), `RESULTADOS_${ano}.csv`, [COLUNAS, ...linhas.map(linha)]);
  return somarResultados(caminho, ano);
};

// Cinco alunos em cada uma das duas escolas estaduais, para o resto do lote não ficar retido.
const duasEstaduais: Linha[] = ['1', '2'].flatMap((escola) => Array.from({ length: 5 }, () => ({ escola })));
const umaPrivada: Linha[] = Array.from({ length: 5 }, () => ({
  escola: '3',
  rede: '4',
  notas: [700, 700, 700, 700, 700],
}));
const duasPrivadas: Linha[] = [
  ...umaPrivada,
  ...Array.from({ length: 5 }, () => ({ escola: '4', rede: '4', notas: [600, 600, 600, 600, 600] })),
];

describe('somarResultados', () => {
  it('rede pública soma federal, estadual e municipal; todas soma também a privada', async () => {
    const { brasil } = await somas([
      { escola: 'a', municipio: '1100000', uf: '11', rede: '1' },
      { escola: 'b', municipio: '1100000', uf: '11', rede: '2' },
      { escola: 'c', municipio: '1100000', uf: '11', rede: '3' },
      { escola: 'd', municipio: '1100000', uf: '11', rede: '4' },
    ]);

    expect(brasil.get('publica')?.inscritos).toBe(3);
    expect(brasil.get('todas')?.inscritos).toBe(4);
    expect(brasil.get('privada')?.inscritos).toBe(1);
  });

  it('SC só conta quem tem escola em SC, e Orleans, quem tem escola em Orleans', async () => {
    const { orleans, santaCatarina, brasil } = await somas([
      { municipio: '4211702', uf: '42' },
      { municipio: '4200000', uf: '42' },
      { municipio: '1100000', uf: '11' },
    ]);

    expect(orleans.get('todas')?.inscritos).toBe(1);
    expect(santaCatarina.get('todas')?.inscritos).toBe(2);
    expect(brasil.get('todas')?.inscritos).toBe(3);
  });

  it('quem não tem escola fica fora das redes, e entra na prova em Orleans quando prova aqui', async () => {
    const { brasil, provaEmOrleans, origemDaProva } = await somas([
      { municipio: '', uf: '', rede: '', prova: '4211702' },
      { municipio: '', uf: '', rede: '', prova: '4200000' },
    ]);

    expect(brasil.get('todas')).toBeUndefined();
    expect(provaEmOrleans.inscritos).toBe(1);
    expect(origemDaProva.semEscola).toBe(1);
  });

  it('presente é quem veio às quatro provas', async () => {
    const { orleans } = await somas([{ presente: true }, { presente: false }]);

    expect(orleans.get('todas')).toMatchObject({ inscritos: 2, presentes: 1 });
  });

  it('coluna ausente falha', async () => {
    const caminho = csv(pastaTemporaria(), 'RESULTADOS_2025.csv', ['CO_ESCOLA;OUTRA', '1;2']);

    await expect(somarResultados(caminho, 2025)).rejects.toThrow(/layout inesperado, faltam CO_MUNICIPIO_ESC/);
  });
});

describe('loteDoEnem', () => {
  const lote = async (linhas: Linha[]) => loteDoEnem(await somas(linhas), 'RESULTADOS_2025.csv');

  it('a média das 5 áreas considera só quem tem as cinco notas, e cada área, quem tem a nota', async () => {
    const resultado = await lote([
      { escola: '1', notas: [600, 600, 600, 600, 600] },
      { escola: '2', notas: [400, '', '', '', ''] },
      ...duasEstaduais.slice(0, 3).map((l) => ({ ...l, notas: ['', '', '', '', ''] as ''[] })),
    ]);

    expect(registroDe(resultado, '4211702:estadual:medio::enem_media_5_areas:2025')?.valor).toBe('600.00');
    expect(registroDe(resultado, '4211702:estadual:medio::enem_natureza:2025')?.valor).toBe('500.00');
    expect(registroDe(resultado, '4211702:estadual:medio::enem_humanas:2025')?.valor).toBe('600.00');
  });

  it('rede com 2 escolas publica', async () => {
    const resultado = await lote([...duasEstaduais, ...duasPrivadas]);

    expect(registroDe(resultado, '4211702:privada:medio::enem_media_5_areas:2025')?.valor).toBe('650.00');
    expect(registroDe(resultado, '4211702:todas:medio::enem_inscritos:2025')?.valor).toBe('20');
  });

  it('rede com 1 escola não publica nota nem quem fez a prova, só a contagem de escolas', async () => {
    const resultado = await lote([...duasEstaduais, ...umaPrivada]);

    expect(idsDe(resultado).filter((id) => id.startsWith('4211702:privada'))).toEqual([
      '4211702:privada:medio::enem_escolas:2025',
    ]);
    expect(registroDe(resultado, '4211702:privada:medio::enem_escolas:2025')?.valor).toBe('1');
  });

  it('o total de Orleans também fica retido, para a rede de 1 escola não sair por subtração', async () => {
    const resultado = await lote([...duasEstaduais, ...umaPrivada]);

    expect(registroDe(resultado, '4211702:todas:medio::enem_media_5_areas:2025')).toBeUndefined();
    expect(registroDe(resultado, '4211702:estadual:medio::enem_media_5_areas:2025')?.valor).toBe('500.00');
  });

  it('SC e Brasil não têm retenção: a privada de SC sai mesmo com 1 escola', async () => {
    const resultado = await lote([
      ...duasEstaduais,
      ...duasPrivadas,
      ...Array.from({ length: 5 }, () => ({ escola: '9', municipio: '4200000', rede: '1' })),
    ]);

    expect(registroDe(resultado, '42:federal:medio::enem_inscritos:2025')?.valor).toBe('5');
  });

  it('contagem de 1 a 4 de Orleans sai como "menos de 5"', async () => {
    const resultado = await lote([...duasEstaduais, ...duasPrivadas, { escola: '1', presente: false }]);

    expect(registroDe(resultado, '4211702:estadual:medio:prova_em_orleans:enem_inscritos:2025')).toBeUndefined();
    const dois = await lote([
      { escola: '1', presente: true },
      { escola: '2', presente: true },
    ]);
    expect(registroDe(dois, '4211702:estadual:medio::enem_presentes:2025')).toMatchObject({
      valor: null,
      texto: 'menos de 5',
    });
  });

  it('a prova em Orleans é outro recorte, com a origem de quem prova', async () => {
    const resultado = await lote([
      ...duasEstaduais.map((l) => ({ ...l, prova: '4211702' })),
      ...duasPrivadas,
      ...Array.from({ length: 5 }, () => ({ municipio: '', uf: '', rede: '', prova: '4211702' })),
    ]);

    expect(registroDe(resultado, '4211702:todas:medio:prova_em_orleans:enem_inscritos:2025')?.valor).toBe('15');
    expect(
      registroDe(resultado, '4211702:todas:medio:prova_em_orleans:escola_em_orleans:enem_inscritos:2025')?.valor,
    ).toBe('10');
    expect(registroDe(resultado, '4211702:todas:medio:prova_em_orleans:sem_escola:enem_inscritos:2025')?.valor).toBe(
      '5',
    );
  });

  it('o código da escola não sai no lote', async () => {
    const resultado = await lote([
      ...duasEstaduais.map((l) => ({ ...l, escola: `ESCOLA${l.escola}` })),
      ...duasPrivadas,
    ]);

    expect(JSON.stringify(resultado)).not.toContain('ESCOLA');
  });
});

describe('redesPublicaveis', () => {
  const escolas = (mapa: Record<string, string[]>) =>
    new Map(Object.entries(mapa).map(([rede, lista]) => [rede, new Set(lista)])) as never;

  it('rede pública retida também tira o agregado público e o total', () => {
    const publicaveis = redesPublicaveis(
      escolas({ municipal: ['1'], estadual: ['2', '3'], publica: ['1', '2', '3'], todas: ['1', '2', '3'] }),
    );

    expect([...publicaveis]).toEqual(['estadual']);
  });

  it('duas redes retidas não se deduzem uma da outra: o total fica', () => {
    const publicaveis = redesPublicaveis(
      escolas({
        municipal: ['1'],
        privada: ['2'],
        estadual: ['3', '4'],
        publica: ['1', '3', '4'],
        todas: ['1', '2', '3', '4'],
      }),
    );

    expect([...publicaveis].sort()).toEqual(['estadual', 'publica', 'todas']);
  });
});

describe('extrairEnem', () => {
  it('sem o arquivo do ano, falha', async () => {
    await expect(extrairEnem({ origem: pastaTemporaria() })).rejects.toThrow(/RESULTADOS_2024\.csv/);
  });
});
