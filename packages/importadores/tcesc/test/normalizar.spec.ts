import { describe, expect, it } from 'vitest';
import { normalizarEmpenho, normalizarReceita } from '../src/normalizar';

const receita = (campos: object = {}) => ({
  id: 'Prefeitura|1.1.1|mar|',
  nomeunidade: 'Prefeitura Municipal de Orleans',
  codigoreceita: '1.1.1.2.50.0.1',
  Mês: 'mar',
  descricaotipodeducaoreceita: null,
  valorArrecadado: '250000.50',
  natureza: 'IPTU',
  ...campos,
});

describe('normalizarReceita (900001)', () => {
  it('monta a linha com o mês do nome abreviado', () => {
    expect(normalizarReceita(receita())).toEqual({
      idExterno: 'Prefeitura|1.1.1|mar|',
      unidade: 'Prefeitura Municipal de Orleans',
      codigo: '1.1.1.2.50.0.1',
      natureza: 'IPTU',
      tipoDeducao: null,
      mes: 3,
      valorArrecadado: '250000.50',
    });
  });

  it.each([
    ['jan', 1],
    ['dez', 12],
  ])('mês %s é o %s', (Mês, mes) => {
    expect(normalizarReceita(receita({ Mês })).mes).toBe(mes);
  });

  it('mês desconhecido é recusado citando o valor', () => {
    expect(() => normalizarReceita(receita({ Mês: 'março' }))).toThrow('março');
  });

  it('dedução vem com o tipo; sem tipo é receita bruta', () => {
    expect(normalizarReceita(receita({ descricaotipodeducaoreceita: 'FUNDEB' })).tipoDeducao).toBe('FUNDEB');
  });

  it('valor negativo mantém o sinal', () => {
    expect(normalizarReceita(receita({ valorArrecadado: '-5000.25' })).valorArrecadado).toBe('-5000.25');
  });

  it('valor ausente é recusado: a coluna é obrigatória', () => {
    expect(() => normalizarReceita(receita({ valorArrecadado: null }))).toThrow('valorArrecadado');
  });

  it('unidade ausente é recusada: é por ela que o vínculo com a Betha acontece', () => {
    expect(() => normalizarReceita(receita({ nomeunidade: null }))).toThrow('nomeunidade');
  });
});

const empenho = (campos: object = {}) => ({
  id: '5001',
  'ID Empenho': '5001',
  codigoUG: '204',
  numero: '10',
  dataEmpenho: '2025-01-10',
  credor: 'MERENDA EXEMPLO LTDA',
  historico: 'Merenda',
  valorOriginal: '50000.00',
  valorReforco: '0.00',
  valorEstorno: '-100.00',
  valorEmpenhado: '49900.00',
  valorLiquidado: '40000.00',
  valorPago: null,
  ...campos,
});

describe('normalizarEmpenho (900002)', () => {
  it('monta a linha com o número inteiro e os valores em texto', () => {
    expect(normalizarEmpenho(empenho())).toEqual({
      idExterno: '5001',
      codigoUg: '204',
      numero: 10,
      dataEmpenho: '2025-01-10',
      credor: 'MERENDA EXEMPLO LTDA',
      historico: 'Merenda',
      valorOriginal: '50000.00',
      valorReforco: '0.00',
      valorEstorno: '-100.00',
      valorEmpenhado: '49900.00',
      valorLiquidado: '40000.00',
      valorPago: null,
    });
  });

  it('número ausente fica nulo: a coluna do TCE-SC aceita', () => {
    expect(normalizarEmpenho(empenho({ numero: null })).numero).toBeNull();
  });

  it('número que não é inteiro é recusado citando o valor', () => {
    expect(() => normalizarEmpenho(empenho({ numero: '12a' }))).toThrow('12a');
  });

  it('unidade gestora ausente é recusada: a coluna é obrigatória', () => {
    expect(() => normalizarEmpenho(empenho({ codigoUG: null }))).toThrow('codigoUG');
  });
});
