import { describe, expect, it } from 'vitest';
import { INDICADORES, validarRegistro, type Indicador } from '../../src/indicadores/registro';

const indicador = (campos: Partial<Indicador> = {}): Indicador => ({
  id: 'receita-arrecadada',
  nome: 'Receita arrecadada',
  importador: 'betha',
  consultaId: 57153,
  conferidoContra: 900001,
  periodicidade: { exercicioCorrente: 'diaria', exercicioAnterior: 'mensal' },
  ...campos,
});

const CONHECIDAS = [
  { id: 57153, importador: 'betha' },
  { id: 900001, importador: 'tcesc' },
];

describe('validarRegistro', () => {
  it('registro coerente não tem problema', () => {
    expect(validarRegistro([indicador()], CONHECIDAS)).toEqual([]);
  });

  it('consulta que nenhum importador coleta é apontada', () => {
    expect(validarRegistro([indicador({ consultaId: 999 })], CONHECIDAS)).toEqual([
      'receita-arrecadada: a consulta 999 não tem importador declarado',
    ]);
  });

  it('consulta de outro importador é apontada', () => {
    expect(validarRegistro([indicador({ importador: 'tcesc' })], CONHECIDAS)).toEqual([
      'receita-arrecadada: a consulta 57153 é do importador betha, não de tcesc',
    ]);
  });

  it('conferência contra consulta sem importador é apontada', () => {
    expect(validarRegistro([indicador({ conferidoContra: 888 })], CONHECIDAS)).toEqual([
      'receita-arrecadada: a conferência aponta para a consulta 888, sem importador declarado',
    ]);
  });

  it('indicador sem conferência externa é aceito: nem todo dado tem segunda fonte', () => {
    expect(validarRegistro([indicador({ conferidoContra: null })], CONHECIDAS)).toEqual([]);
  });

  it('id repetido é apontado', () => {
    expect(validarRegistro([indicador(), indicador()], CONHECIDAS)).toEqual(['receita-arrecadada: id repetido']);
  });
});

describe('INDICADORES', () => {
  it('cada indicador é declarado uma vez, com nome e periodicidade', () => {
    const ids = INDICADORES.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of INDICADORES) {
      expect(i.nome.length, i.id).toBeGreaterThan(0);
      const anual =
        ['educacao-censo', 'educacao-comparacao', 'rede-escolar'].includes(i.id) ||
        ['inep', 'siope', 'mec'].includes(i.importador);
      const esperada = anual ? 'anual' : ['ibge', 'siconfi'].includes(i.importador) ? 'mensal' : 'diaria';
      expect(i.periodicidade.exercicioCorrente, i.id).toBe(esperada);
    }
  });

  it('os índices do SIOPE são conferidos contra o RREO, e a contribuição do Fundeb contra o TCE-SC', () => {
    const contra = Object.fromEntries(INDICADORES.map((i) => [i.id, i.conferidoContra]));
    expect(contra['indice-educacao']).toBe(900202);
    expect(contra['fundeb-remuneracao']).toBe(900202);
    expect(contra['fundeb-contribuicao']).toBe(900001);
    expect(contra['fundeb-resultado']).toBeNull();
  });

  it('a fonte de cada indicador é a da especificação §7.1', () => {
    const fonteDe = Object.fromEntries(INDICADORES.map((i) => [i.id, i.consultaId]));
    expect(fonteDe).toEqual({
      'receita-arrecadada': 57153,
      'receita-orcada-atualizada': 57153,
      'empenhos-individualizados': 57140,
      'despesa-empenhada-liquida': 57170,
      'despesa-liquidada-paga': 57170,
      'despesa-camara': 900002,
      populacao: 900101,
      censo: 900102,
      pib: 900103,
      comparacao: 900104,
      'educacao-censo': 900105,
      'educacao-comparacao': 900106,
      'rede-escolar': 900107,
      'despesa-por-funcao-total': 900201,
      'despesa-por-funcao-divisao': 900201,
      'indice-educacao-rreo': 900202,
      'fundeb-remuneracao-rreo': 900202,
      'rendimento-escolar': 900301,
      'transicao-escolar': 900302,
      'distorcao-idade-serie': 900303,
      'alunos-por-turma': 900304,
      'horas-aula': 900305,
      'docentes-com-superior': 900306,
      'adequacao-docente': 900307,
      'regularidade-docente': 900308,
      'esforco-docente': 900309,
      'remuneracao-rais': 900310,
      'nivel-socioeconomico': 900311,
      'alfabetizacao-2o-ano': 900312,
      'ideb-comparacao': 900313,
      enem: 900314,
      'ensino-superior': 900315,
      'indice-educacao': 900402,
      'fundeb-remuneracao': 900402,
      'fundeb-contribuicao': 900402,
      'fundeb-resultado': 900402,
      'indicadores-siope': 900401,
      'investimento-por-aluno': 900404,
      'remuneracao-medianas': 900403,
      'carga-temporaria': 900405,
      'retrato-educacao-infantil': 900501,
    });
  });

  it('só o total da despesa por função é conferido contra o TCE-SC; a divisão é fonte única', () => {
    const conferidoContra = (id: string) => INDICADORES.find((i) => i.id === id)?.conferidoContra;

    expect(conferidoContra('despesa-por-funcao-total')).toBe(900002);
    expect(conferidoContra('despesa-por-funcao-divisao')).toBeNull();
  });

  it('a despesa da Câmara não tem conferência na Betha, porque não está no portal', () => {
    expect(INDICADORES.find((i) => i.id === 'despesa-camara')?.conferidoContra).toBeNull();
  });
});
