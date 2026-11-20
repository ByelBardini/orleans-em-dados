import { describe, expect, it } from 'vitest';
import { apoioDaSubida, lerConfigDoApoio } from '../../../src/modules/apoio/config.js';

const COMPLETA = { PIX_CHAVE: 'contato@exemplo.test', PIX_NOME: 'Fulano de Tal', PIX_CIDADE: 'Orleans' };

describe('lerConfigDoApoio', () => {
  it('sem PIX_CHAVE, o apoio fica desligado', () => {
    expect(lerConfigDoApoio({})).toBeNull();
  });

  it('PIX_CHAVE em branco também desliga', () => {
    expect(lerConfigDoApoio({ ...COMPLETA, PIX_CHAVE: '  ' })).toBeNull();
  });

  it('com as três variáveis, traz a chave, o nome, a cidade e o copia e cola', () => {
    const config = lerConfigDoApoio(COMPLETA);

    expect(config).toMatchObject({ chave: 'contato@exemplo.test', nome: 'Fulano de Tal', cidade: 'ORLEANS' });
    expect(config?.copiaECola).toMatch(/^000201.*0014br\.gov\.bcb\.pix0120contato@exemplo\.test.*6304[0-9A-F]{4}$/);
  });

  it.each(['PIX_NOME', 'PIX_CIDADE'] as const)('PIX_CHAVE sem %s é erro que nomeia a variável', (variavel) => {
    expect(() => lerConfigDoApoio({ ...COMPLETA, [variavel]: undefined })).toThrow(`${variavel} ausente`);
  });

  it('chave inválida é erro que cita a chave', () => {
    expect(() => lerConfigDoApoio({ ...COMPLETA, PIX_CHAVE: '48999999999' })).toThrow('48999999999');
  });
});

describe('apoioDaSubida', () => {
  // O site não cai por causa do Pix: a configuração errada desliga o apoio e fica no log.
  it('config inválida desliga o apoio e avisa o motivo', () => {
    const avisos: string[] = [];

    const config = apoioDaSubida({ PIX_CHAVE: 'contato@exemplo.test' }, (motivo) => avisos.push(motivo));

    expect(config).toBeNull();
    expect(avisos).toEqual([expect.stringContaining('PIX_NOME ausente')]);
  });

  it('config válida liga o apoio sem aviso', () => {
    const avisos: string[] = [];

    const config = apoioDaSubida(COMPLETA, (motivo) => avisos.push(motivo));

    expect(config?.chave).toBe('contato@exemplo.test');
    expect(avisos).toEqual([]);
  });

  it('sem PIX_CHAVE, desligado e sem aviso', () => {
    const avisos: string[] = [];

    expect(apoioDaSubida({}, (motivo) => avisos.push(motivo))).toBeNull();
    expect(avisos).toEqual([]);
  });
});
