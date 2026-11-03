import { esperarDeVerdade, IBGE, type ConsultaDeAgregado, type TransporteHttp } from './config';
import type { RespostaDoAgregado } from './normalizar';

const MAX_TENTATIVAS = 4;

export interface ClienteIbge {
  agregado(consulta: ConsultaDeAgregado): Promise<RespostaDoAgregado>;
}

export class IbgeClienteHttp implements ClienteIbge {
  constructor(
    private readonly transporte: TransporteHttp = fetch,
    private readonly esperar: (ms: number) => Promise<void> = esperarDeVerdade,
  ) {}

  // Colchetes e barra vertical vão como a documentação da API mostra: sem codificar.
  agregado({
    tabela,
    variaveis,
    classificacao,
    localidades = `N6[${IBGE.municipio}]`,
  }: ConsultaDeAgregado): Promise<RespostaDoAgregado> {
    const filtro = classificacao ? `&classificacao=${classificacao}` : '';
    return this.#get(`/${tabela}/periodos/all/variaveis/${variaveis.join('|')}?localidades=${localidades}${filtro}`);
  }

  // Em 429/5xx e erro de rede, tenta novamente com espera exponencial; o resto é definitivo.
  async #get(caminho: string): Promise<RespostaDoAgregado> {
    for (let tentativa = 1; ; tentativa++) {
      let r: Response;
      try {
        r = await this.transporte(`${IBGE.api}${caminho}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(60_000),
        });
      } catch (err) {
        if (tentativa >= MAX_TENTATIVAS) throw err;
        await this.esperar(1000 * 2 ** tentativa);
        continue;
      }
      if (r.ok) return r.json() as Promise<RespostaDoAgregado>;
      if ((r.status === 429 || r.status >= 500) && tentativa < MAX_TENTATIVAS) {
        await this.esperar(1000 * 2 ** tentativa);
        continue;
      }
      throw new Error(`IBGE: HTTP ${r.status} em ${caminho.split('?')[0]}`);
    }
  }
}
