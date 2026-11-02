import { describe, expect, it } from 'vitest';
import { BethaAuthClient } from '../src/auth';
import { json, redirecionamento, status, tokenNoHash, TransporteHttpFake } from './support/transporte-fake';

function preparar(agora = { ms: 1_000_000 }) {
  const transporte = new TransporteHttpFake();
  return { transporte, agora, cliente: new BethaAuthClient(transporte.fetch, () => agora.ms) };
}

describe('BethaAuthClient', () => {
  it('lê o token do hash do redirecionamento 303', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(tokenNoHash('abc123'));

    expect(await cliente.getToken()).toBe('abc123');
  });

  it('pede o acesso anônimo sem seguir o redirecionamento', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(tokenNoHash());

    await cliente.getToken();

    const [{ url, init }] = transporte.requisicoes as [{ url: string; init: RequestInit }];
    expect(new URL(url).searchParams.get('access_mode')).toBe('anonymous');
    expect(new URL(url).searchParams.get('scope')).toBe('transparencia.public');
    expect(init.redirect).toBe('manual');
  });

  it('token válido é reaproveitado, sem pedir outro', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(tokenNoHash('abc123'));

    await cliente.getToken();
    await cliente.getToken();

    expect(transporte.requisicoes).toHaveLength(1);
  });

  it('a menos de um minuto de expirar, pede token novo', async () => {
    const agora = { ms: 1_000_000 };
    const { cliente, transporte } = preparar(agora);
    transporte.responder(tokenNoHash('velho', 3600), tokenNoHash('novo', 3600));
    await cliente.getToken();

    agora.ms += 3600_000 - 59_000;

    expect(await cliente.getToken()).toBe('novo');
  });

  it('com mais de um minuto de folga, mantém o token', async () => {
    const agora = { ms: 1_000_000 };
    const { cliente, transporte } = preparar(agora);
    transporte.responder(tokenNoHash('velho', 3600));
    await cliente.getToken();

    agora.ms += 3600_000 - 61_000;

    expect(await cliente.getToken()).toBe('velho');
  });

  it('invalidar obriga a pedir token novo', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(tokenNoHash('velho'), tokenNoHash('novo'));
    await cliente.getToken();

    cliente.invalidar();

    expect(await cliente.getToken()).toBe('novo');
  });

  it('resposta diferente de 303 é recusada citando o status', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(status(500));

    await expect(cliente.getToken()).rejects.toThrow('OAuth: HTTP 500');
  });

  it('303 sem Location é recusado', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(redirecionamento(null));

    await expect(cliente.getToken()).rejects.toThrow('OAuth: resposta sem Location');
  });

  it('redirecionamento para outro destino é recusado, mesmo trazendo token', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(redirecionamento('https://atacante.example/auth-callback.html#access_token=x&expires_in=60'));

    await expect(cliente.getToken()).rejects.toThrow('OAuth: destino de redirecionamento inesperado');
  });

  it.each([
    ['sem token', 'expires_in=3600'],
    ['sem validade', 'access_token=abc'],
    ['validade não positiva', 'access_token=abc&expires_in=0'],
  ])('resposta %s é recusada', async (_caso, hash) => {
    const { cliente, transporte } = preparar();
    transporte.responder(redirecionamento(`https://transparencia.betha.cloud/auth-callback.html#${hash}`));

    await expect(cliente.getToken()).rejects.toThrow('OAuth: credencial inválida na resposta');
  });

  it('o erro não carrega o token', async () => {
    const { cliente, transporte } = preparar();
    transporte.responder(json({ token: 'segredo' }, 500));

    await expect(cliente.getToken()).rejects.not.toThrow('segredo');
  });
});
