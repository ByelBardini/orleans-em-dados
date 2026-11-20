import { describe, expect, it } from 'vitest';
import { historicoOmitido, pareceOrganizacao } from '../src/credor.js';

// O portal não informa CPF nem CNPJ do credor. O histórico de quem pode ser pessoa física não é
// republicado (LGPD, art. 7º, §§ 3º e 7º): ele pode trazer dado de saúde ou de assistência.
describe('pareceOrganizacao', () => {
  it.each([
    'AGUA EXEMPLO LTDA',
    'CONSTRUTORA FICTICIA S.A.',
    'CELESC DISTRIBUICAO S/A',
    'BANCO DO BRASIL SA AG 1234',
    'PAPELARIA MODELO ME',
    'COMERCIO DE PECAS EPP',
    'FULANO SERVICOS EIRELI',
    'JOAO DA SILVA 12345678000190',
    'JOAO DA SILVA 12.345.678/0001-90',
    'PREFEITURA MUNICIPAL DE ORLEANS',
    'Associação de Pais e Professores',
    'COOPERATIVA DE ELETRIFICACAO',
    'INSTITUTO NACIONAL DO SEGURO SOCIAL',
    'FUNDO MUNICIPAL DE SAUDE',
    'HOSPITAL SANTA OTILIA',
    'MITRA DIOCESANA DE TUBARAO',
    'CIA CATARINENSE DE AGUAS',
  ])('%s parece organização', (nome) => {
    expect(pareceOrganizacao(nome)).toBe(true);
  });

  it.each([
    'JOAO DA SILVA',
    'Maria José de Sá',
    'HELDER CAMARA',
    'ANA MEIRELES',
    'JOSE MEPPEN',
    'CARLOS SALTDAL',
    'PEDRO 123456',
  ])('%s pode ser pessoa física', (nome) => {
    expect(pareceOrganizacao(nome)).toBe(false);
  });

  it.each([null, '', '   '])('credor vazio (%j) não parece organização', (nome) => {
    expect(pareceOrganizacao(nome)).toBe(false);
  });
});

describe('historicoOmitido', () => {
  it('histórico nulo de quem pode ser pessoa física foi omitido', () => {
    expect(historicoOmitido({ credor: 'JOAO DA SILVA', historico: null })).toBe(true);
  });

  it('histórico nulo de organização é falta na fonte, não omissão', () => {
    expect(historicoOmitido({ credor: 'AGUA EXEMPLO LTDA', historico: null })).toBe(false);
  });

  it('histórico presente nunca é omissão', () => {
    expect(historicoOmitido({ credor: 'JOAO DA SILVA', historico: 'Diária' })).toBe(false);
  });

  it('sem credor, não há o que omitir', () => {
    expect(historicoOmitido({ credor: null, historico: null })).toBe(false);
  });
});
