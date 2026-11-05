import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { coletarProcurados, contarAchados, varrerPastas } from '../../src/extratores/varredura';
import { csv, pastaTemporaria } from '../support/arquivos';

const procurados = { nomes: new Set(['PESSOA FICTICIA']), cpfs: new Set(['456.789']) };

describe('contarAchados', () => {
  it('texto limpo tem zero achados', () => {
    expect(contarAchados('{"valor":"4567.89"}', procurados)).toBe(0);
  });

  it('nome é achado sem diferença de caixa e de acento', () => {
    expect(contarAchados('{"texto":"Péssoa Fictícia"}', procurados)).toBe(1);
  });

  it('miolo de CPF é achado', () => {
    expect(contarAchados('{"texto":"456.789"}', procurados)).toBe(1);
  });

  it('padrão de CPF é achado mesmo fora das planilhas', () => {
    expect(contarAchados('{"texto":"111.222.333-44"}', procurados)).toBe(1);
  });
});

describe('coletarProcurados', () => {
  it('guarda o nome inteiro, os dois primeiros nomes e o miolo do CPF', async () => {
    const pasta = pastaTemporaria();
    csv(pasta, 'Planilha.csv', ['"Nome";"CPF"', '"Pessoa Silva Ficticia";"***.456.789-**"', '"";""']);

    const { nomes, cpfs } = await coletarProcurados(pasta);

    expect([...nomes]).toEqual(['PESSOA SILVA FICTICIA', 'PESSOA SILVA']);
    expect([...cpfs]).toEqual(['456.789']);
  });
});

describe('varrerPastas', () => {
  it('devolve só contagens, e acha o nome no JSON publicado', async () => {
    const origem = pastaTemporaria();
    csv(path.join(origem, 'remuneração'), 'Planilha.csv', ['"Nome";"CPF"', '"Pessoa Ficticia";"***.456.789-**"']);
    const publicados = pastaTemporaria();
    mkdirSync(publicados, { recursive: true });
    writeFileSync(path.join(publicados, 'limpo.json'), '{"valor":"1"}');
    writeFileSync(path.join(publicados, 'vazou.json'), '{"texto":"Pessoa Ficticia"}');

    expect(await varrerPastas(origem, [publicados])).toEqual({ nomes: 1, cpfs: 1, achados: 1 });
  });

  it('pasta publicada que não existe não conta', async () => {
    const origem = pastaTemporaria();
    csv(path.join(origem, 'remuneração'), 'Planilha.csv', ['"Nome";"CPF"', '"Pessoa Ficticia";"***.456.789-**"']);

    expect((await varrerPastas(origem, [path.join(origem, 'nao-existe')])).achados).toBe(0);
  });
});
