import { describe, expect, it } from 'vitest';
import { campo, crc16, montarBrCode } from '../../../src/modules/apoio/brcode.js';

// O exemplo de QR estático do Manual de Padrões para Iniciação do Pix (BCB), com o CRC já calculado pelo Banco.
const VETOR_DO_BCB =
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal' +
  '6008BRASILIA62070503***63041D3D';

describe('montarBrCode', () => {
  it('reproduz o exemplo do manual do Banco Central, com o CRC dele', () => {
    const codigo = montarBrCode({
      chave: '123e4567-e12b-12d1-a456-426655440000',
      nome: 'Fulano de Tal',
      cidade: 'BRASILIA',
    });

    expect(codigo).toBe(VETOR_DO_BCB);
  });

  it('o código termina no campo 63 com quatro dígitos hexadecimais', () => {
    const codigo = montarBrCode({ chave: 'contato@exemplo.test', nome: 'Orleans em Dados', cidade: 'Orleans' });

    expect(codigo).toMatch(/6304[0-9A-F]{4}$/);
  });

  it('nome com acento sai sem acento, e a caixa fica', () => {
    const codigo = montarBrCode({ chave: 'contato@exemplo.test', nome: 'Associação São João', cidade: 'Orleans' });

    expect(codigo).toContain('5919Associacao Sao Joao');
  });

  it('nome com mais de 25 caracteres é cortado em 25, e o tamanho do campo acompanha', () => {
    const codigo = montarBrCode({
      chave: 'contato@exemplo.test',
      nome: 'Fulano de Tal da Silva Pereira',
      cidade: 'Orleans',
    });

    expect(codigo).toContain('5925Fulano de Tal da Silva Pe6007');
  });

  it('cidade sai em maiúsculas e sem acento', () => {
    const codigo = montarBrCode({ chave: 'contato@exemplo.test', nome: 'Fulano', cidade: 'São Ludgero' });

    expect(codigo).toContain('6011SAO LUDGERO');
  });

  it('cidade com mais de 15 caracteres é cortada em 15, sem espaço no fim', () => {
    const codigo = montarBrCode({ chave: 'contato@exemplo.test', nome: 'Fulano', cidade: 'Braço do Norte de Cima' });

    expect(codigo).toContain('6014BRACO DO NORTE6207');
  });

  it.each([
    ['e-mail', 'contato@exemplo.test', '0120contato@exemplo.test'],
    ['telefone com +55', '+5548999999999', '0114+5548999999999'],
    ['CPF de 11 dígitos', '52998224725', '011152998224725'],
    ['CPF com pontuação', '529.982.247-25', '011152998224725'],
    ['CNPJ de 14 dígitos', '11222333000181', '011411222333000181'],
    ['chave aleatória', '123E4567-E12B-12D1-A456-426655440000', '0136123e4567-e12b-12d1-a456-426655440000'],
    ['chave com espaço em volta', '  contato@exemplo.test ', '0120contato@exemplo.test'],
  ])('aceita %s', (_tipo, chave, esperado) => {
    expect(montarBrCode({ chave, nome: 'Fulano', cidade: 'Orleans' })).toContain(`0014br.gov.bcb.pix${esperado}`);
  });

  it.each([
    ['chave vazia', '', 'PIX_CHAVE vazia'],
    ['telefone sem +55', '48999999999', 'não é e-mail, telefone com +55, CPF, CNPJ nem chave aleatória'],
    ['CPF com dígito errado', '52998224726', 'não é e-mail, telefone com +55, CPF, CNPJ nem chave aleatória'],
    ['chave com mais de 77 caracteres', `${'a'.repeat(70)}@exemplo.test`, 'tem 83 caracteres; o máximo é 77'],
  ])('recusa %s, dizendo por quê', (_caso, chave, razao) => {
    expect(() => montarBrCode({ chave, nome: 'Fulano', cidade: 'Orleans' })).toThrow(razao);
  });

  it.each([
    ['nome', { nome: '¨¨', cidade: 'Orleans' }, 'PIX_NOME vazio'],
    ['cidade', { nome: 'Fulano', cidade: '   ' }, 'PIX_CIDADE vazia'],
  ])('recusa %s vazio depois de normalizado', (_campo, dados, razao) => {
    expect(() => montarBrCode({ chave: 'contato@exemplo.test', ...dados })).toThrow(razao);
  });
});

describe('crc16', () => {
  it('dá o valor de referência do CRC-16/CCITT-FALSE para "123456789"', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  // O erro mais comum dos geradores: calcular sem o "6304" do próprio campo do CRC.
  it('o CRC do BR Code é calculado com o "6304" no fim', () => {
    const semCrc = VETOR_DO_BCB.slice(0, -4);

    expect(crc16(semCrc)).toBe('1D3D');
    expect(crc16(semCrc.slice(0, -4))).not.toBe('1D3D');
  });

  it('sai com quatro dígitos mesmo quando começa por zero', () => {
    // Conferido com um segundo cálculo, por tabela, fora do projeto.
    expect(crc16('h')).toBe('0C5E');
  });
});

describe('campo', () => {
  it('é o id, o tamanho em dois dígitos e o valor', () => {
    expect(campo('59', 'Fulano')).toBe('5906Fulano');
  });

  it('valor com mais de 99 caracteres não cabe no campo', () => {
    expect(() => campo('26', 'x'.repeat(100))).toThrow('campo 26 com 100 caracteres');
  });
});
