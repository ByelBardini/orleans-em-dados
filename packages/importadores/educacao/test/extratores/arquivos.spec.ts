import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { acharArquivo, linhasDoCsv, registrosPorCodigo, textosCompartilhados } from '../../src/extratores/arquivos';
import { csv, pastaTemporaria, planilha } from '../support/arquivos';

const lerTudo = async <T>(gerador: AsyncGenerator<T>) => {
  const itens: T[] = [];
  for await (const item of gerador) itens.push(item);
  return itens;
};

describe('registrosPorCodigo', () => {
  it('acha o cabeçalho pelos códigos, depois dos títulos, e lê as linhas por código', async () => {
    const arquivo = await planilha(pastaTemporaria(), 'a.xlsx', [
      {
        nome: 'dados',
        linhas: [['Ministério'], [], ['Ano', 'Lugar'], ['NU_ANO', 'UNIDGEO', 'FUN_CAT_0'], [2025, 'Brasil', 9.5]],
      },
    ]);

    const [linha] = await lerTudo(registrosPorCodigo(arquivo, ['UNIDGEO', 'FUN_CAT_0']));

    expect(linha?.campos).toEqual({ NU_ANO: 2025, UNIDGEO: 'Brasil', FUN_CAT_0: 9.5 });
  });

  it('código com espaço em volta ainda é o código', async () => {
    const arquivo = await planilha(pastaTemporaria(), 'a.xlsx', [
      {
        nome: 'dados',
        linhas: [
          [' UNIDGEO ', 'FUN_CAT_0'],
          ['Brasil', 1],
        ],
      },
    ]);

    const [linha] = await lerTudo(registrosPorCodigo(arquivo, ['UNIDGEO', 'FUN_CAT_0']));

    expect(linha?.campos.UNIDGEO).toBe('Brasil');
  });

  it('arquivo sem a coluna pedida falha, sem adivinhar', async () => {
    const arquivo = await planilha(pastaTemporaria(), 'novo.xlsx', [
      {
        nome: 'dados',
        linhas: [
          ['UNIDGEO', 'OUTRA'],
          ['Brasil', 1],
        ],
      },
    ]);

    await expect(lerTudo(registrosPorCodigo(arquivo, ['UNIDGEO', 'FUN_CAT_0']))).rejects.toThrow(
      /novo\.xlsx: layout inesperado.*FUN_CAT_0/,
    );
  });

  it('código repetido ganha sufixo e não sobrescreve o primeiro', async () => {
    const arquivo = await planilha(pastaTemporaria(), 'a.xlsx', [
      {
        nome: 'dados',
        linhas: [
          ['REND_2023', 'REND_2023'],
          [0.8, 0.9],
        ],
      },
    ]);

    const [linha] = await lerTudo(registrosPorCodigo(arquivo, ['REND_2023']));

    expect(linha?.campos).toEqual({ REND_2023: 0.8, 'REND_2023#2': 0.9 });
  });

  it('cada aba tem o próprio cabeçalho, e a aba sem ele não entra', async () => {
    const arquivo = await planilha(pastaTemporaria(), 'a.xlsx', [
      {
        nome: 'um',
        linhas: [
          ['X_1', 'X_2'],
          [1, 2],
        ],
      },
      {
        nome: 'dicionário',
        linhas: [
          ['variável', 'descrição'],
          ['X_1', 'um'],
        ],
      },
      {
        nome: 'dois',
        linhas: [
          ['X_2', 'X_1'],
          [3, 4],
        ],
      },
    ]);

    const linhas = await lerTudo(registrosPorCodigo(arquivo, ['X_1', 'X_2']));

    expect(linhas.map((l) => [l.aba, l.campos.X_1])).toEqual([
      ['um', 1],
      ['dois', 4],
    ]);
  });

  it('filtra as abas quando pedido', async () => {
    const arquivo = await planilha(pastaTemporaria(), 'a.xlsx', [
      { nome: 'um', linhas: [['X_1'], [1]] },
      { nome: 'dois', linhas: [['X_1'], [2]] },
    ]);

    const linhas = await lerTudo(registrosPorCodigo(arquivo, ['X_1'], { abas: /dois/ }));

    expect(linhas.map((l) => l.campos.X_1)).toEqual([2]);
  });
});

describe('textosCompartilhados', () => {
  it('lê a tabela de textos do zip, com o acento e o & decodificados', async () => {
    const arquivo = await planilha(pastaTemporaria(), 'a.xlsx', [
      { nome: 'dados', linhas: [['Educação & renda', 'outro']] },
    ]);

    expect(textosCompartilhados(arquivo)).toEqual(['Educação & renda', 'outro']);
  });

  it('arquivo que não é zip falha com o nome dele', () => {
    const pasta = pastaTemporaria();
    const caminho = path.join(pasta, 'falso.xlsx');
    writeFileSync(caminho, 'isto não é um zip, nem de longe, e tem mais de 22 bytes');

    expect(() => textosCompartilhados(caminho)).toThrow(/falso\.xlsx: não é um xlsx/);
  });
});

describe('linhasDoCsv', () => {
  it('lê por nome de coluna, sem o BOM e respeitando aspas', async () => {
    const arquivo = csv(pastaTemporaria(), 'a.csv', [`${String.fromCharCode(0xfeff)}"A";"B"`, '"1;0";"x ""y"""']);
    const linhas = await lerTudo(linhasDoCsv(arquivo, ['A', 'B']));

    expect(linhas.map((campo) => [campo('A'), campo('B')])).toEqual([['1;0', 'x "y"']]);
  });

  it('coluna obrigatória ausente falha dizendo qual', async () => {
    const arquivo = csv(pastaTemporaria(), 'a.csv', ['A;B', '1;2']);

    await expect(lerTudo(linhasDoCsv(arquivo, ['A', 'C']))).rejects.toThrow(/a\.csv: layout inesperado, faltam C/);
  });

  it('arquivo vazio falha', async () => {
    const pasta = pastaTemporaria();
    const caminho = path.join(pasta, 'vazio.csv');
    writeFileSync(caminho, '');

    await expect(lerTudo(linhasDoCsv(caminho, ['A']))).rejects.toThrow(/vazio\.csv: arquivo vazio/);
  });
});

describe('acharArquivo', () => {
  it('acha na subpasta e ignora o temporário do Excel', () => {
    const pasta = pastaTemporaria();
    const sub = path.join(pasta, 'zip');
    csv(sub, '~$alvo.xlsx', ['x']);
    const alvo = csv(sub, 'alvo.xlsx', ['x']);

    expect(acharArquivo(pasta, /alvo\.xlsx$/)).toBe(alvo);
  });

  it('nome que não existe devolve nulo', () => {
    expect(acharArquivo(pastaTemporaria(), /nada/)).toBeNull();
  });
});
