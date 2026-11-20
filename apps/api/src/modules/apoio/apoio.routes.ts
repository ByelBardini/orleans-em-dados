// O Pix do apoio: os dados em JSON e o QR em SVG. Sem a config, as duas rotas são 404.
import { apoioSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';
import { responder } from '../../lib/borda';
import type { ConfigDoApoio } from './config';

/** Desenha o QR do texto e devolve o SVG; o teste troca por um falso. */
export type CodificadorDeQr = (texto: string) => Promise<string>;

// Correção M (até 15% do código ilegível) e margem de dois módulos: lê bem na tela e impresso.
export const codificarQrDeVerdade: CodificadorDeQr = (texto) =>
  QRCode.toString(texto, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });

// O QR só muda com a config, que só muda com a subida do processo.
const CACHE_DO_QR = 'public, max-age=86400';
const SEM_APOIO = { erro: 'Apoio não configurado' };

export function rotasDoApoio(config: ConfigDoApoio | null, codificar: CodificadorDeQr = codificarQrDeVerdade) {
  return async (app: FastifyInstance) => {
    // Desenhado uma vez, no registro das rotas.
    const svg = config ? await codificar(config.copiaECola) : null;

    app.get('/api/apoio', async (_request, reply) => {
      if (!config) return reply.code(404).send(SEM_APOIO);
      return responder(reply, apoioSchema, config);
    });

    app.get('/api/apoio/qrcode.svg', async (_request, reply) => {
      if (!svg) return reply.code(404).send(SEM_APOIO);
      return reply.header('Content-Type', 'image/svg+xml').header('Cache-Control', CACHE_DO_QR).send(svg);
    });
  };
}
