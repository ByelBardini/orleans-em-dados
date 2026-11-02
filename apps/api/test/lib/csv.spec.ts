import { describe, expect, it } from 'vitest';
import { gerarCsv } from '../../src/lib/csv';

const BOM = '﻿';
const COLUNAS: [string, string][] = [
  ['nome', 'Nome'],
  ['valor', 'Valor'],
];

describe('gerarCsv', () => {
  it('abre com BOM, separa por ponto e vírgula e fecha cada linha com CRLF', () => {
    expect(gerarCsv(COLUNAS, [{ nome: 'IPTU', valor: 10 }])).toBe(`${BOM}Nome;Valor\r\nIPTU;10\r\n`);
  });

  it('sem linhas, sai só o cabeçalho', () => {
    expect(gerarCsv(COLUNAS, [])).toBe(`${BOM}Nome;Valor\r\n`);
  });

  it.each([
    [1234.56, '1234,56'],
    [-5000.25, '-5000,25'],
    ['1234.56', '1234,56'],
    [0, '0'],
  ])('valor %s usa vírgula decimal: %s', (valor, esperado) => {
    expect(gerarCsv([['valor', 'V']], [{ valor }])).toBe(`${BOM}V\r\n${esperado}\r\n`);
  });

  it('código com pontos não é número: continua como veio', () => {
    expect(gerarCsv([['c', 'C']], [{ c: '1.7.1.3.50' }])).toBe(`${BOM}C\r\n1.7.1.3.50\r\n`);
  });

  it.each([null, undefined])('valor %s vira célula vazia, não zero', (valor) => {
    expect(gerarCsv(COLUNAS, [{ nome: 'x', valor }])).toBe(`${BOM}Nome;Valor\r\nx;\r\n`);
  });

  it.each([
    ['a;b', '"a;b"'],
    ['diz "oi"', '"diz ""oi"""'],
    ['duas\nlinhas', '"duas\nlinhas"'],
    ['retorno\rde carro', '"retorno\rde carro"'],
  ])('texto %j é escapado entre aspas', (nome, esperado) => {
    expect(gerarCsv([['nome', 'N']], [{ nome }])).toBe(`${BOM}N\r\n${esperado}\r\n`);
  });

  it('título com ponto e vírgula também é escapado', () => {
    expect(gerarCsv([['a', 'A;B']], [])).toBe(`${BOM}"A;B"\r\n`);
  });
});
