import { apoioSchema } from '@orleans-em-dados/contracts';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { criarApp } from '../../../src/app.js';
import { lerConfigDoApoio } from '../../../src/modules/apoio/config.js';

const CONFIG = lerConfigDoApoio({
  PIX_CHAVE: 'contato@exemplo.test',
  PIX_NOME: 'Fulano de Tal',
  PIX_CIDADE: 'Orleans',
});
// Conferido com um CRC calculado à parte, por tabela.
const COPIA_E_COLA =
  '00020126420014br.gov.bcb.pix0120contato@exemplo.test5204000053039865802BR5913Fulano de Tal6007ORLEANS' +
  '62070503***6304298A';

// O codificador de QR, sem desenhar: guarda o texto que recebeu e devolve um SVG marcado.
class CodificadorFake {
  textos: string[] = [];
  codificar = async (texto: string) => {
    this.textos.push(texto);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><!--qr falso--></svg>';
  };
}

const abertos: FastifyInstance[] = [];
const app = (...args: Parameters<typeof criarApp>) => {
  const criado = criarApp(...args);
  abertos.push(criado);
  return criado;
};
afterEach(async () => {
  while (abertos.length) await abertos.pop()?.close();
});

describe('GET /api/apoio', () => {
  it('com o Pix configurado, devolve a chave, o nome, a cidade e o copia e cola', async () => {
    const resposta = await app({}, { apoio: CONFIG, codificarQr: new CodificadorFake().codificar }).inject({
      method: 'GET',
      url: '/api/apoio',
    });

    expect(resposta.statusCode).toBe(200);
    expect(apoioSchema.parse(resposta.json())).toEqual({
      chave: 'contato@exemplo.test',
      nome: 'Fulano de Tal',
      cidade: 'ORLEANS',
      copiaECola: COPIA_E_COLA,
    });
  });

  it('sem o Pix configurado, 404 em JSON', async () => {
    const resposta = await app().inject({ method: 'GET', url: '/api/apoio' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'Apoio não configurado' });
  });

  it('fica fora dos buscadores, como o resto da API', async () => {
    const resposta = await app({}, { apoio: CONFIG, codificarQr: new CodificadorFake().codificar }).inject({
      method: 'GET',
      url: '/api/apoio',
    });

    expect(resposta.headers['x-robots-tag']).toBe('noindex, nofollow');
  });
});

describe('GET /api/apoio/qrcode.svg', () => {
  it('desenha o QR do copia e cola, em SVG com cache de um dia', async () => {
    const codificador = new CodificadorFake();

    const resposta = await app({}, { apoio: CONFIG, codificarQr: codificador.codificar }).inject({
      method: 'GET',
      url: '/api/apoio/qrcode.svg',
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toBe('image/svg+xml');
    expect(resposta.headers['cache-control']).toBe('public, max-age=86400');
    expect(resposta.body).toContain('<!--qr falso-->');
    expect(codificador.textos).toEqual([COPIA_E_COLA]);
  });

  it('o QR é desenhado uma vez só, e não a cada pedido', async () => {
    const codificador = new CodificadorFake();
    const servidor = app({}, { apoio: CONFIG, codificarQr: codificador.codificar });

    await servidor.inject({ method: 'GET', url: '/api/apoio/qrcode.svg' });
    await servidor.inject({ method: 'GET', url: '/api/apoio/qrcode.svg' });

    expect(codificador.textos).toHaveLength(1);
  });

  it('com o codificador de verdade, sai um SVG com viewBox', async () => {
    const resposta = await app({}, { apoio: CONFIG }).inject({ method: 'GET', url: '/api/apoio/qrcode.svg' });

    expect(resposta.body).toMatch(/^<svg[^>]*viewBox="0 0 \d+ \d+"/);
  });

  it('sem o Pix configurado, 404 em JSON, fora dos buscadores', async () => {
    const resposta = await app().inject({ method: 'GET', url: '/api/apoio/qrcode.svg' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'Apoio não configurado' });
    expect(resposta.headers['x-robots-tag']).toBe('noindex, nofollow');
  });
});
