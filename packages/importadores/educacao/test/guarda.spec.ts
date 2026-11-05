import { describe, expect, it } from 'vitest';
import { CAMPOS_DE_FINANCAS, CAMPOS_DE_VALORES, recusarDadoPessoal } from '../src/guarda';

const registro = (extra: Record<string, unknown> = {}) => ({
  id: '4211702:publica:fundamental::aprovacao:2025',
  indicador: 'aprovacao',
  lugar: '4211702',
  rede: 'publica',
  etapa: 'fundamental',
  recorte: '',
  periodo: '2025',
  valor: '97.2',
  texto: null,
  unidade: '%',
  ...extra,
});

describe('recusarDadoPessoal', () => {
  it('registro só com os campos do vocabulário passa', () => {
    expect(() => recusarDadoPessoal(registro(), CAMPOS_DE_VALORES)).not.toThrow();
  });

  it.each([
    ['com pontos', '123.456.789-09'],
    ['mascarado como no SIOPE', '***.456.789-**'],
    ['só dígitos', '12345678909'],
  ])('CPF %s em qualquer campo é recusado', (_nome, cpf) => {
    expect(() => recusarDadoPessoal(registro({ texto: `pessoa ${cpf}` }), CAMPOS_DE_VALORES)).toThrow(/padrão de CPF/);
  });

  it('o erro de CPF nomeia o campo e não repete o valor', () => {
    expect(() => recusarDadoPessoal(registro({ texto: '123.456.789-09' }), CAMPOS_DE_VALORES)).toThrow(
      /^campo texto com padrão de CPF$/,
    );
  });

  it('campo nome é recusado mesmo com valor inofensivo', () => {
    expect(() => recusarDadoPessoal(registro({ nome: 'x' }), CAMPOS_DE_VALORES)).toThrow(/campo desconhecido: nome/);
  });

  it('chave fora do vocabulário é recusada', () => {
    expect(() => recusarDadoPessoal(registro({ escola: 'x' }), CAMPOS_DE_VALORES)).toThrow(
      /campo desconhecido: escola/,
    );
  });

  it('finanças aceita percentual e não aceita etapa', () => {
    const { etapa: _e, texto: _t, unidade: _u, ...base } = registro();
    expect(() => recusarDadoPessoal({ ...base, percentual: '25.00' }, CAMPOS_DE_FINANCAS)).not.toThrow();
    expect(() => recusarDadoPessoal({ ...base, etapa: 'creche' }, CAMPOS_DE_FINANCAS)).toThrow(
      /campo desconhecido: etapa/,
    );
  });

  it('valor de dinheiro com ponto decimal não parece CPF', () => {
    expect(() => recusarDadoPessoal(registro({ valor: '12345678909.12' }), CAMPOS_DE_VALORES)).not.toThrow();
  });
});
