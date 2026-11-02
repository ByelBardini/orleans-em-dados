// HTTP falso nomeado: entrega as respostas na ordem e guarda cada requisição.
export type RequisicaoGuardada = { url: string; init: RequestInit | undefined };

export class TransporteHttpFake {
  requisicoes: RequisicaoGuardada[] = [];
  private respostas: (Response | Error)[] = [];

  responder(...respostas: (Response | Error)[]) {
    this.respostas.push(...respostas);
    return this;
  }

  fetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    this.requisicoes.push({ url: String(url), init });
    const resposta = this.respostas.shift();
    if (!resposta) throw new Error(`Sem resposta preparada para ${String(url)}`);
    if (resposta instanceof Error) throw resposta;
    return resposta;
  };
}

export const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

export const status = (codigo: number) => new Response('', { status: codigo });

export const redirecionamento = (location: string | null, codigo = 303) =>
  new Response(null, { status: codigo, headers: location ? { location } : {} });

export const tokenNoHash = (token = 'abc123', expiraEm = 3600) =>
  redirecionamento(`https://transparencia.betha.cloud/auth-callback.html#access_token=${token}&expires_in=${expiraEm}`);

/** Registro as the Betha API returns it. */
export const hit = (id: string, campos: Record<string, unknown> = {}) => ({ id, sourceAsMap: campos });

export const pagina = (totalHits: number, ...hits: ReturnType<typeof hit>[]) => json({ totalHits, hits });
