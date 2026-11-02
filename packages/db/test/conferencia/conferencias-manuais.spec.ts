import { describe, expect, it } from 'vitest';
import type { Discrepancia } from '../../src/conferencia/conferencia.bo';
import {
  CONFERENCIAS_MANUAIS,
  cruzarConferenciasManuais,
  validarConferenciaManual,
  type ConferenciaManual,
} from '../../src/conferencia/conferencias-manuais';

const discrepancia = (campos: Partial<Discrepancia>): Discrepancia => ({
  area: 'receita',
  tipo: 'fora_do_acumulado',
  entidade: 'FMS',
  codigoEntidade: '319',
  natureza: '24145001',
  betha: 2276110,
  tce: 2026110,
  diferenca: 250000,
  nota: 'Nota (exemplo)',
  ...campos,
});

const registro = (campos: Partial<ConferenciaManual>): ConferenciaManual => ({
  ano: 2025,
  entidade: 'FMS',
  tipo: 'fora_do_acumulado',
  chave: '24145001',
  valor: 250000,
  situacao: 'confirmada_no_portal',
  evidencia: 'Conferido no portal (exemplo).',
  data: '2026-11-01',
  ...campos,
});

const cruzar = (lista: Discrepancia[], registros: ConferenciaManual[]) =>
  cruzarConferenciasManuais(2025, lista, registros);

describe('cruzarConferenciasManuais', () => {
  it('caso com registro fica confirmado, com data, protocolo e evidência', () => {
    const { discrepancias, avisos } = cruzar([discrepancia({})], [registro({ protocolo: 'e-SIC 000/0000' })]);
    expect(discrepancias).toEqual([
      {
        ...discrepancia({}),
        situacao: 'confirmada_no_portal',
        data: '2026-11-01',
        protocolo: 'e-SIC 000/0000',
        evidencia: 'Conferido no portal (exemplo).',
      },
    ]);
    expect(avisos).toEqual([]);
  });

  it('protocolo que não foi informado fica de fora', () => {
    const { discrepancias } = cruzar([discrepancia({})], [registro({})]);
    expect(discrepancias[0]).not.toHaveProperty('protocolo');
  });

  it('caso sem registro é calculada, sem data, protocolo nem evidência', () => {
    const { discrepancias, avisos } = cruzar([discrepancia({})], []);
    expect(discrepancias).toEqual([{ ...discrepancia({}), situacao: 'calculada' }]);
    expect(avisos).toEqual([]);
  });

  it('registro sem discrepância correspondente vira aviso, e as outras seguem', () => {
    const outra = discrepancia({ natureza: '17135011' });
    const { discrepancias, avisos } = cruzar([outra], [registro({})]);
    expect(discrepancias.map((d) => d.situacao)).toEqual(['calculada']);
    expect(avisos).toEqual(['Registro manual sem discrepância: 2025, FMS, fora_do_acumulado, 24145001.']);
  });

  it('valor que mudou depois da confirmação fica rever, com a data e o aviso', () => {
    const { discrepancias, avisos } = cruzar([discrepancia({ diferenca: 250000.01 })], [registro({})]);
    expect(discrepancias[0]).toMatchObject({ situacao: 'rever', data: '2026-11-01' });
    expect(avisos).toEqual([
      'Registro manual com valor diferente: 2025, FMS, fora_do_acumulado, 24145001: confirmado 250000, agora 250000.01.',
    ]);
  });

  it('diferença do lado do TCE compara pelo módulo', () => {
    const lista = [discrepancia({ tipo: 'so_tce', natureza: '11130311', diferenca: -428717.37 })];
    const { discrepancias } = cruzar(lista, [registro({ tipo: 'so_tce', chave: '11130311', valor: 428717.37 })]);
    expect(discrepancias[0]?.situacao).toBe('confirmada_no_portal');
  });

  it('registro sem total confirmado não compara o valor', () => {
    const { discrepancias, avisos } = cruzar([discrepancia({ diferenca: 1 })], [registro({ valor: null })]);
    expect(discrepancias[0]?.situacao).toBe('confirmada_no_portal');
    expect(avisos).toEqual([]);
  });

  it('natureza dividida: o registro marca só a parte do tipo dele', () => {
    const lista = [
      discrepancia({ natureza: '17135011', diferenca: 306503.9, diferencaDaNatureza: 320136.8 }),
      discrepancia({ natureza: '17135011', tipo: 'sem_causa', diferenca: 13632.9, diferencaDaNatureza: 320136.8 }),
    ];
    const { discrepancias } = cruzar(lista, [registro({ chave: '17135011', valor: 306503.9 })]);
    expect(discrepancias.map((d) => d.situacao)).toEqual(['confirmada_no_portal', 'calculada']);
  });

  it('o mesmo caso com outro tipo não corresponde', () => {
    const { discrepancias, avisos } = cruzar([discrepancia({ tipo: 'sem_causa' })], [registro({})]);
    expect(discrepancias[0]?.situacao).toBe('calculada');
    expect(avisos).toHaveLength(1);
  });

  it('a mesma natureza em outra entidade não corresponde', () => {
    const { discrepancias } = cruzar([discrepancia({ entidade: 'SAMAE' })], [registro({})]);
    expect(discrepancias[0]?.situacao).toBe('calculada');
  });

  it('registro de outro ano não corresponde nem gera aviso', () => {
    const { discrepancias, avisos } = cruzar([discrepancia({})], [registro({ ano: 2024 })]);
    expect(discrepancias[0]?.situacao).toBe('calculada');
    expect(avisos).toEqual([]);
  });

  const empenho = (numero: number, valor: number): Discrepancia =>
    discrepancia({
      area: 'empenho',
      tipo: 'empenho_fantasma',
      entidade: 'SAMAE',
      natureza: undefined,
      numero,
      diferenca: valor,
    });

  it('a chave também é o número do empenho', () => {
    const lista = [empenho(340, 20000), empenho(341, 26)];
    const manual = registro({ entidade: 'SAMAE', tipo: 'empenho_fantasma', chave: '340', valor: 20000 });
    expect(cruzar(lista, [manual]).discrepancias.map((d) => d.situacao)).toEqual(['confirmada_no_portal', 'calculada']);
  });

  const AUSENTES = { entidade: 'SAMAE', tipo: 'empenho_fantasma', chave: null } as const;

  it('registro sem chave é o grupo: todas do tipo na entidade, pela soma', () => {
    const { discrepancias } = cruzar([empenho(1, 100.1), empenho(2, 200.2)], [registro({ ...AUSENTES, valor: 300.3 })]);
    expect(discrepancias.map((d) => d.situacao)).toEqual(['confirmada_no_portal', 'confirmada_no_portal']);
  });

  it('grupo cuja soma mudou fica rever inteiro', () => {
    const { discrepancias } = cruzar([empenho(1, 100.1), empenho(2, 200.2)], [registro({ ...AUSENTES, valor: 300 })]);
    expect(discrepancias.map((d) => d.situacao)).toEqual(['rever', 'rever']);
  });
});

describe('validarConferenciaManual', () => {
  it('aceita o número do protocolo', () => {
    const certo = registro({ protocolo: 'e-SIC 000/0000' });
    expect(validarConferenciaManual(certo)).toEqual(certo);
  });

  it.each([
    ['código solto', 'ABC123XYZ9'],
    ['número seguido do código', 'e-SIC 000/0000 código 8F3A'],
    ['número sem ano', 'e-SIC 000'],
  ])('recusa protocolo com %s, sem repetir o valor no erro', (_, protocolo) => {
    expect(() => validarConferenciaManual(registro({ protocolo }))).toThrow(/protocolo/);
    expect(() => validarConferenciaManual(registro({ protocolo }))).not.toThrow(protocolo);
  });

  it('recusa um campo a mais, como o código de acompanhamento', () => {
    const comCodigo = { ...registro({}), codigoAcompanhamento: '8F3A' };
    expect(() => validarConferenciaManual(comCodigo)).toThrow(/codigoAcompanhamento/);
  });

  it('recusa código de acompanhamento na evidência', () => {
    const comCodigo = registro({ evidencia: 'Código de acompanhamento 8F3A.' });
    expect(() => validarConferenciaManual(comCodigo)).toThrow(/evidência/);
  });

  it.each([
    ['evidência vazia', { evidencia: ' ' }, /evidência/],
    ['data fora do formato', { data: '01/11/2026' }, /data/],
    ['valor negativo', { valor: -1 }, /valor/],
    ['ano quebrado', { ano: 2025.5 }, /ano/],
    ['chave vazia', { chave: '' }, /chave/],
  ])('recusa %s', (_, campos, mensagem) => {
    expect(() => validarConferenciaManual(registro(campos))).toThrow(mensagem);
  });
});

describe('situação confirmada em parte', () => {
  it('o caso confirmado em parte mantém a situação do registro, com a evidência', () => {
    const { discrepancias, avisos } = cruzar(
      [discrepancia({ diferenca: 113099.53 })],
      [registro({ situacao: 'confirmada_em_parte', valor: null, evidencia: 'Exemplo de R$ 1,00 (exemplo).' })],
    );
    expect(discrepancias[0]).toMatchObject({
      situacao: 'confirmada_em_parte',
      evidencia: 'Exemplo de R$ 1,00 (exemplo).',
    });
    expect(avisos).toEqual([]);
  });
});

describe('texto público da evidência', () => {
  it.each(['Registro fantasma.', 'Erro de digitação.', 'Situação irregular.', 'Possível fraude.'])(
    'evidência "%s" é recusada',
    (evidencia) => {
      expect(() => validarConferenciaManual(registro({ evidencia }))).toThrow('termo que afirma causa');
    },
  );

  it('palavra que só contém o termo não é recusada', () => {
    expect(validarConferenciaManual(registro({ evidencia: 'Compra de terreno e ferro.' })).evidencia).toBe(
      'Compra de terreno e ferro.',
    );
  });
});

describe('CONFERENCIAS_MANUAIS', () => {
  it.each([
    [2025, 'SAMAE', 'fora_do_acumulado', '22130101', 32900],
    [2025, 'FMS', 'fora_do_acumulado', '17135011', 306503.9],
    [2025, 'FMS', 'fora_do_acumulado', '24145001', 250000],
    [2024, 'Prefeitura', 'duas_rubricas', '17115131', 1135545.25],
    [2026, 'Prefeitura', 'duas_rubricas', '24149901', 895500],
    [2026, 'Prefeitura', 'duas_rubricas', '13210300', null],
    [2024, 'SAMAE', 'despesa_duplicada', null, 123887.32],
    [2025, 'SAMAE', 'empenho_fantasma', '340', 20000],
    [2025, 'SAMAE', 'empenho_repetido', '342', 48.72],
    [2024, 'SAMAE', 'empenho_ausente', null, 143934.18],
    [2025, 'SAMAE', 'so_tce', '11130311', 428717.37],
    [2026, 'SAMAE', 'so_tce', '11130311', 414748.48],
  ])('%i %s %s %s vale %s', (ano, entidade, tipo, chave, valor) => {
    const achados = CONFERENCIAS_MANUAIS.filter(
      (r) => r.ano === ano && r.entidade === entidade && r.tipo === tipo && r.chave === chave,
    );
    expect(achados.map((r) => r.valor)).toEqual([valor]);
  });

  it('são só os doze casos da conferência de 01/11/2026, e só a 13210300 foi confirmada em parte', () => {
    expect(CONFERENCIAS_MANUAIS).toHaveLength(12);
    expect(new Set(CONFERENCIAS_MANUAIS.map((r) => r.data))).toEqual(new Set(['2026-11-01']));
    expect(CONFERENCIAS_MANUAIS.filter((r) => r.situacao !== 'confirmada_no_portal').map((r) => r.chave)).toEqual([
      '13210300',
    ]);
  });

  it('a 13210300 é confirmada em parte, sem um total, e não como confirmada no valor inteiro', () => {
    const parcial = CONFERENCIAS_MANUAIS.find((r) => r.chave === '13210300');
    expect(parcial).toMatchObject({ situacao: 'confirmada_em_parte', valor: null });
    expect(parcial?.evidencia).not.toContain('113.099,53');
  });

  it('nenhuma evidência usa termo que afirma causa', () => {
    const textos = CONFERENCIAS_MANUAIS.map((r) => r.evidencia).join(' ');
    expect(textos).not.toMatch(/fantasma|\berros?\b|irregular|fraude/i);
  });

  it('só a natureza 11130311 do SAMAE tem protocolo, e é o número do e-SIC', () => {
    const comProtocolo = CONFERENCIAS_MANUAIS.filter((r) => r.protocolo !== undefined);
    expect(comProtocolo.map((r) => [r.ano, r.chave, r.protocolo])).toEqual([
      [2025, '11130311', 'e-SIC 000/0000'],
      [2026, '11130311', 'e-SIC 000/0000'],
    ]);
  });

  it('o exemplo parcial da 13210300 fica na evidência', () => {
    const parcial = CONFERENCIAS_MANUAIS.find((r) => r.chave === '13210300');
    expect(parcial?.evidencia).toContain('R$ 66.113,49');
  });
});
