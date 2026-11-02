import { describe, expect, it } from 'vitest';
import { BethaQueryClient } from '../src/cliente';
import { json, status, TransporteHttpFake } from './support/transporte-fake';

class AuthFake {
  tokens = ['token-1', 'token-2', 'token-3'];
  invalidacoes = 0;
  async getToken() {
    return this.tokens[this.invalidacoes] as string;
  }
  invalidar() {
    this.invalidacoes += 1;
  }
}

function preparar() {
  const transporte = new TransporteHttpFake();
  const auth = new AuthFake();
  const esperas: number[] = [];
  const esperar = async (ms: number) => {
    esperas.push(ms);
  };
  return { transporte, auth, esperas, cliente: new BethaQueryClient(auth, transporte.fetch, esperar) };
}

const cabecalhos = (init: RequestInit | undefined) => init?.headers as Record<string, string>;

describe('BethaQueryClient.buscar', () => {
  it('pagina ordenando por id, porque sem ordenação a paginação é instável', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(json({ totalHits: 0, hits: [] }));

    await cliente.buscar(57153, { ano: ['2025'] }, { offset: 100, limit: 50 });

    const url = new URL(transporte.requisicoes[0]?.url as string);
    expect(url.pathname).toBe('/transparencia/api/busca-textual/57153');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sortBy: 'id',
      sortDirection: 'asc',
      offset: '100',
      limit: '50',
      hiperlink: 'false',
    });
  });

  it('manda o filtro no corpo, o token e o contexto do portal nos cabeçalhos', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(json({ totalHits: 0, hits: [] }));

    await cliente.buscar(57153, { ano: ['2025'] });

    const { init } = transporte.requisicoes[0] as { init: RequestInit };
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"ano":["2025"]}');
    expect(cabecalhos(init).Authorization).toBe('Bearer token-1');
    expect(cabecalhos(init)['app-context']).toBeTruthy();
  });
});

describe('BethaQueryClient.totalizadores', () => {
  it('consulta o endpoint de totalizadores com o mesmo filtro', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(json([{ campo: 'valor', valor: 10 }]));

    const totais = await cliente.totalizadores(57140, { anoExercicio: ['2025'] });

    expect(new URL(transporte.requisicoes[0]?.url as string).pathname).toBe(
      '/transparencia/api/busca-textual/57140/totalizadores',
    );
    expect(transporte.requisicoes[0]?.init?.body).toBe('{"anoExercicio":["2025"]}');
    expect(totais).toEqual([{ campo: 'valor', valor: 10 }]);
  });
});

describe('BethaQueryClient — falhas', () => {
  it('401 renova o token e repete com o token novo', async () => {
    const { cliente, transporte, auth } = preparar();
    transporte.responder(status(401), json({ totalHits: 0, hits: [] }));

    await cliente.buscar(1, {});

    expect(auth.invalidacoes).toBe(1);
    expect(cabecalhos(transporte.requisicoes[1]?.init).Authorization).toBe('Bearer token-2');
  });

  it('401 de novo depois de renovar não renova uma segunda vez', async () => {
    const { cliente, transporte, auth } = preparar();
    transporte.responder(status(401), status(401));

    await expect(cliente.buscar(1, {})).rejects.toThrow('Betha: HTTP 401 em /transparencia/api/busca-textual/1');

    expect(auth.invalidacoes).toBe(1);
    expect(transporte.requisicoes).toHaveLength(2);
  });

  it.each([429, 500, 503])('%s tenta de novo com espera exponencial', async (codigo) => {
    const { cliente, transporte, esperas } = preparar();
    transporte.responder(status(codigo), status(codigo), json({ totalHits: 0, hits: [] }));

    await cliente.buscar(1, {});

    expect(esperas).toEqual([2000, 4000]);
  });

  it('desiste na quarta tentativa e cita o status, sem os parâmetros da URL', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(status(503), status(503), status(503), status(503));

    await expect(cliente.buscar(1, {})).rejects.toThrow(/^Betha: HTTP 503 em \/transparencia\/api\/busca-textual\/1$/);

    expect(transporte.requisicoes).toHaveLength(4);
  });

  it('erro de rede também tenta de novo', async () => {
    const { cliente, transporte, esperas } = preparar();
    transporte.responder(new Error('ECONNRESET'), json({ totalHits: 0, hits: [] }));

    await cliente.buscar(1, {});

    expect(esperas).toEqual([2000]);
  });

  it('erro de rede que persiste sobe na quarta tentativa', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(new Error('a'), new Error('b'), new Error('c'), new Error('d'));

    await expect(cliente.buscar(1, {})).rejects.toThrow('d');
  });

  it('404 não tenta de novo', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(status(404));

    await expect(cliente.buscar(1, {})).rejects.toThrow('Betha: HTTP 404');

    expect(transporte.requisicoes).toHaveLength(1);
  });
});
