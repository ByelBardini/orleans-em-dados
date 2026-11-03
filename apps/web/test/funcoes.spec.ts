import type { FuncoesSerie } from '@orleans-em-dados/contracts';
import { describe, expect, it } from 'vitest';
import { linhaDaParticipacao, oQueMudou, reguaDasFuncoes } from '../src/funcoes';

type Ano = FuncoesSerie['anos'][number];

const participacao = (empenhado: number, pago = empenhado) => ({ empenhado, liquidado: empenhado, pago });
const funcao = (codigo: string, nome: string, p: number, pago?: number) => ({
  codigo,
  nome,
  empenhado: 1,
  liquidado: 1,
  pago: 1,
  participacao: participacao(p, pago),
});
const ano = (numero: number, funcoes: Ano['funcoes']): Ano => ({
  ano: numero,
  conferencia: 'sem_tce',
  total: { empenhado: 1, liquidado: 1, pago: 1 },
  funcoes,
  camara: null,
});

describe('oQueMudou', () => {
  const ANOS = [
    ano(2018, [funcao('26', 'Transporte', 9.05), funcao('15', 'Urbanismo', 7.24), funcao('12', 'Educação', 25.73)]),
    ano(2020, [funcao('26', 'Transporte', 9.8), funcao('15', 'Urbanismo', 13.15), funcao('12', 'Educação', 20.08)]),
    ano(2022, [funcao('26', 'Transporte', 12.31), funcao('15', 'Urbanismo', 7.5), funcao('12', 'Educação', 30.32)]),
    ano(2024, [funcao('26', 'Transporte', 13.47), funcao('15', 'Urbanismo', 9.92), funcao('12', 'Educação', 21.91)]),
    ano(2025, [funcao('26', 'Transporte', 13.02), funcao('15', 'Urbanismo', 5.08), funcao('12', 'Educação', 24.58)]),
  ];

  it('diz a maior alta entre o primeiro e o último ano', () => {
    expect(oQueMudou(ANOS, 'empenhado')[0]).toEqual({
      codigo: '26',
      nome: 'Transporte',
      frase: 'passou de 9,1% do total em 2018 para 13,0% em 2025, a maior alta do período.',
    });
  });

  it('diz a maior queda entre os dois últimos anos', () => {
    expect(oQueMudou(ANOS, 'empenhado')[1]).toEqual({
      codigo: '15',
      nome: 'Urbanismo',
      frase: 'caiu de 9,9% em 2024 para 5,1% em 2025, a maior queda de um ano para o outro.',
    });
  });

  it('diz quem mais oscilou, do menor ao maior valor', () => {
    expect(oQueMudou(ANOS, 'empenhado')[2]).toEqual({
      codigo: '12',
      nome: 'Educação',
      frase: 'foi a que mais oscilou: de 20,1% em 2020 a 30,3% em 2022.',
    });
  });

  it('usa a participação da etapa escolhida', () => {
    const anos = [ano(2024, [funcao('10', 'Saúde', 10, 40)]), ano(2025, [funcao('10', 'Saúde', 20, 50)])];

    expect(oQueMudou(anos, 'pago')[0]?.frase).toContain('de 40,0% do total em 2024 para 50,0% em 2025');
  });

  it('sem ninguém subindo, não inventa alta', () => {
    const anos = [ano(2024, [funcao('10', 'Saúde', 20)]), ano(2025, [funcao('10', 'Saúde', 10)])];

    expect(oQueMudou(anos, 'empenhado').map((m) => m.frase)).not.toContainEqual(expect.stringContaining('maior alta'));
  });

  it('sem ninguém caindo, não inventa queda', () => {
    const anos = [ano(2024, [funcao('10', 'Saúde', 10)]), ano(2025, [funcao('10', 'Saúde', 20)])];

    expect(oQueMudou(anos, 'empenhado').map((m) => m.frase)).not.toContainEqual(expect.stringContaining('maior queda'));
  });

  it('função que não existe no primeiro ano fica fora da maior alta', () => {
    const anos = [
      ano(2024, [funcao('10', 'Saúde', 10)]),
      ano(2025, [funcao('10', 'Saúde', 12), funcao('27', 'Desporto', 90)]),
    ];

    expect(oQueMudou(anos, 'empenhado')[0]?.nome).toBe('Saúde');
  });

  it('com um ano só, não há o que comparar', () => {
    expect(oQueMudou([ano(2025, [funcao('10', 'Saúde', 10)])], 'empenhado')).toEqual([]);
  });
});

describe('reguaDasFuncoes', () => {
  const FUNCOES = [29, 25, 13, 12, 8, 5, 3, 2, 2, 1].map((p, i) => ({
    codigo: String(i),
    nome: `Função ${i}`,
    participacao: p,
  }));

  it('mostra as seis maiores e junta o resto em "outras"', () => {
    const regua = reguaDasFuncoes(FUNCOES);

    expect(regua).toHaveLength(7);
    expect(regua.at(-1)).toEqual({ chave: 'outras', nome: 'Outras 4 funções', participacao: 8, tom: 'outras' });
  });

  it('as duas maiores levam o destaque, e o resto não', () => {
    expect(reguaDasFuncoes(FUNCOES).map((s) => s.tom)).toEqual([
      'destaque',
      'destaque',
      'normal',
      'normal',
      'normal',
      'normal',
      'outras',
    ]);
  });

  it('com até sete funções, não há o que juntar', () => {
    const regua = reguaDasFuncoes(FUNCOES.slice(0, 7));

    expect(regua.map((s) => s.tom)).not.toContain('outras');
    expect(regua).toHaveLength(7);
  });

  it('soma as outras sem erro de ponto flutuante', () => {
    const regua = reguaDasFuncoes([
      ...FUNCOES.slice(0, 6),
      { codigo: 'a', nome: 'A', participacao: 0.1 },
      { codigo: 'b', nome: 'B', participacao: 0.2 },
    ]);

    expect(regua.at(-1)?.participacao).toBe(0.3);
  });
});

describe('linhaDaParticipacao', () => {
  it('cada linha usa a própria escala: o menor fica embaixo, e o maior em cima', () => {
    const { pontos } = linhaDaParticipacao([10, 20]);

    expect(pontos).toBe('0.0,36.0 200.0,0.0');
  });

  it('variação pequena usa altura mínima de 2 pontos, para não parecer um salto', () => {
    // 10 e 10,5 centrados em 2 pontos de altura: 9,25 a 11,25.
    const { pontos } = linhaDaParticipacao([10, 10.5]);

    expect(pontos).toBe('0.0,22.5 200.0,13.5');
  });

  it('o último ponto é o do último ano com valor, em percentual do desenho', () => {
    expect(linhaDaParticipacao([10, 20]).ultimo).toEqual({ esquerda: 100, topo: 0 });
  });

  it('ano sem valor fica fora da linha, mantendo a posição dos outros', () => {
    expect(linhaDaParticipacao([10, null, 20]).pontos).toBe('0.0,36.0 200.0,0.0');
    expect(linhaDaParticipacao([10, 15, null]).ultimo?.esquerda).toBe(50);
  });

  it('sem nenhum valor, não há linha', () => {
    expect(linhaDaParticipacao([null, null])).toEqual({ pontos: '', ultimo: null });
  });
});
