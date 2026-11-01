// Cliente mínimo da Qlik Engine JSON API (JSON-RPC sobre WebSocket), usado
// pelos painéis públicos do Farol TCE-SC. Sessão anônima; nada de cookies ou
// handles é persistido. Usa o WebSocket nativo do Node (>= 22).

import { TCESC } from './config.js';

const TIMEOUT_MS = 60_000;

export class QlikSessao {
  #ws;
  #seq = 0;
  #pendentes = new Map();
  #fechada = false;

  static async abrir(appId) {
    const s = new QlikSessao();
    await s.#conectar(appId);
    const doc = await s.chamar(-1, 'OpenDoc', [appId]);
    s.doc = doc.qReturn.qHandle;
    s.appId = appId;
    return s;
  }

  #conectar(appId) {
    return new Promise((resolve, reject) => {
      this.#ws = new WebSocket(`${TCESC.wsBase}/app/${appId}`, { headers: { Origin: TCESC.origin } });
      this.#ws.onopen = () => resolve();
      this.#ws.onerror = (e) => reject(new Error(`Qlik: falha na conexão (${e.message ?? 'erro'})`));
      this.#ws.onclose = () => {
        this.#fechada = true;
        for (const p of this.#pendentes.values()) p.reject(new Error('Qlik: conexão encerrada'));
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
        else p.resolve(m.result);
      };
    });
  }

  chamar(handle, method, params = []) {
    if (this.#fechada) return Promise.reject(new Error('Qlik: sessão encerrada'));
    const id = ++this.#seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pendentes.delete(id);
        reject(new Error(`Qlik ${method}: tempo esgotado`));
      }, TIMEOUT_MS);
      this.#pendentes.set(id, { resolve, reject, timer, method });
      this.#ws.send(JSON.stringify({ jsonrpc: '2.0', id, handle, method, params }));
    });
  }

  async criarObjeto(def) {
    const r = await this.chamar(this.doc, 'CreateSessionObject', [def]);
    return r.qReturn.qHandle;
  }

  async layout(handle) {
    return (await this.chamar(handle, 'GetLayout')).qLayout;
  }

  // Seleciona um valor pelo texto exato, usando o qElemNumber da própria sessão
  // (SelectValues por texto não restringiu o recorte nos testes do TCE).
  async selecionar(campo, texto) {
    const h = await this.criarObjeto({
      qInfo: { qType: 'ListObject' },
      qListObjectDef: { qDef: { qFieldDefs: [campo] }, qInitialDataFetch: [] },
    });
    const { qListObject } = await this.layout(h);
    const total = qListObject.qSize.qcy;
    let alvo = null;
    for (let topo = 0; topo < total && !alvo; topo += 5000) {
      const {
        qDataPages: [pagina],
      } = await this.chamar(h, 'GetListObjectData', [
        '/qListObjectDef',
        [{ qTop: topo, qLeft: 0, qHeight: 5000, qWidth: 1 }],
      ]);
      alvo = pagina.qMatrix.map((l) => l[0]).find((c) => c.qText === String(texto));
    }
    if (!alvo) throw new Error(`Qlik: valor "${texto}" não existe no campo ${campo}`);
    const r = await this.chamar(h, 'SelectListObjectValues', ['/qListObjectDef', [alvo.qElemNumber], false]);
    if (!r.qSuccess) throw new Error(`Qlik: seleção de ${campo}=${texto} recusada`);
  }

  async limparSelecoes() {
    await this.chamar(this.doc, 'ClearAll', [false]);
  }

  // Seleções ativas, conferidas no objeto de seleções (qSuccess não basta).
  async selecoes() {
    const h = await this.criarObjeto({ qInfo: { qType: 'SelectionObject' }, qSelectionObjectDef: {} });
    const { qSelectionObject } = await this.layout(h);
    return Object.fromEntries(
      qSelectionObject.qSelections.map((s) => [s.qField, s.qSelectedFieldSelectInfo?.map((v) => v.qName) ?? [s.qSelected]]),
    );
  }

  // Hipercubo de sessão com dimensões e medidas próprias, lido por páginas.
  // Devolve as células originais (qText/qNum) e o total geral calculado pelo motor.
  async hipercubo({ dimensoes, medidas, supressaoZero = false }) {
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
    const linhasTotal = qHyperCube.qSize.qcy;
    const altura = Math.max(1, Math.floor(10_000 / largura));
    const linhas = [];
    for (let topo = 0; topo < linhasTotal; topo += altura) {
      const {
        qDataPages: [pagina],
      } = await this.chamar(h, 'GetHyperCubeData', [
        '/qHyperCubeDef',
        [{ qTop: topo, qLeft: 0, qHeight: altura, qWidth: largura }],
      ]);
      linhas.push(...pagina.qMatrix);
    }
    return {
      linhasTotal,
      linhas,
      totais: qHyperCube.qGrandTotalRow.map((c) => ({ qText: c.qText, qNum: c.qNum })),
      dimensoes: qHyperCube.qDimensionInfo.map((d) => d.qFallbackTitle),
      medidas: qHyperCube.qMeasureInfo.map((m) => m.qFallbackTitle),
    };
  }

  // Metadados da carga do app: permite detectar recarga entre coletas.
  async infoApp() {
    const { qLayout } = await this.chamar(this.doc, 'GetAppLayout');
    return { titulo: qLayout.qTitle, ultimaRecarga: qLayout.qLastReloadTime ?? null };
  }

  fechar() {
    if (!this.#fechada) this.#ws.close();
  }
}
