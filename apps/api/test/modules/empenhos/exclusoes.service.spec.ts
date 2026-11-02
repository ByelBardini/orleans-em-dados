import { describe, expect, it } from 'vitest';
import { criarExclusoes, type ConferenciaParaExclusoes } from '../../../src/modules/empenhos/exclusoes.service';

const semPar = (id: string, campos: object = {}) => ({
  fonte: 'betha' as const,
  entidade: 'Prefeitura',
  codigoEntidade: '728',
  numero: 1,
  data: '2025-01-01',
  valor: 1,
  liquidado: 1,
  ocorrencia: 2,
  numeroNaOutra: null,
  id,
  nota: '',
  ...campos,
});

function preparar(respostas: ConferenciaParaExclusoes[]) {
  const pedidos: number[] = [];
  const relogio = { ms: 0 };
  const exclusoes = criarExclusoes(
    async (ano) => {
      pedidos.push(ano);
      return respostas.shift() ?? { disponivel: false };
    },
    () => relogio.ms,
  );
  return { exclusoes, pedidos, relogio };
}

describe('criarExclusoes', () => {
  it('devolve os ids que a conferência tira da soma', async () => {
    const { exclusoes } = preparar([
      { disponivel: true, empenhosSemPar: [semPar('repetido'), semPar('so-na-betha', { ocorrencia: 1 })] },
    ]);

    expect(await exclusoes(2025)).toEqual(['repetido']);
  });

  it('sem conferência disponível, nada sai da soma', async () => {
    const { exclusoes } = preparar([{ disponivel: false }]);

    expect(await exclusoes(2025)).toEqual([]);
  });

  it('dentro de cinco minutos reaproveita, porque a conferência roda várias consultas', async () => {
    const { exclusoes, pedidos, relogio } = preparar([{ disponivel: true, empenhosSemPar: [semPar('a')] }]);
    await exclusoes(2025);

    relogio.ms += 5 * 60_000 - 1;

    expect(await exclusoes(2025)).toEqual(['a']);
    expect(pedidos).toEqual([2025]);
  });

  it('passados cinco minutos, consulta de novo', async () => {
    const { exclusoes, relogio } = preparar([
      { disponivel: true, empenhosSemPar: [semPar('velho')] },
      { disponivel: true, empenhosSemPar: [semPar('novo')] },
    ]);
    await exclusoes(2025);

    relogio.ms += 5 * 60_000;

    expect(await exclusoes(2025)).toEqual(['novo']);
  });

  it('o cache é por exercício', async () => {
    const { exclusoes, pedidos } = preparar([
      { disponivel: true, empenhosSemPar: [semPar('a')] },
      { disponivel: true, empenhosSemPar: [semPar('b')] },
    ]);

    expect(await exclusoes(2025)).toEqual(['a']);
    expect(await exclusoes(2024)).toEqual(['b']);
    expect(pedidos).toEqual([2025, 2024]);
  });
});
