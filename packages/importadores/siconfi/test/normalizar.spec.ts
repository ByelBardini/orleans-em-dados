import { describe, expect, it } from 'vitest';
import { normalizarConta, registroDoItem } from '../src/normalizar';
import { COLUNAS, item } from './support/dca';

const normalizar = (conta: string, coluna = COLUNAS.empenhado, valor = 44499944.22, campos = {}) =>
  normalizarConta(registroDoItem(item(coluna, conta, valor, campos)));

describe('registroDoItem', () => {
  it('id combina etapa e conta, únicos dentro do anexo', () => {
    expect(registroDoItem(item(COLUNAS.pago, '10 - Saúde', 1)).id).toBe('pago:10 - Saúde');
  });

  it('coluna desconhecida lança citando o texto', () => {
    expect(() => registroDoItem(item('Despesas Orçadas', '10 - Saúde', 1))).toThrow('Despesas Orçadas');
  });
});

describe('normalizarConta', () => {
  it('`10 - Saúde` vira função 10, com o valor em texto decimal', () => {
    expect(normalizar('10 - Saúde')).toEqual({
      idExterno: 'empenhado:10 - Saúde',
      etapa: 'empenhado',
      tipo: 'funcao',
      funcaoCodigo: '10',
      subfuncaoCodigo: null,
      conta: 'Saúde',
      valor: '44499944.22',
    });
  });

  it('`01 - Legislativa` mantém o zero à esquerda', () => {
    expect(normalizar('01 - Legislativa').funcaoCodigo).toBe('01');
  });

  it('`10.301 - Atenção Básica` vira subfunção 10.301 da função 10', () => {
    expect(normalizar('10.301 - Atenção Básica')).toMatchObject({
      tipo: 'subfuncao',
      funcaoCodigo: '10',
      subfuncaoCodigo: '10.301',
      conta: 'Atenção Básica',
    });
  });

  it('`FU12 - Demais Subfunções` vira subfunção da função 12, sem inventar número', () => {
    expect(normalizar('FU12 - Demais Subfunções')).toMatchObject({
      tipo: 'subfuncao',
      funcaoCodigo: '12',
      subfuncaoCodigo: 'FU12',
      conta: 'Demais Subfunções',
    });
  });

  it('`Despesas Exceto Intraorçamentárias` vira a linha de total, sem função', () => {
    expect(normalizar('Despesas Exceto Intraorçamentárias')).toMatchObject({
      tipo: 'total',
      funcaoCodigo: null,
      subfuncaoCodigo: null,
    });
  });

  it.each([
    ['Inscrição de Restos a Pagar Não Processados', 'rp_nao_processados'],
    ['Inscrição de Restos a Pagar Processados', 'rp_processados'],
    ['Despesas Liquidadas', 'liquidado'],
    ['Despesas Pagas', 'pago'],
  ])('coluna %s vira a etapa %s', (coluna, etapa) => {
    expect(normalizar('10 - Saúde', coluna).etapa).toBe(etapa);
  });

  it.each([['Despesas Intraorçamentárias'], ['100 - Outra'], ['10.30 - Curta']])(
    'conta em formato desconhecido %s lança citando o texto',
    (conta) => {
      expect(() => normalizar(conta)).toThrow(conta);
    },
  );

  it('ente diferente de Orleans lança citando o recebido', () => {
    expect(() => normalizar('10 - Saúde', COLUNAS.pago, 1, { cod_ibge: 4200000 })).toThrow('4200000');
  });

  it('valor com mais de duas casas lança, em vez de arredondar', () => {
    expect(() => normalizar('10 - Saúde', COLUNAS.pago, 1.005)).toThrow('1.005');
  });
});
