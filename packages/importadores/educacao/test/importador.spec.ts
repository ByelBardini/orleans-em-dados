import { describe, expect, it } from 'vitest';
import { tabelas } from '@orleans-em-dados/db';
import { criarImportadoresDeEducacao, type LinhaDeValor } from '../src/importador';

const importadores = criarImportadoresDeEducacao();
const consultaDe = (chave: string) => {
  const achada = importadores.flatMap((i) => i.consultas).find((c) => c.chave === chave);
  if (!achada) throw new Error(`sem ${chave}`);
  return achada;
};

const valor = (extra: Record<string, unknown> = {}) => ({
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

const financa = (extra: Record<string, unknown> = {}) => ({
  id: '4211702:municipal:dotacao:gasto_total:2025',
  indicador: 'gasto_total',
  lugar: '4211702',
  rede: 'municipal',
  recorte: 'dotacao',
  periodo: '2025',
  valor: '1234.56',
  percentual: null,
  ...extra,
});

describe('criarImportadoresDeEducacao', () => {
  it('um importador por fonte, com fontes.id igual ao id', () => {
    expect(importadores.map((i) => i.id)).toEqual(['inep', 'siope', 'mec']);
  });

  it.each(['inep', 'siope', 'mec'])('%s não tem agenda nem anos de rodada', (id) => {
    const importador = importadores.find((i) => i.id === id);
    expect(importador?.agenda).toBeUndefined();
    expect(importador?.anosDaRodada(new Date('2026-11-04'))).toEqual([]);
  });

  it('os ids e as tabelas das consultas são os do catálogo', () => {
    const tabela = (chave: string) => consultaDe(chave).tabela;
    expect(importadores.flatMap((i) => i.consultas).map((c) => c.id)).toEqual([
      900301, 900302, 900303, 900304, 900305, 900306, 900307, 900308, 900309, 900310, 900311, 900312, 900313, 900314,
      900315, 900401, 900404, 900402, 900403, 900405, 900501,
    ]);
    expect(tabela('inep_remuneracao')).toBe(tabelas.educacaoFinancas);
    expect(tabela('siope_indicadores')).toBe(tabelas.educacaoValores);
    expect(tabela('siope_indicadores_valores')).toBe(tabelas.educacaoFinancas);
    expect(tabela('siope_remuneracao')).toBe(tabelas.educacaoFinancas);
    expect(tabela('siope_remuneracao_carga')).toBe(tabelas.educacaoValores);
    expect(tabela('mec_retrato')).toBe(tabelas.educacaoValores);
  });

  it('coletar recusa e aponta a carga por arquivo', async () => {
    await expect(consultaDe('inep_enem').coletar({ ano: 2025 })).rejects.toThrow(/pnpm importar --arquivo/);
  });
});

describe('normalizar de educacao_valores', () => {
  const { normalizar } = consultaDe('inep_rendimento');

  it('registro vira linha com o id em idExterno', () => {
    expect(normalizar(valor())).toEqual({
      idExterno: '4211702:publica:fundamental::aprovacao:2025',
      indicador: 'aprovacao',
      lugar: '4211702',
      rede: 'publica',
      etapa: 'fundamental',
      recorte: '',
      periodo: '2025',
      valor: '97.2',
      texto: null,
      unidade: '%',
    } satisfies LinhaDeValor);
  });

  it('valor nulo fica nulo, nunca zero', () => {
    expect(normalizar(valor({ valor: null })).valor).toBeNull();
  });

  it('registro com CPF é recusado', () => {
    expect(() => normalizar(valor({ texto: '123.456.789-09' }))).toThrow(/padrão de CPF/);
  });

  it('registro com campo nome é recusado', () => {
    expect(() => normalizar(valor({ nome: 'x' }))).toThrow(/campo desconhecido: nome/);
  });

  it('contagem de pessoas abaixo de 5 em número é recusada', () => {
    expect(() => normalizar(valor({ valor: '4', unidade: 'pessoas' }))).toThrow(/menos de 5/);
  });

  it('contagem abaixo de 5 em texto passa', () => {
    const linha = normalizar(valor({ valor: null, texto: 'menos de 5', unidade: 'pessoas' }));
    expect(linha.texto).toBe('menos de 5');
  });

  it.each([
    ['rede', 'estadual_e_municipal'],
    ['lugar', '4200000'],
    ['etapa', 'mestrado'],
    ['unidade', 'kg'],
  ])('%s fora do vocabulário é recusado', (campo, invalido) => {
    expect(() => normalizar(valor({ [campo]: invalido }))).toThrow(new RegExp(`${campo} fora do vocabulário`));
  });

  it('valor que não é decimal em texto é recusado', () => {
    expect(() => normalizar(valor({ valor: 97.2 }))).toThrow(/valor não é decimal em texto/);
  });

  it('id diferente da junção dos campos é recusado', () => {
    expect(() => normalizar(valor({ id: 'outra-coisa' }))).toThrow(/id não é a junção/);
  });
});

describe('normalizar de educacao_financas', () => {
  const { normalizar } = consultaDe('siope_anexo8');

  it('valor e percentual ficam em texto decimal', () => {
    expect(normalizar(financa({ percentual: '28.63' }))).toEqual({
      idExterno: '4211702:municipal:dotacao:gasto_total:2025',
      indicador: 'gasto_total',
      lugar: '4211702',
      rede: 'municipal',
      recorte: 'dotacao',
      periodo: '2025',
      valor: '1234.56',
      percentual: '28.63',
    });
  });

  it('dinheiro com mais de dois decimais é recusado', () => {
    expect(() => normalizar(financa({ valor: '1234.567' }))).toThrow(/valor não é decimal/);
  });

  it('campo etapa é recusado', () => {
    expect(() => normalizar(financa({ etapa: 'creche' }))).toThrow(/campo desconhecido: etapa/);
  });
});

describe('validar de inep_rendimento', () => {
  const consulta = consultaDe('inep_rendimento');
  const linha = (indicador: string, v: string | null) =>
    consulta.normalizar(
      valor({ id: `4211702:publica:fundamental::${indicador}:2025`, indicador, valor: v }),
    ) as LinhaDeValor;
  const coleta = { filtro: {}, totalHits: 3, registros: [] };

  it('as três taxas perto de 100 passam', () => {
    const linhas = [linha('aprovacao', '97.2'), linha('reprovacao', '2.8'), linha('abandono', '0.1')];
    expect(consulta.validar(coleta, linhas).erros).toEqual([]);
  });

  it('as três taxas longe de 100 rejeitam, dizendo o lugar, a rede e a etapa', () => {
    const linhas = [linha('aprovacao', '90'), linha('reprovacao', '2.8'), linha('abandono', '0')];
    expect(consulta.validar(coleta, linhas).erros).toEqual([
      '4211702/publica/fundamental: aprovação + reprovação + abandono = 92.8',
    ]);
  });
});
