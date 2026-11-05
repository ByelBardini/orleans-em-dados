import { describe, expect, it } from 'vitest';
import { situacaoDaAtualizacao, type Periodicidade } from '../../src/indicadores/atraso';

const PERIODICIDADE: Periodicidade = { exercicioCorrente: 'diaria', exercicioAnterior: 'mensal' };
const AGORA = new Date('2026-03-10T06:00:00.000Z');

const situacao = (ano: number, ultimaExtracao: string | null) =>
  situacaoDaAtualizacao(PERIODICIDADE, ano, ultimaExtracao, AGORA);

describe('situacaoDaAtualizacao — exercício corrente, periodicidade diária', () => {
  it('extração de hoje está em dia', () => {
    expect(situacao(2026, '2026-03-10T03:00:00.000Z')).toEqual({
      situacao: 'em_dia',
      ultimaExtracao: '2026-03-10T03:00:00.000Z',
    });
  });

  it('extração de ontem à noite está em dia: a janela é de tempo, não de dia do calendário', () => {
    expect(situacao(2026, '2026-03-09T23:59:00.000Z').situacao).toBe('em_dia');
  });

  it('uma rodada perdida não acende o aviso: com 47 horas ainda está em dia', () => {
    expect(situacao(2026, '2026-03-08T07:00:00.000Z').situacao).toBe('em_dia');
  });

  it('com mais de duas janelas, está atrasado e diz desde quando', () => {
    expect(situacao(2026, '2026-03-07T06:00:00.000Z')).toEqual({
      situacao: 'atrasado',
      ultimaExtracao: '2026-03-07T06:00:00.000Z',
    });
  });

  it('exatamente duas janelas ainda está em dia', () => {
    expect(situacao(2026, '2026-03-08T06:00:00.000Z').situacao).toBe('em_dia');
  });
});

describe('situacaoDaAtualizacao — exercício anterior, periodicidade mensal', () => {
  it('dois dias sem extração não é atraso', () => {
    expect(situacao(2025, '2026-03-08T06:00:00.000Z').situacao).toBe('em_dia');
  });

  it('quase dois meses ainda está em dia', () => {
    expect(situacao(2025, '2026-01-10T06:00:00.000Z').situacao).toBe('em_dia');
  });

  it('mais de dois meses está atrasado', () => {
    expect(situacao(2025, '2026-01-01T06:00:00.000Z').situacao).toBe('atrasado');
  });
});

describe('situacaoDaAtualizacao — outros exercícios', () => {
  it('exercício antigo não tem rodada agendada: nunca fica atrasado', () => {
    expect(situacao(2024, '2025-01-01T06:00:00.000Z')).toEqual({
      situacao: 'historico',
      ultimaExtracao: '2025-01-01T06:00:00.000Z',
    });
  });

  it('sem nenhuma extração, a situação é sem dado, mesmo no exercício corrente', () => {
    expect(situacao(2026, null)).toEqual({ situacao: 'sem_dado', ultimaExtracao: null });
  });

  it('extração no futuro, por relógio adiantado, conta como em dia', () => {
    expect(situacao(2026, '2026-03-10T07:00:00.000Z').situacao).toBe('em_dia');
  });

  it('o exercício corrente vem do instante recebido, não do relógio do sistema', () => {
    const agoraEm2030 = new Date('2030-06-01T06:00:00.000Z');
    expect(situacaoDaAtualizacao(PERIODICIDADE, 2026, '2026-03-10T03:00:00.000Z', agoraEm2030).situacao).toBe(
      'historico',
    );
  });

  it('data inválida é recusada citando o valor', () => {
    expect(() => situacao(2026, 'ontem')).toThrow('ontem');
  });
});

describe('situacaoDaAtualizacao — dado anual', () => {
  const ANUAL: Periodicidade = { exercicioCorrente: 'anual', exercicioAnterior: 'anual' };

  it('com 13 meses desde a extração, está em dia: a fonte só publica uma vez por ano', () => {
    expect(situacaoDaAtualizacao(ANUAL, 2026, '2025-02-10T06:00:00.000Z', AGORA).situacao).toBe('em_dia');
  });

  it('com 25 meses desde a extração, está atrasado', () => {
    expect(situacaoDaAtualizacao(ANUAL, 2026, '2024-02-10T06:00:00.000Z', AGORA).situacao).toBe('atrasado');
  });
});
