import { describe, expect, it } from 'vitest';
import { paginar, type ClienteDePaginacao } from '../src/paginacao';

const hit = (id: string) => ({ id, sourceAsMap: {} });

/** Devolve as páginas preparadas, por leitura completa, na ordem dos pedidos. */
class ClienteFake implements ClienteDePaginacao {
  offsets: number[] = [];
  constructor(private paginas: { totalHits: number; hits: ReturnType<typeof hit>[] }[]) {}
  async buscar(_consulta: number, _filtro: unknown, { offset }: { offset: number; limit: number }) {
    this.offsets.push(offset);
    const pagina = this.paginas.shift();
    if (!pagina) throw new Error('Sem página preparada');
    return pagina;
  }
}

function preparar(paginas: ConstructorParameters<typeof ClienteFake>[0]) {
  const cliente = new ClienteFake(paginas);
  const esperas: number[] = [];
  const opcoes = {
    limite: 2,
    pausaMs: 300,
    esperar: async (ms: number) => {
      esperas.push(ms);
    },
  };
  return { cliente, esperas, ler: () => paginar(cliente, 57153, {}, opcoes) };
}

describe('paginar', () => {
  it('lê página por página até o total, pedindo pelo que já tem', async () => {
    const { cliente, ler } = preparar([
      { totalHits: 3, hits: [hit('a'), hit('b')] },
      { totalHits: 3, hits: [hit('c')] },
    ]);

    const leitura = await ler();

    expect(cliente.offsets).toEqual([0, 2]);
    expect(leitura.hits.map((h) => h.id)).toEqual(['a', 'b', 'c']);
    expect(leitura).toMatchObject({ totalHits: 3, erros: [] });
  });

  it('pausa entre as páginas', async () => {
    const { esperas, ler } = preparar([
      { totalHits: 3, hits: [hit('a'), hit('b')] },
      { totalHits: 3, hits: [hit('c')] },
    ]);

    await ler();

    expect(esperas).toEqual([300]);
  });

  it('consulta vazia termina na primeira página', async () => {
    const { cliente, ler } = preparar([{ totalHits: 0, hits: [] }]);

    const leitura = await ler();

    expect(cliente.offsets).toEqual([0]);
    expect(leitura).toEqual({ totalHits: 0, hits: [], erros: [] });
  });

  it('página vazia antes do total não vira laço infinito e é reportada pela contagem', async () => {
    const vazia = { totalHits: 3, hits: [] };
    const primeira = { totalHits: 3, hits: [hit('a')] };
    const { ler } = preparar([primeira, vazia, primeira, vazia, primeira, vazia]);

    const leitura = await ler();

    expect(leitura.hits).toHaveLength(1);
    expect(leitura.totalHits).toBe(3);
  });

  it('total que muda no meio é erro citando os dois valores, depois de repetir a leitura', async () => {
    const leituraRuim = [
      { totalHits: 3, hits: [hit('a'), hit('b')] },
      { totalHits: 4, hits: [hit('c')] },
    ];
    const { ler, cliente } = preparar([...leituraRuim, ...leituraRuim, ...leituraRuim]);

    const leitura = await ler();

    expect(leitura.erros).toEqual(['totalHits mudou durante a coleta (3 → 4)']);
    expect(cliente.offsets).toEqual([0, 2, 0, 2, 0, 2]);
  });

  it('ids repetidos fazem repetir a leitura, e a leitura boa é a que fica', async () => {
    const { ler } = preparar([
      { totalHits: 2, hits: [hit('a'), hit('a')] },
      { totalHits: 2, hits: [hit('a'), hit('b')] },
    ]);

    const leitura = await ler();

    expect(leitura.hits.map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('entre as leituras repetidas espera cada vez mais', async () => {
    const { ler, esperas } = preparar([
      { totalHits: 2, hits: [hit('a'), hit('a')] },
      { totalHits: 2, hits: [hit('a'), hit('a')] },
      { totalHits: 2, hits: [hit('a'), hit('b')] },
    ]);

    await ler();

    expect(esperas).toEqual([2000, 4000]);
  });

  it('inconsistência que persiste entrega a última leitura, para o lote ser rejeitado', async () => {
    const ruim = { totalHits: 2, hits: [hit('a'), hit('a')] };
    const { ler, cliente } = preparar([ruim, ruim, ruim]);

    const leitura = await ler();

    expect(cliente.offsets).toHaveLength(3);
    expect(leitura.hits.map((h) => h.id)).toEqual(['a', 'a']);
  });
});
