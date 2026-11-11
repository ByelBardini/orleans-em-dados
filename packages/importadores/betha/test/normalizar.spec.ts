import { describe, expect, it } from 'vitest';
import { normalizarDespesa, normalizarEmpenho, normalizarReceita } from '../src/normalizar';

const receita = (campos: object = {}) => ({
  id: '211:728:697340_3',
  rubricaNatureza: '11125001000000',
  descricaoNatureza: 'IPTU',
  valorOrcado: 1000000,
  valorOrcadoDeducoes: 0,
  valorOrcadoAtualizado: 1000000.5,
  valorLancadoNoMes: 0,
  valorArrecadadoNoMes: 250000.5,
  valorArrecadadoAteMes: 550000.5,
  percentualRealizado: 55.01,
  ...campos,
});

describe('normalizarReceita (57153)', () => {
  it('monta a linha com entidade e rubrica do id, mês do sufixo e dinheiro em texto', () => {
    expect(normalizarReceita(receita())).toEqual({
      idExterno: '211:728:697340_3',
      entidadeCodigo: '728',
      idRubricaBetha: '211:728:697340',
      mes: 3,
      rubrica: '11125001000000',
      descricao: 'IPTU',
      valorOrcado: '1000000.00',
      valorOrcadoDeducoes: '0.00',
      valorOrcadoAtualizado: '1000000.50',
      valorLancadoMes: '0.00',
      valorArrecadadoMes: '250000.50',
      valorArrecadadoAteMes: '550000.50',
      percentualRealizado: '55.01',
    });
  });

  it('id sem sufixo de mês fica com mês nulo', () => {
    expect(normalizarReceita(receita({ id: '211:728:697340' })).mes).toBeNull();
  });

  it('receita negativa mantém o sinal', () => {
    expect(normalizarReceita(receita({ valorArrecadadoNoMes: -5000.25 })).valorArrecadadoMes).toBe('-5000.25');
  });

  it('valor ausente fica nulo, não zero', () => {
    expect(normalizarReceita(receita({ valorArrecadadoNoMes: null })).valorArrecadadoMes).toBeNull();
    const { valorOrcado: _fora, ...semOrcado } = receita();
    expect(normalizarReceita(semOrcado).valorOrcado).toBeNull();
  });

  it('rubrica com zero à esquerda é mantida em texto', () => {
    expect(normalizarReceita(receita({ rubricaNatureza: '01125001000000' })).rubrica).toBe('01125001000000');
  });

  it('rubrica que chega como número é recusada, porque já perdeu os zeros', () => {
    expect(() => normalizarReceita(receita({ rubricaNatureza: 11125001000000 }))).toThrow('11125001000000');
  });

  it('valor com mais de duas casas é recusado citando o valor', () => {
    expect(() => normalizarReceita(receita({ valorOrcado: 10.123 }))).toThrow('10.123');
  });

  it('mês fora de 1 a 12 no sufixo é recusado citando o id', () => {
    expect(() => normalizarReceita(receita({ id: '211:728:1_13' }))).toThrow('211:728:1_13');
  });

  // Regressão (07/11/2026): em exercícios antigos (2015) a 57153 traz o mês no meio do id, com dois dígitos, e a
  // rubrica de 15 dígitos no fim. O mês era lido de "orcamentaria" e o lote inteiro era rejeitado.
  describe('id do formato antigo (receita_orcamentaria_<ano>_<mês>_<entidade>_<rubrica>)', () => {
    const antigo = (mes: string) => `211:728:receita_orcamentaria_2015_${mes}_728_411120201000000`;

    it.each([
      ['01', 1],
      ['12', 12],
    ])('mês %s do meio do id vira o mês %i', (sufixo, mes) => {
      expect(normalizarReceita(receita({ id: antigo(sufixo) })).mes).toBe(mes);
    });

    it('rubrica da Betha é o id sem o mês, igual em todos os meses', () => {
      const janeiro = normalizarReceita(receita({ id: antigo('01') }));
      const marco = normalizarReceita(receita({ id: antigo('03') }));
      expect(janeiro.idRubricaBetha).toBe('211:728:receita_orcamentaria_2015_728_411120201000000');
      expect(marco.idRubricaBetha).toBe('211:728:receita_orcamentaria_2015_728_411120201000000');
    });

    it('mês 13 no meio do id é recusado citando o id', () => {
      expect(() => normalizarReceita(receita({ id: antigo('13') }))).toThrow(antigo('13'));
    });
  });
});

const empenho = (campos: object = {}) => ({
  id: '211:319:2001',
  numeroEmpenho: 5,
  dataEmpenho: '2025-01-20',
  descricaoOrgao: 'FUNDO MUNICIPAL DE SAÚDE',
  credor: { nomeCredor: 'LABORATORIO EXEMPLO LTDA' },
  historicoEmpenho: 'Exames',
  valorEmpenho: 15000,
  valorLiquidadoEmpenho: 10000.1,
  valorPagoEmpenho: 5000,
  saldoAPagar: 10000,
  ...campos,
});

describe('normalizarEmpenho (57140)', () => {
  it('monta a linha com entidade do id e credor do objeto aninhado', () => {
    expect(normalizarEmpenho(empenho())).toEqual({
      idExterno: '211:319:2001',
      entidadeCodigo: '319',
      numero: 5,
      dataEmpenho: '2025-01-20',
      orgao: 'FUNDO MUNICIPAL DE SAÚDE',
      credor: 'LABORATORIO EXEMPLO LTDA',
      historico: 'Exames',
      valorEmpenho: '15000.00',
      valorLiquidado: '10000.10',
      valorPago: '5000.00',
      saldoAPagar: '10000.00',
    });
  });

  it('empenho sem liquidação fica com liquidado nulo, não zero', () => {
    const linha = normalizarEmpenho(empenho({ valorLiquidadoEmpenho: null, valorPagoEmpenho: null }));
    expect(linha.valorLiquidado).toBeNull();
    expect(linha.valorPago).toBeNull();
  });

  it('empenho sem credor fica com credor nulo', () => {
    expect(normalizarEmpenho(empenho({ credor: null })).credor).toBeNull();
  });

  it.each([[null], ['abc'], [1.5]])('número %s é recusado, porque a coluna é obrigatória', (numeroEmpenho) => {
    expect(() => normalizarEmpenho(empenho({ numeroEmpenho }))).toThrow(String(numeroEmpenho));
  });
});

const despesa = (campos: object = {}) => ({
  id: '211:728:3001',
  idNatureza: '33903000000000',
  numero: '2001',
  descricao: 'Manutenção do ensino',
  valorOrcado: 400000,
  valorOrcadoAtualizado: 410000,
  valorEmpenhadoAtualizado: 53000,
  valorLiquidadoAtualizado: 52000.75,
  valorPagoAtualizado: 47000,
  ...campos,
});

describe('normalizarDespesa (57170)', () => {
  it('monta a linha com os valores atualizados, líquidos de anulações', () => {
    expect(normalizarDespesa(despesa())).toEqual({
      idExterno: '211:728:3001',
      entidadeCodigo: '728',
      natureza: '33903000000000',
      acaoNumero: '2001',
      acao: 'Manutenção do ensino',
      valorOrcado: '400000.00',
      valorOrcadoAtualizado: '410000.00',
      valorEmpenhado: '53000.00',
      valorLiquidado: '52000.75',
      valorPago: '47000.00',
    });
  });

  it('natureza ausente é recusada, porque a coluna é obrigatória', () => {
    expect(() => normalizarDespesa(despesa({ idNatureza: null }))).toThrow('idNatureza');
  });
});
