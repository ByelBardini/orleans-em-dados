import { describe, expect, it } from 'vitest';
import {
  data,
  dataCurta,
  diaEMes,
  emMilhoes,
  milhoes,
  moeda,
  moedaCompacta,
  nomeProprio,
  numero,
  pct,
  percentual,
  porExtenso,
} from '../src/format';

// O Intl do pt-BR separa "R$" do número com espaço não separável (U+00A0).
const NBSP = ' ';

describe('moeda', () => {
  it('valor com milhar sai em reais com ponto de milhar e vírgula decimal', () => {
    expect(moeda(1234.56)).toBe(`R$${NBSP}1.234,56`);
  });

  it('zero é exibido como valor, não como ausência', () => {
    expect(moeda(0)).toBe(`R$${NBSP}0,00`);
  });

  it('valor negativo mantém o sinal', () => {
    expect(moeda(-0.5)).toBe(`-R$${NBSP}0,50`);
  });

  it.each([null, undefined])('valor %s não vira zero e aparece como travessão', (valor) => {
    expect(moeda(valor)).toBe('—');
  });
});

describe('pct', () => {
  it.each([
    [1, 3, '33,3%'],
    [1, 2, '50,0%'],
  ])('%s de %s com uma casa fixa é %s', (parte, total, esperado) => {
    expect(pct(parte, total)).toBe(esperado);
  });

  it('casas decimais pedidas como zero arredondam para o inteiro', () => {
    expect(pct(1, 3, 0)).toBe('33%');
  });

  it('parte negativa mantém o sinal no percentual', () => {
    expect(pct(-1, 4)).toBe('-25,0%');
  });

  it.each([0, null])('total %s não tem percentual e aparece como travessão', (total) => {
    expect(pct(1, total)).toBe('—');
  });
});

describe('percentual', () => {
  it.each([
    [1, 2, '50%'],
    [1, 3, '33,3%'],
  ])('%s de %s sem casas forçadas é %s', (parte, total, esperado) => {
    expect(percentual(parte, total)).toBe(esperado);
  });

  it('total zero não tem percentual e aparece como travessão', () => {
    expect(percentual(1, 0)).toBe('—');
  });
});

describe('milhões', () => {
  it('uma casa, sem unidade', () => {
    expect(milhoes(171092955.92)).toBe('171,1');
  });

  it('com unidade curta e por extenso', () => {
    expect(emMilhoes(171092955.92)).toBe('R$ 171,1 mi');
    expect(porExtenso(171092955.92)).toBe('R$ 171,1 milhões');
  });

  it('valor nulo conta como zero na barra', () => {
    expect(milhoes(null)).toBe('0,0');
  });
});

describe('moedaCompacta', () => {
  it.each([null, undefined])('valor %s aparece como travessão', (valor) => {
    expect(moedaCompacta(valor)).toBe('—');
  });

  it('valor grande sai abreviado', () => {
    expect(moedaCompacta(1500000)).toBe(`R$ 1,5${NBSP}mi`);
  });
});

describe('numero', () => {
  it('usa ponto de milhar', () => {
    expect(numero(9757)).toBe('9.757');
  });
});

describe('datas', () => {
  it('data sem hora não muda de dia, qualquer que seja o fuso', () => {
    expect(data('2025-01-10')).toBe('10/01/2025');
  });

  it('data vazia aparece como travessão', () => {
    expect(data(null)).toBe('—');
    expect(dataCurta(null)).toBe('—');
  });

  it('data curta traz o mês por extenso', () => {
    expect(dataCurta('2025-03-01T12:00:00.000Z')).toBe('01 de março de 2025');
  });
});

describe('nomeProprio', () => {
  it('caixa alta da Betha vira nome próprio, com as preposições em minúscula', () => {
    expect(nomeProprio('SECRETARIA MUNICIPAL DE EDUCAÇÃO')).toBe('Secretaria Municipal de Educação');
  });

  it('siglas conhecidas continuam em maiúscula', () => {
    expect(nomeProprio('FUNDO DO SUS E SAMAE')).toBe('Fundo do SUS e SAMAE');
  });

  // Bug conhecido, corrigir muda a tela: a comparação tira o ponto final e a lista tem 'S.A.'
  // com ponto, então nunca casa (armadilha do nomeProprio). Quando corrigir, troque por it().
  it.fails('sigla com pontuação no fim é reconhecida', () => {
    expect(nomeProprio('CONSTRUTORA FICTICIA S.A.')).toBe('Construtora Ficticia S.A.');
  });

  it('palavra depois de hífen ou barra também é tratada', () => {
    expect(nomeProprio('SAUDE/EDUCACAO - GERAL')).toBe('Saude/Educacao - Geral');
  });

  it.each([null, undefined, ''])('texto %j volta como veio', (texto) => {
    expect(nomeProprio(texto)).toBe(texto);
  });
});

describe('diaEMes', () => {
  it('corta a data ISO em DD/MM, sem passar por fuso', () => {
    expect(diaEMes('2026-09-30')).toBe('30/09');
  });

  it('sem data, travessão', () => {
    expect(diaEMes(null)).toBe('—');
  });
});
