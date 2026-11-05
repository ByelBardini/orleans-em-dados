import { describe, expect, it } from 'vitest';
import { SiconfiClienteHttp } from '../src/cliente';

/** Transporte de mentira: devolve as respostas preparadas e guarda as URLs pedidas. */
class TransporteHttpFake {
  urls: URL[] = [];
  constructor(private respostas: (Response | Error)[]) {}
  buscar = async (url: string | URL) => {
    this.urls.push(new URL(String(url)));
    const resposta = this.respostas.shift();
    if (!resposta) throw new Error('sem resposta preparada');
    if (resposta instanceof Error) throw resposta;
    return resposta;
  };
}

/** Espera que não espera: guarda quanto foi pedido. */
class EsperaFake {
  pedidos: number[] = [];
  esperar = async (ms: number) => {
    this.pedidos.push(ms);
  };
}

const pagina = (items: unknown[], hasMore = false) => new Response(JSON.stringify({ items, hasMore }), { status: 200 });

function preparar(respostas: (Response | Error)[]) {
  const transporte = new TransporteHttpFake(respostas);
  const espera = new EsperaFake();
  return { transporte, espera, cliente: new SiconfiClienteHttp(transporte.buscar, espera.esperar) };
}

describe('SiconfiClienteHttp', () => {
  it('pede o Anexo I-E de Orleans no exercício', async () => {
    const { cliente, transporte } = preparar([pagina([])]);

    await cliente.anexo(2025);

    const url = transporte.urls[0]!;
    expect(url.origin + url.pathname).toBe('https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      an_exercicio: '2025',
      no_anexo: 'DCA-Anexo I-E',
      id_ente: '4211702',
      offset: '0',
    });
  });

  it('`hasMore` verdadeiro busca a página seguinte e junta os itens na ordem', async () => {
    const { cliente, transporte } = preparar([
      pagina([{ conta: 'a' }, { conta: 'b' }], true),
      pagina([{ conta: 'c' }]),
    ]);

    const itens = await cliente.anexo(2025);

    expect(itens).toEqual([{ conta: 'a' }, { conta: 'b' }, { conta: 'c' }]);
    expect(transporte.urls.map((u) => u.searchParams.get('offset'))).toEqual(['0', '2']);
  });

  it('página vazia com `hasMore` lança, em vez de repetir para sempre', async () => {
    const { cliente } = preparar([pagina([], true)]);

    await expect(cliente.anexo(2025)).rejects.toThrow('página vazia');
  });

  it('429 repete com espera', async () => {
    const { cliente, espera } = preparar([new Response('', { status: 429 }), pagina([{ conta: 'a' }])]);

    await expect(cliente.anexo(2025)).resolves.toEqual([{ conta: 'a' }]);
    expect(espera.pedidos).toEqual([2000]);
  });

  it('erro de rede repete com espera', async () => {
    const { cliente, espera } = preparar([new Error('rede caiu'), pagina([])]);

    await expect(cliente.anexo(2025)).resolves.toEqual([]);
    expect(espera.pedidos).toEqual([2000]);
  });

  it('404 não repete e lança citando o status', async () => {
    const { cliente, transporte } = preparar([new Response('', { status: 404 })]);

    await expect(cliente.anexo(2025)).rejects.toThrow('SICONFI: HTTP 404');
    expect(transporte.urls).toHaveLength(1);
  });

  it('pede o RREO Anexo 14 de Orleans, no último bimestre do exercício', async () => {
    const { cliente, transporte } = preparar([pagina([])]);

    await cliente.rreo(2025);

    const url = transporte.urls[0]!;
    expect(url.origin + url.pathname).toBe('https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      an_exercicio: '2025',
      nr_periodo: '6',
      co_tipo_demonstrativo: 'RREO',
      no_anexo: 'RREO-Anexo 14',
      id_ente: '4211702',
      offset: '0',
    });
  });

  it('o RREO segue `hasMore` e junta os itens na ordem', async () => {
    const { cliente, transporte } = preparar([
      pagina([{ conta: 'a' }, { conta: 'b' }], true),
      pagina([{ conta: 'c' }]),
    ]);

    const itens = await cliente.rreo(2025);

    expect(itens).toEqual([{ conta: 'a' }, { conta: 'b' }, { conta: 'c' }]);
    expect(transporte.urls.map((u) => u.searchParams.get('offset'))).toEqual(['0', '2']);
    expect(transporte.urls.map((u) => u.searchParams.get('nr_periodo'))).toEqual(['6', '6']);
  });

  it('o RREO repete 5xx com espera', async () => {
    const { cliente, espera } = preparar([new Response('', { status: 503 }), pagina([{ conta: 'a' }])]);

    await expect(cliente.rreo(2025)).resolves.toEqual([{ conta: 'a' }]);
    expect(espera.pedidos).toEqual([2000]);
  });

  it('o RREO com página vazia e `hasMore` lança', async () => {
    const { cliente } = preparar([pagina([], true)]);

    await expect(cliente.rreo(2025)).rejects.toThrow('página vazia');
  });
});
