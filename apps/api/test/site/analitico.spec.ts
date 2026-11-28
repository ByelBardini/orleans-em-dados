import { describe, expect, it } from 'vitest';
import { scriptDoAnalitico, tokenDoAnalitico } from '../../src/site/analitico.js';

// O aviso da subida, sem console: guarda cada motivo que recebeu.
class AvisosFake {
  motivos: string[] = [];
  avisar = (motivo: string) => {
    this.motivos.push(motivo);
  };
}

const TOKEN = '0123456789abcdef0123456789abcdef';

describe('tokenDoAnalitico', () => {
  it('token hexadecimal de 32 caracteres liga o contador, sem aviso', () => {
    const avisos = new AvisosFake();

    expect(tokenDoAnalitico(TOKEN, avisos.avisar)).toBe('0123456789abcdef0123456789abcdef');
    expect(avisos.motivos).toEqual([]);
  });

  it('espaços em volta e letras maiúsculas saem, e o token vale igual', () => {
    const avisos = new AvisosFake();

    expect(tokenDoAnalitico('  0123456789ABCDEF0123456789ABCDEF  ', avisos.avisar)).toBe(
      '0123456789abcdef0123456789abcdef',
    );
    expect(avisos.motivos).toEqual([]);
  });

  it.each([
    ['ausente', undefined],
    ['só com espaços', '   '],
  ])('variável %s deixa o contador desligado, calado', (_caso, valor) => {
    const avisos = new AvisosFake();

    expect(tokenDoAnalitico(valor, avisos.avisar)).toBeUndefined();
    expect(avisos.motivos).toEqual([]);
  });

  it.each([
    ['com aspas e tag', 'abc"><script>'],
    ['com 31 caracteres', '0123456789abcdef0123456789abcde'],
    ['com 33 caracteres', '0123456789abcdef0123456789abcdef0'],
    ['com letra fora do hexadecimal', '0123456789abcdef0123456789abcdeg'],
  ])('token %s desliga o contador e avisa, nomeando a variável', (_caso, valor) => {
    const avisos = new AvisosFake();

    expect(tokenDoAnalitico(valor, avisos.avisar)).toBeUndefined();
    expect(avisos.motivos).toEqual([
      'contador de acessos desligado: CLOUDFLARE_ANALYTICS_TOKEN inválido (esperado 32 caracteres hexadecimais)',
    ]);
  });
});

describe('scriptDoAnalitico', () => {
  // O atributo vai entre aspas duplas, com o JSON escapado: o navegador desescapa e o beacon lê o token.
  it('a tag carrega o beacon do Cloudflare sem bloquear a página e leva o token no data-cf-beacon', () => {
    expect(scriptDoAnalitico(TOKEN)).toBe(
      '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" ' +
        'data-cf-beacon="{&quot;token&quot;:&quot;0123456789abcdef0123456789abcdef&quot;}"></script>',
    );
  });
});
