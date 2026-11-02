// fetch falso nomeado: responde pelo caminho e deixa o teste decidir quando cada resposta chega.
import { vi } from 'vitest';

export class FetchFake {
  pedidos: string[] = [];
  /** Com `true`, as respostas ficam presas até `liberar(caminho)`. */
  segurar = false;
  private presas: { caminho: string; soltar: () => void }[] = [];
  private respostas = new Map<string, () => Response>();

  responder(caminho: string, corpo: unknown, status = 200) {
    this.respostas.set(caminho, () => new Response(JSON.stringify(corpo), { status }));
    return this;
  }

  responderTexto(caminho: string, texto: string, status: number) {
    this.respostas.set(caminho, () => new Response(texto, { status }));
    return this;
  }

  fetch = (caminho: string): Promise<Response> => {
    this.pedidos.push(caminho);
    return new Promise((resolve, reject) => {
      const soltar = () => {
        const resposta = this.respostas.get(caminho);
        if (resposta) resolve(resposta());
        else reject(new Error(`rede fora do ar: ${caminho}`));
      };
      if (this.segurar) this.presas.push({ caminho, soltar });
      else soltar();
    });
  };

  liberar(caminho: string) {
    const i = this.presas.findIndex((p) => p.caminho === caminho);
    this.presas.splice(i, 1)[0]?.soltar();
  }

  instalar() {
    vi.stubGlobal('fetch', this.fetch);
    return this;
  }
}
