import { describe, expect, it } from 'vitest';
import { QlikSessao, type SocketQlik } from '../src/sessao-qlik';

type Resposta = { result?: unknown; error?: { message: string } } | null;

/** WebSocket de mentira: responde cada chamada JSON-RPC pelo roteiro de métodos. */
class SocketFake implements SocketQlik {
  onopen: (() => void) | null = null;
  onerror: ((e: { message?: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  enviadas: { id: number; handle: number; method: string; params: unknown[] }[] = [];
  fechou = false;
  url = '';
  origem = '';

  constructor(private roteiro: Record<string, (params: unknown[], vez: number) => Resposta>) {
    setTimeout(() => this.onopen?.());
  }

  send(texto: string) {
    const mensagem = JSON.parse(texto);
    const vez = this.enviadas.filter((e) => e.method === mensagem.method).length;
    this.enviadas.push(mensagem);
    const responder = this.roteiro[mensagem.method];
    const resposta = responder ? responder(mensagem.params, vez) : { result: {} };
    if (resposta) setTimeout(() => this.onmessage?.({ data: JSON.stringify({ id: mensagem.id, ...resposta }) }));
  }

  close() {
    this.fechou = true;
    this.onclose?.();
  }
}

const ROTEIRO_BASE = {
  OpenDoc: () => ({ result: { qReturn: { qHandle: 1 } } }),
  CreateSessionObject: () => ({ result: { qReturn: { qHandle: 2 } } }),
};

async function abrir(roteiro: Record<string, (params: unknown[], vez: number) => Resposta>, tempoLimite?: number) {
  let socket!: SocketFake;
  const sessao = await QlikSessao.abrir(
    'app-1',
    (url, origem) => {
      socket = new SocketFake({ ...ROTEIRO_BASE, ...roteiro });
      socket.url = url;
      socket.origem = origem;
      return socket;
    },
    tempoLimite,
  );
  return { sessao, socket };
}

describe('QlikSessao.abrir', () => {
  it('conecta no app com a origem do painel e abre o documento', async () => {
    const { socket } = await abrir({});

    expect(socket.url).toBe('wss://paineistransparencia.tce.sc.gov.br/app/app-1');
    expect(socket.origem).toBe('https://paineistransparencia.tce.sc.gov.br');
    expect(socket.enviadas[0]).toMatchObject({ handle: -1, method: 'OpenDoc', params: ['app-1'] });
  });
});

describe('QlikSessao.chamar', () => {
  it('erro do motor rejeita citando o método e a mensagem', async () => {
    const { sessao } = await abrir({ GetLayout: () => ({ error: { message: 'objeto inválido' } }) });

    await expect(sessao.chamar(2, 'GetLayout')).rejects.toThrow('Qlik GetLayout: objeto inválido');
  });

  it('sem resposta dentro do prazo, rejeita citando o método', async () => {
    const { sessao } = await abrir({ GetLayout: () => null }, 5);

    await expect(sessao.chamar(2, 'GetLayout')).rejects.toThrow('Qlik GetLayout: tempo esgotado');
  });

  it('conexão que cai rejeita o que estava pendente', async () => {
    const { sessao, socket } = await abrir({ GetLayout: () => null });

    const pendente = sessao.chamar(2, 'GetLayout');
    socket.close();

    await expect(pendente).rejects.toThrow('Qlik: conexão encerrada');
  });

  it('depois de fechada, a sessão recusa novas chamadas', async () => {
    const { sessao } = await abrir({});

    sessao.fechar();

    await expect(sessao.chamar(2, 'GetLayout')).rejects.toThrow('Qlik: sessão encerrada');
  });
});

describe('QlikSessao.selecionar', () => {
  const lista = (...valores: [string, number][]) => ({
    GetLayout: () => ({ result: { qLayout: { qListObject: { qSize: { qcy: valores.length } } } } }),
    GetListObjectData: () => ({
      result: { qDataPages: [{ qMatrix: valores.map(([qText, qElemNumber]) => [{ qText, qElemNumber }]) }] },
    }),
    SelectListObjectValues: () => ({ result: { qSuccess: true } }),
  });

  it('seleciona pelo qElemNumber lido na sessão, não pelo texto', async () => {
    const { sessao, socket } = await abrir(lista(['ARAGUARI', 7], ['ORLEANS', 42]));

    await sessao.selecionar('nome_ente', 'ORLEANS');

    expect(socket.enviadas.find((e) => e.method === 'SelectListObjectValues')?.params).toEqual([
      '/qListObjectDef',
      [42],
      false,
    ]);
  });

  it('valor que não existe no campo é recusado citando os dois', async () => {
    const { sessao } = await abrir(lista(['ARAGUARI', 7]));

    await expect(sessao.selecionar('nome_ente', 'ORLEANS')).rejects.toThrow(
      'Qlik: valor "ORLEANS" não existe no campo nome_ente',
    );
  });

  it('seleção recusada pelo motor vira erro', async () => {
    const { sessao } = await abrir({
      ...lista(['ORLEANS', 42]),
      SelectListObjectValues: () => ({ result: { qSuccess: false } }),
    });

    await expect(sessao.selecionar('nome_ente', 'ORLEANS')).rejects.toThrow(
      'Qlik: seleção de nome_ente=ORLEANS recusada',
    );
  });
});

describe('QlikSessao.hipercubo', () => {
  const layout = (qcy: number, extras: object = {}) => ({
    result: {
      qLayout: {
        qHyperCube: {
          qSize: { qcy },
          qGrandTotalRow: [{ qText: '30', qNum: 30, descartado: true }],
          ...extras,
        },
      },
    },
  });

  it('lê por páginas até o total e devolve as linhas e os totais do motor', async () => {
    const paginas = [[[{ qText: 'a' }]], [[{ qText: 'b' }]]];
    const { sessao, socket } = await abrir({
      GetLayout: () => layout(5001),
      GetHyperCubeData: (_p, vez) => ({ result: { qDataPages: [{ qMatrix: paginas[vez] }] } }),
    });

    const cubo = await sessao.hipercubo({ dimensoes: ['d'], medidas: ['Sum(x)'] });

    expect(cubo.linhasTotal).toBe(5001);
    expect(cubo.linhas).toEqual([[{ qText: 'a' }], [{ qText: 'b' }]]);
    expect(cubo.totais).toEqual([{ qText: '30', qNum: 30 }]);
    const pedidos = socket.enviadas.filter((e) => e.method === 'GetHyperCubeData').map((e) => e.params[1]);
    expect(pedidos).toEqual([
      [{ qTop: 0, qLeft: 0, qHeight: 5000, qWidth: 2 }],
      [{ qTop: 5000, qLeft: 0, qHeight: 5000, qWidth: 2 }],
    ]);
  });

  it('erro de cálculo no cubo é recusado', async () => {
    const { sessao } = await abrir({ GetLayout: () => layout(0, { qError: { qErrorCode: 7005 } }) });

    await expect(sessao.hipercubo({ dimensoes: ['d'], medidas: ['Sum(x)'] })).rejects.toThrow('7005');
  });
});

describe('QlikSessao — metadados', () => {
  it('selecoes devolve os valores ativos por campo', async () => {
    const { sessao } = await abrir({
      GetLayout: () => ({
        result: {
          qLayout: {
            qSelectionObject: {
              qSelections: [
                { qField: 'nome_ente', qSelectedFieldSelectInfo: [{ qName: 'ORLEANS' }] },
                { qField: 'ano', qSelected: '2025' },
              ],
            },
          },
        },
      }),
    });

    expect(await sessao.selecoes()).toEqual({ nome_ente: ['ORLEANS'], ano: ['2025'] });
  });

  it('infoApp lê a última recarga, ou nulo se o app não informar', async () => {
    const { sessao } = await abrir({
      GetAppLayout: (_p, vez) => ({
        result: { qLayout: { qTitle: 'App', ...(vez === 0 ? { qLastReloadTime: '2025-03-01' } : {}) } },
      }),
    });

    expect(await sessao.infoApp()).toEqual({ titulo: 'App', ultimaRecarga: '2025-03-01' });
    expect(await sessao.infoApp()).toEqual({ titulo: 'App', ultimaRecarga: null });
  });
});
