import { describe, expect, it } from 'vitest';
import {
  seloAguardando,
  seloConferidoComBetha,
  seloConferidoComTce,
  seloDaDespesa,
  SELO_EXEMPLO,
  SELO_FONTE_UNICA,
} from '../src/selos';

describe('selo do nível da conferência', () => {
  it('exercício encerrado: conferido com o TCE-SC, sem data', () => {
    expect(seloConferidoComTce()).toEqual({ estado: 'confere', titulo: 'conferido com o TCE-SC' });
  });

  it('exercício parcial: conferido com o TCE-SC até o mês, por extenso', () => {
    expect(seloConferidoComTce(9).titulo).toBe('conferido com o TCE-SC até setembro');
  });

  it('despesa em curso: conferido com a Betha até DD/MM, com a fonte TCE-SC no motivo', () => {
    expect(seloConferidoComBetha('2026-09-30')).toEqual({
      estado: 'confere',
      titulo: 'conferido com a Betha até 30/09',
      motivo: 'Valores do TCE-SC.',
    });
  });

  it('fonte única tem estado próprio, sem parecer conferido', () => {
    expect(SELO_FONTE_UNICA).toEqual({ estado: 'fonte-unica', titulo: 'fonte única, sem conferência' });
  });

  it('aguardando é pendência, com o motivo dado por quem chama', () => {
    expect(seloAguardando('Outubro ainda não chegou ao TCE-SC.')).toEqual({
      estado: 'pendente',
      titulo: 'aguardando TCE',
      motivo: 'Outubro ainda não chegou ao TCE-SC.',
    });
  });

  it('despesa encerrada é conferida com o TCE-SC; em curso, com a Betha até o corte', () => {
    const limites = { dataEmpenho: '2026-09-30' };
    expect(seloDaDespesa({ parcial: false, limites }).titulo).toBe('conferido com o TCE-SC');
    expect(seloDaDespesa({ parcial: true, limites }).titulo).toBe('conferido com a Betha até 30/09');
  });

  it('dado de exemplo não se diz conferido', () => {
    expect(SELO_EXEMPLO).toEqual({ estado: 'pendente', titulo: 'dados fictícios, sem conferência' });
  });

  it('nenhum selo de nível usa termo proibido', () => {
    const texto = JSON.stringify([
      seloConferidoComTce(),
      seloConferidoComTce(9),
      seloConferidoComBetha('2026-09-30'),
      SELO_FONTE_UNICA,
      SELO_EXEMPLO,
      seloAguardando(),
    ]);
    expect(texto).not.toMatch(/validad|irregular|fraude|\berros?\b|fantasma/i);
  });
});
