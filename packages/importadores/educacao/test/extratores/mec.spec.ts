import { describe, expect, it } from 'vitest';
import { loteDoRetrato } from '../../src/extratores/mec';
import { registroDe } from '../support/arquivos';

const retrato = {
  ano: 2025,
  respostas: { solicitacoes_nao_atendidas_creche: 'Resposta fictícia', quantidade_na_lista_de_espera: null },
  distribuicao_sc: { basico: 12 },
};

describe('loteDoRetrato', () => {
  it('a resposta da Prefeitura fica em texto, com o prefixo retrato_', () => {
    expect(
      registroDe(loteDoRetrato(retrato), '4211702:municipal:::retrato_solicitacoes_nao_atendidas_creche:2025'),
    ).toMatchObject({ valor: null, texto: 'Resposta fictícia', unidade: 'texto' });
  });

  it('quantidade sem resposta fica sem valor nem texto, nunca zero', () => {
    expect(
      registroDe(loteDoRetrato(retrato), '4211702:municipal:::retrato_quantidade_na_lista_de_espera:2025'),
    ).toMatchObject({ valor: null, texto: null });
  });

  it('a distribuição é de municípios de SC, no recorte do nível', () => {
    expect(registroDe(loteDoRetrato(retrato), '42:municipal::basico:retrato_distribuicao:2025')).toMatchObject({
      valor: '12',
      unidade: 'municipios',
    });
  });
});
