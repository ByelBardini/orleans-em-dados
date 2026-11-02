// Cliente mínimo da Qlik Engine JSON API (JSON-RPC sobre WebSocket), usado
// pelos painéis públicos do Farol TCE-SC. Sessão anônima; nada de cookies ou
// handles é persistido. Usa o WebSocket nativo do Node (>= 22).
import type { CelulaQlik } from './celulas';
import { TCESC } from './config';

const TIMEOUT_MS = 60_000;

export type CuboQlik = { linhasTotal: number; linhas: CelulaQlik[][]; totais: CelulaQlik[] };

/** O que o importador usa do motor; o spec do importador entra com um fake. */
export interface SessaoQlik {
  limparSelecoes(): Promise<void>;
  selecionar(campo: string, texto: string): Promise<void>;
  selecoes(): Promise<Record<string, string[]>>;
  hipercubo(definicao: { dimensoes: string[]; medidas: string[]; supressaoZero?: boolean }): Promise<CuboQlik>;
  infoApp(): Promise<{ titulo: string; ultimaRecarga: string | null }>;
  fechar(): void;
}

export interface SocketQlik {
  onopen: (() => void) | null;
  onerror: ((e: { message?: string }) => void) | null;
  onclose: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  send(texto: string): void;
  close(): void;
}

type CriarSocket = (url: string, origem: string) => SocketQlik;

// O WebSocket do Node aceita cabeçalhos no segundo argumento; o tipo do DOM não sabe disso.
const socketDeVerdade: CriarSocket = (url, origem) =>
  new WebSocket(url, { headers: { Origin: origem } } as never) as unknown as SocketQlik;

type Pendente = {
  resolve: (r: never) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  method: string;
};

export class QlikSessao implements SessaoQlik {
  #ws!: SocketQlik;
  #seq = 0;
  #pendentes = new Map<number, Pendente>();
  #fechada = false;
  #doc = 0;
  #tempoLimite: number;

  private constructor(tempoLimite: number) {
    this.#tempoLimite = tempoLimite;
  }

  static async abrir(appId: string, criarSocket: CriarSocket = socketDeVerdade, tempoLimite = TIMEOUT_MS) {
    const s = new QlikSessao(tempoLimite);
    await s.#conectar(appId, criarSocket);
    const doc = await s.chamar<{ qReturn: { qHandle: number } }>(-1, 'OpenDoc', [appId]);
    s.#doc = doc.qReturn.qHandle;
    return s;
  }

  #conectar(appId: string, criarSocket: CriarSocket) {
    return new Promise<void>((resolve, reject) => {
      this.#ws = criarSocket(`${TCESC.wsBase}/app/${appId}`, TCESC.origin);
      this.#ws.onopen = () => resolve();
      this.#ws.onerror = (e) => reject(new Error(`Qlik: falha na conexão (${e.message ?? 'erro'})`));
      this.#ws.onclose = () => {
        this.#fechada = true;
        for (const p of this.#pendentes.values()) {
          clearTimeout(p.timer);
          p.reject(new Error('Qlik: conexão encerrada'));
        }
        this.#pendentes.clear();
      };
      // Eventos (OnConnected, OnAuthenticationInformation) não têm id: são ignorados.
      this.#ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        const p = m.id !== undefined && this.#pendentes.get(m.id);
        if (!p) return;
        this.#pendentes.delete(m.id);
        clearTimeout(p.timer);
        if (m.error) p.reject(new Error(`Qlik ${p.method}: ${m.error.message ?? JSON.stringify(m.error)}`));
        else p.resolve(m.result as never);
      };
    });
  }

  chamar<T = unknown>(handle: number, method: string, params: unknown[] = []): Promise<T> {
    if (this.#fechada) return Promise.reject(new Error('Qlik: sessão encerrada'));
    const id = ++this.#seq;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pendentes.delete(id);
        reject(new Error(`Qlik ${method}: tempo esgotado`));
      }, this.#tempoLimite);
      this.#pendentes.set(id, { resolve: resolve as (r: never) => void, reject, timer, method });
      this.#ws.send(JSON.stringify({ jsonrpc: '2.0', id, handle, method, params }));
    });
  }

  private async criarObjeto(def: unknown): Promise<number> {
    const r = await this.chamar<{ qReturn: { qHandle: number } }>(this.#doc, 'CreateSessionObject', [def]);
    return r.qReturn.qHandle;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- layout varia por objeto
  private async layout(handle: number): Promise<any> {
    return (await this.chamar<{ qLayout: unknown }>(handle, 'GetLayout')).qLayout;
  }

  // Seleciona um valor pelo texto exato, usando o qElemNumber da própria sessão
  // (SelectValues por texto não restringiu o recorte nos testes do TCE).
  async selecionar(campo: string, texto: string): Promise<void> {
    const h = await this.criarObjeto({
      qInfo: { qType: 'ListObject' },
      qListObjectDef: { qDef: { qFieldDefs: [campo] }, qInitialDataFetch: [] },
    });
    const { qListObject } = await this.layout(h);
    const total: number = qListObject.qSize.qcy;
    let alvo: { qText: string; qElemNumber: number } | undefined;
    for (let topo = 0; topo < total && !alvo; topo += 5000) {
      const { qDataPages } = await this.chamar<{
        qDataPages: { qMatrix: { qText: string; qElemNumber: number }[][] }[];
      }>(h, 'GetListObjectData', ['/qListObjectDef', [{ qTop: topo, qLeft: 0, qHeight: 5000, qWidth: 1 }]]);
      alvo = qDataPages[0]?.qMatrix.map((l) => l[0]!).find((c) => c.qText === String(texto));
    }
    if (!alvo) throw new Error(`Qlik: valor "${texto}" não existe no campo ${campo}`);
    const r = await this.chamar<{ qSuccess: boolean }>(h, 'SelectListObjectValues', [
      '/qListObjectDef',
      [alvo.qElemNumber],
      false,
    ]);
    if (!r.qSuccess) throw new Error(`Qlik: seleção de ${campo}=${texto} recusada`);
  }

  async limparSelecoes(): Promise<void> {
    await this.chamar(this.#doc, 'ClearAll', [false]);
  }

  // Seleções ativas, conferidas no objeto de seleções (qSuccess não basta).
  async selecoes(): Promise<Record<string, string[]>> {
    const h = await this.criarObjeto({ qInfo: { qType: 'SelectionObject' }, qSelectionObjectDef: {} });
    const { qSelectionObject } = await this.layout(h);
    return Object.fromEntries(
      (
        qSelectionObject.qSelections as {
          qField: string;
          qSelected?: string;
          qSelectedFieldSelectInfo?: { qName: string }[];
        }[]
      ).map((s) => [s.qField, s.qSelectedFieldSelectInfo?.map((v) => v.qName) ?? [s.qSelected as string]]),
    );
  }

  // Hipercubo de sessão com dimensões e medidas próprias, lido por páginas.
  // Devolve as células originais (qText/qNum) e o total geral calculado pelo motor.
  async hipercubo({
    dimensoes,
    medidas,
    supressaoZero = false,
  }: {
    dimensoes: string[];
    medidas: string[];
    supressaoZero?: boolean;
  }): Promise<CuboQlik> {
    const largura = dimensoes.length + medidas.length;
    const h = await this.criarObjeto({
      qInfo: { qType: 'HyperCube' },
      qHyperCubeDef: {
        qDimensions: dimensoes.map((d) => ({ qDef: { qFieldDefs: [d] }, qNullSuppression: false })),
        qMeasures: medidas.map((m) => ({ qDef: { qDef: m } })),
        qSuppressZero: supressaoZero,
        qSuppressMissing: false,
        qInitialDataFetch: [],
      },
    });
    const { qHyperCube } = await this.layout(h);
    if (qHyperCube.qError) throw new Error(`Qlik: erro no hipercubo (${JSON.stringify(qHyperCube.qError)})`);
    const linhasTotal: number = qHyperCube.qSize.qcy;
    const altura = Math.max(1, Math.floor(10_000 / largura));
    const linhas: CelulaQlik[][] = [];
    for (let topo = 0; topo < linhasTotal; topo += altura) {
      const { qDataPages } = await this.chamar<{ qDataPages: { qMatrix: CelulaQlik[][] }[] }>(h, 'GetHyperCubeData', [
        '/qHyperCubeDef',
        [{ qTop: topo, qLeft: 0, qHeight: altura, qWidth: largura }],
      ]);
      linhas.push(...(qDataPages[0]?.qMatrix ?? []));
    }
    return {
      linhasTotal,
      linhas,
      totais: (qHyperCube.qGrandTotalRow as CelulaQlik[]).map((c) => ({ qText: c.qText, qNum: c.qNum })),
    };
  }

  // Metadados da carga do app: permite detectar recarga entre coletas.
  async infoApp() {
    const { qLayout } = await this.chamar<{ qLayout: { qTitle: string; qLastReloadTime?: string } }>(
      this.#doc,
      'GetAppLayout',
    );
    return { titulo: qLayout.qTitle, ultimaRecarga: qLayout.qLastReloadTime ?? null };
  }

  fechar(): void {
    if (!this.#fechada) this.#ws.close();
  }
}
