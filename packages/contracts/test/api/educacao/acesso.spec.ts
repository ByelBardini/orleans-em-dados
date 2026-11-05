import { describe, expect, it } from 'vitest';
import { educacaoAcessoSchema } from '../../../src/api';

const indisponivel = {
  disponivel: false,
  faltando: ['mec_retrato'],
  frequencia: null,
  matriculas: null,
  outroMunicipio: null,
  retrato: null,
};

const retrato = {
  ano: '2025',
  fonte: { nome: 'MEC', url: 'https://mec.exemplo' },
  solicitacoesNaoAtendidas: null,
  quantidadeNaLista: null,
  listaUnificada: null,
  listasDivulgadas: null,
  criteriosDePrioridade: null,
  idadeInicial: null,
  foraDaPreEscola: null,
  nivelDeOrleans: null,
  distribuicaoEmSc: [],
};

describe('educacaoAcessoSchema', () => {
  it('todo bloco é nulável, e a resposta sem coleta passa', () => {
    expect(educacaoAcessoSchema.parse(indisponivel).faltando).toEqual(['mec_retrato']);
  });

  it('bloco ausente é recusado: sem coleta é nulo, não some da resposta', () => {
    const { retrato: _retrato, ...semRetrato } = indisponivel;

    expect(educacaoAcessoSchema.safeParse(semRetrato).error?.issues[0]?.path).toEqual(['retrato']);
  });

  it('a quantidade na fila aceita nulo e recusa texto', () => {
    const comTexto = { ...indisponivel, retrato: { ...retrato, quantidadeNaLista: 'Sem dado' } };

    expect(educacaoAcessoSchema.safeParse({ ...indisponivel, retrato }).success).toBe(true);
    expect(educacaoAcessoSchema.safeParse(comTexto).error?.issues[0]?.path).toEqual(['retrato', 'quantidadeNaLista']);
  });

  it('nível de gestão fora dos quatro é recusado', () => {
    const fora = { ...indisponivel, retrato: { ...retrato, nivelDeOrleans: 'otimo' } };

    expect(educacaoAcessoSchema.safeParse(fora).success).toBe(false);
  });
});
