import { describe, expect, it } from 'vitest';
import {
  seloAguardando,
  seloConferidoComBetha,
  seloConferidoComTce,
  seloDaDespesa,
  seloDaSituacao,
  seloPorAnos,
  SELO_EXEMPLO,
  SELO_FONTE_UNICA,
} from '../src/selos';

// O selo de um bloco com anos (ou termos) em estados diferentes: o título diz o que é conferido, o motivo diz o resto.
describe('selo do bloco por anos', () => {
  const PORTAL = 'o Portal da Transparência';

  it('anos conferidos vão para o título, e o resto do bloco é fonte única no motivo', () => {
    expect(seloPorAnos(PORTAL, [{ anos: [2023, 2024, 2025], conferidos: [2024, 2025] }])).toEqual({
      estado: 'confere',
      titulo: 'conferido com o Portal da Transparência em 2024 e 2025',
      motivo: 'Demais anos: fonte única.',
    });
  });

  it('com todos os anos conferidos, o título diz todos e não há motivo', () => {
    expect(seloPorAnos(PORTAL, [{ anos: [2024, 2025], conferidos: [2024, 2025] }])).toEqual({
      estado: 'confere',
      titulo: 'conferido com o Portal da Transparência em 2024 e 2025',
    });
  });

  it('sem ano conferido, o bloco é fonte única', () => {
    expect(seloPorAnos(PORTAL, [{ anos: [2023, 2024], conferidos: [] }])).toBe(SELO_FONTE_UNICA);
  });

  it('sem ano nenhum, o bloco é fonte única', () => {
    expect(seloPorAnos(PORTAL, [{ anos: [], conferidos: [] }])).toBe(SELO_FONTE_UNICA);
  });

  it('termos com nome: o título diz cada um com os próprios anos, e o termo de fora vai ao motivo', () => {
    expect(
      seloPorAnos(
        'o TCE-SC',
        [
          { nome: 'recebido', anos: [2023, 2024, 2025], conferidos: [2023, 2024, 2025] },
          { nome: 'contribuição', anos: [2023, 2024, 2025], conferidos: [2024, 2025] },
        ],
        ['resultado oficial'],
      ),
    ).toEqual({
      estado: 'confere',
      titulo: 'recebido conferido com o TCE-SC em 2023, 2024 e 2025; contribuição em 2024 e 2025',
      motivo: 'Contribuição, nos demais anos: fonte única. Resultado oficial: fonte única.',
    });
  });

  it('termo com nome sem ano conferido sai do título e vai inteiro ao motivo', () => {
    expect(
      seloPorAnos('o TCE-SC', [
        { nome: 'recebido', anos: [2024, 2025], conferidos: [2024, 2025] },
        { nome: 'contribuição', anos: [2024, 2025], conferidos: [] },
      ]),
    ).toEqual({
      estado: 'confere',
      titulo: 'recebido conferido com o TCE-SC em 2024 e 2025',
      motivo: 'Contribuição: fonte única.',
    });
  });

  it('o título diz "conferido com", nunca "validado"', () => {
    const { titulo } = seloPorAnos(PORTAL, [{ anos: [2025], conferidos: [2025] }]);
    expect(titulo).toBe('conferido com o Portal da Transparência em 2025');
    expect(titulo).not.toMatch(/validad/i);
  });
});

describe('selo do nível da conferência', () => {
  it('exercício encerrado: conferido com o TCE-SC, sem data', () => {
    expect(seloConferidoComTce()).toEqual({ estado: 'confere', titulo: 'conferido com o TCE-SC' });
  });

  it('exercício parcial: conferido com o TCE-SC até o mês, por extenso', () => {
    expect(seloConferidoComTce(9).titulo).toBe('conferido com o TCE-SC até setembro');
  });

  it('despesa em curso: conferido com o Portal da Transparência até DD/MM, com a fonte TCE-SC no motivo', () => {
    expect(seloConferidoComBetha('2026-09-30')).toEqual({
      estado: 'confere',
      titulo: 'conferido com o Portal da Transparência até 30/09',
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

  it('despesa encerrada é conferida com o TCE-SC; em curso, com o Portal da Transparência até o corte', () => {
    const limites = { dataEmpenho: '2026-09-30' };
    expect(seloDaDespesa({ parcial: false, limites }).titulo).toBe('conferido com o TCE-SC');
    expect(seloDaDespesa({ parcial: true, limites }).titulo).toBe('conferido com o Portal da Transparência até 30/09');
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

describe('selo da situação de um caso', () => {
  it('confirmado no portal diz a data da conferência', () => {
    expect(seloDaSituacao('confirmada_no_portal', '2026-11-01')).toEqual({
      estado: 'confere',
      titulo: 'Confirmado no portal em 01/11/2026',
    });
  });

  it('confirmado em parte não leva o selo de confirmado, mesmo com data', () => {
    expect(seloDaSituacao('confirmada_em_parte', '2026-11-01')).toEqual({
      estado: 'pendente',
      titulo: 'Confirmado em parte',
    });
  });

  it('calculado diz que é provável', () => {
    expect(seloDaSituacao('calculada').titulo).toBe('Calculado (provável)');
  });

  it('valor que mudou depois da conferência é "Rever", e não confirmado', () => {
    expect(seloDaSituacao('rever', '2026-11-01')).toEqual({ estado: 'pendente', titulo: 'Rever' });
  });
});
