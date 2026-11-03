import { describe, expect, it } from 'vitest';
import { IbgeClienteHttp } from '../src/cliente';

/** Transporte de mentira: devolve as respostas preparadas e guarda as URLs pedidas. */
class TransporteHttpFake {
  urls: string[] = [];
  constructor(private respostas: (Response | Error)[]) {}
  buscar = async (url: string | URL) => {
    this.urls.push(String(url));
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

const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200 });

function preparar(respostas: (Response | Error)[]) {
  const transporte = new TransporteHttpFake(respostas);
  const espera = new EsperaFake();
  return { transporte, espera, cliente: new IbgeClienteHttp(transporte.buscar, espera.esperar) };
}

const CONSULTA = { tabela: '6579', variaveis: ['9324'] };

describe('IbgeClienteHttp', () => {
  it('pede o município de Orleans, todos os períodos e as variáveis separadas por barra', async () => {
    const { cliente, transporte } = preparar([json([])]);

    await cliente.agregado({ tabela: '4714', variaveis: ['93', '6318'] });

    expect(transporte.urls).toEqual([
      'https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/all/variaveis/93|6318?localidades=N6[4211702]',
    ]);
  });

  it('localidades declaradas entram na URL no lugar do município', async () => {
    const { cliente, transporte } = preparar([json([])]);

    await cliente.agregado({ tabela: '4714', variaveis: ['614'], localidades: 'N1[all]|N3[42]' });

    expect(transporte.urls).toEqual([
      'https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/all/variaveis/614?localidades=N1[all]|N3[42]',
    ]);
  });

  it('classificação entra na URL como foi declarada', async () => {
    const { cliente, transporte } = preparar([json([])]);

    await cliente.agregado({ tabela: '9923', variaveis: ['93'], classificacao: '1[all]' });

    expect(transporte.urls[0]).toContain('&classificacao=1[all]');
  });

  it('429 repete com espera e devolve a resposta seguinte', async () => {
    const { cliente, transporte, espera } = preparar([new Response('', { status: 429 }), json([{ id: '9324' }])]);

    await expect(cliente.agregado(CONSULTA)).resolves.toEqual([{ id: '9324' }]);
    expect(transporte.urls).toHaveLength(2);
    expect(espera.pedidos).toEqual([2000]);
  });

  it('erro de rede repete com espera', async () => {
    const { cliente, espera } = preparar([new Error('rede caiu'), json([])]);

    await expect(cliente.agregado(CONSULTA)).resolves.toEqual([]);
    expect(espera.pedidos).toEqual([2000]);
  });

  it('404 não repete e lança citando o status e a tabela', async () => {
    const { cliente, transporte, espera } = preparar([new Response('', { status: 404 })]);

    await expect(cliente.agregado(CONSULTA)).rejects.toThrow('IBGE: HTTP 404 em /6579/periodos/all/variaveis/9324');
    expect(transporte.urls).toHaveLength(1);
    expect(espera.pedidos).toEqual([]);
  });

  it('500 insistente desiste na quarta tentativa', async () => {
    const respostas = [1, 2, 3, 4].map(() => new Response('', { status: 500 }));
    const { cliente, transporte } = preparar(respostas);

    await expect(cliente.agregado(CONSULTA)).rejects.toThrow('HTTP 500');
    expect(transporte.urls).toHaveLength(4);
  });
});
