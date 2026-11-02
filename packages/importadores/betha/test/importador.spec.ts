import { describe, expect, it } from 'vitest';
import { criarImportadorBetha } from '../src/importador';

class ClienteFake {
  filtros: unknown[] = [];
  constructor(
    private hits: { id: string; sourceAsMap: Record<string, unknown> }[],
    private totais: unknown[] = [],
  ) {}
  async buscar(_consulta: number, filtro: unknown) {
    this.filtros.push(filtro);
    return { totalHits: this.hits.length, hits: this.hits };
  }
  async totalizadores(_consulta: number, filtro: unknown) {
    this.filtros.push(filtro);
    return this.totais;
  }
}

const consulta = (chave: string, cliente: ClienteFake) => {
  const encontrada = criarImportadorBetha({ cliente }).consultas.find((c) => c.chave === chave);
  if (!encontrada) throw new Error(`Sem consulta ${chave}`);
  return encontrada;
};

describe('criarImportadorBetha', () => {
  it('declara as três consultas da Betha', () => {
    const { id, fonte, consultas } = criarImportadorBetha({ cliente: new ClienteFake([]) });

    expect({ id, fonte }).toEqual({ id: 'betha', fonte: 'betha' });
    expect(consultas.map((c) => [c.chave, c.id])).toEqual([
      ['receitas', 57153],
      ['empenhos', 57140],
      ['despesas', 57170],
    ]);
  });

  it('a rodada agendada atualiza o exercício corrente e o anterior, que aceita retificação', () => {
    const { anosDaRodada } = criarImportadorBetha({ cliente: new ClienteFake([]) });

    expect(anosDaRodada(new Date('2026-03-10T06:00:00.000Z'))).toEqual([2026, 2025]);
  });

  it.each([
    ['receitas', { ano: ['2025'] }],
    ['empenhos', { anoExercicio: ['2025'] }],
    ['despesas', { ano: ['2025'] }],
  ])('%s usa o próprio filtro de ano, nos registros e nos totalizadores', async (chave, filtro) => {
    const cliente = new ClienteFake([]);

    const coleta = await consulta(chave, cliente).coletar({ ano: 2025 });

    expect(coleta.filtro).toEqual(filtro);
    expect(cliente.filtros).toEqual([filtro, filtro]);
  });

  it('o registro bruto junta o id ao conteúdo de sourceAsMap', async () => {
    const cliente = new ClienteFake([{ id: '211:728:1', sourceAsMap: { valorEmpenho: 10 } }]);

    const coleta = await consulta('empenhos', cliente).coletar({ ano: 2025 });

    expect(coleta.registros).toEqual([{ id: '211:728:1', valorEmpenho: 10 }]);
  });

  it('a coleta conta os campos ausentes e leva os totalizadores para a validação', async () => {
    const totais = [{ campo: 'valorEmpenho', valor: 10 }];
    const cliente = new ClienteFake(
      [{ id: '1', sourceAsMap: { valorEmpenho: 10, valorLiquidadoEmpenho: null, valorPagoEmpenho: 0 } }],
      totais,
    );

    const coleta = await consulta('empenhos', cliente).coletar({ ano: 2025 });

    expect(coleta.camposAusentes).toEqual({ valorEmpenho: 0, valorLiquidadoEmpenho: 1, valorPagoEmpenho: 0 });
    expect(coleta.extras).toEqual({ totalizadores: totais });
  });

  it('receitas valida orçado atualizado e arrecadado, que têm totalizador', () => {
    const receitas = consulta('receitas', new ClienteFake([]));
    const coleta = { filtro: {}, totalHits: 0, registros: [], extras: { totalizadores: [] } };

    expect(receitas.validar(coleta, []).erros).toEqual([
      'totalizador ausente para valorOrcadoAtualizado',
      'totalizador ausente para valorArrecadadoNoMes',
    ]);
  });
});
