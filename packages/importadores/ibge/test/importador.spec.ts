import type { ItemDeConferencia, RegistroBruto, Validacao } from '@orleans-em-dados/importador-nucleo';
import { describe, expect, it } from 'vitest';
import { criarImportadorIbge } from '../src/importador';
import {
  ClienteIbgeFake,
  respostasCompletas,
  respostasDaComparacao,
  respostasDaPopulacao,
  respostasDoCenso,
  respostasDoPib,
} from './support/agregados';

async function validar(chave: string, respostas: Record<string, unknown>): Promise<Validacao> {
  const importador = criarImportadorIbge({ cliente: new ClienteIbgeFake(respostas) });
  const consulta = importador.consultas.find((c) => c.chave === chave);
  if (!consulta) throw new Error(`Sem consulta ${chave}`);
  const coleta = await consulta.coletar({ ano: 2026 });
  return consulta.validar(
    coleta,
    coleta.registros.map((r: RegistroBruto) => consulta.normalizar(r)),
  );
}

const item = (validacao: Validacao, campo: string): ItemDeConferencia | undefined =>
  validacao.conferencia.find((i) => i.campo === campo);

describe('declaração do importador', () => {
  it('rodada agendada usa só o ano corrente, e o lote traz a série inteira', () => {
    const importador = criarImportadorIbge({ cliente: new ClienteIbgeFake({}) });

    expect(importador.anosDaRodada(new Date('2026-11-02T12:00:00.000Z'))).toEqual([2026]);
  });

  it('as consultas usam os ids e as chaves do catálogo', () => {
    const importador = criarImportadorIbge({ cliente: new ClienteIbgeFake({}) });

    expect(importador.id).toBe('ibge');
    expect(importador.consultas.map((c) => [c.id, c.chave])).toEqual([
      [900101, 'ibge_populacao'],
      [900102, 'ibge_censo'],
      [900103, 'ibge_pib'],
      [900104, 'ibge_comparacao'],
    ]);
  });

  it('coleta junta as tabelas da consulta num lote só, com o total igual ao capturado', async () => {
    const cliente = new ClienteIbgeFake(respostasDaPopulacao());
    const consulta = criarImportadorIbge({ cliente }).consultas[0]!;

    const coleta = await consulta.coletar({ ano: 2026 });

    expect(cliente.pedidos.map((p) => p.tabela)).toEqual(['6579', '200', '4709']);
    expect(coleta.registros.map((r) => r.id)).toEqual([
      '6579:9324:2021:',
      '6579:9324:2024:',
      '200:93:2000:',
      '200:93:2010:',
      '4709:93:2022:',
    ]);
    expect(coleta.totalHits).toBe(5);
  });
});

describe('ibge_populacao', () => {
  it('com o Censo 2022 presente, não há erro', async () => {
    const validacao = await validar('ibge_populacao', respostasDaPopulacao());

    expect(validacao.erros).toEqual([]);
  });

  it('sem o Censo 2022, o lote é rejeitado citando o que falta', async () => {
    const validacao = await validar('ibge_populacao', respostasDaPopulacao(null));

    expect(validacao.erros).toEqual(['falta o Censo 2022 (tabela 4709)']);
  });

  it('Censo 2022 com símbolo em vez de número conta como falta', async () => {
    const validacao = await validar('ibge_populacao', respostasDaPopulacao('...'));

    expect(validacao.erros).toEqual(['falta o Censo 2022 (tabela 4709)']);
  });
});

describe('ibge_censo', () => {
  it('urbana + rural igual ao total passa, com o item na conferência', async () => {
    const validacao = await validar('ibge_censo', respostasDoCenso());

    expect(validacao.erros).toEqual([]);
    expect(item(validacao, 'situacao_domicilio')).toMatchObject({
      fonte: '1000.00',
      calculado: '1000.00',
      diferenca: '0.00',
    });
  });

  it('homens + mulheres nas faixas de idade igual ao total da 9514 passa, e `-` conta zero', async () => {
    const validacao = await validar('ibge_censo', respostasDoCenso());

    expect(item(validacao, 'piramide_etaria')).toMatchObject({
      fonte: '1000.00',
      calculado: '1000.00',
      diferenca: '0.00',
    });
  });

  it('urbana + rural diferente do total é erro, com a diferença', async () => {
    const validacao = await validar('ibge_censo', respostasDoCenso({ rural: '299' }));

    expect(validacao.erros).toEqual(['situacao_domicilio: as partes diferem do total em -1.00']);
  });

  it('pirâmide que não fecha com o total é erro', async () => {
    const validacao = await validar('ibge_censo', respostasDoCenso({ homens: '501' }));

    expect(validacao.erros).toEqual(['piramide_etaria: as partes diferem do total em 1.00']);
  });

  it.each([['4714'], ['9923'], ['9514'], ['10295']])('sem a tabela %s do Censo, o lote é rejeitado', async (tabela) => {
    const respostas: Record<string, unknown> = { ...respostasDoCenso(), [tabela]: [] };

    const validacao = await validar('ibge_censo', respostas);

    expect(validacao.erros.join()).toContain(`tabela ${tabela}`);
  });
});

describe('ibge_pib', () => {
  it('composição igual ao PIB passa, com o item do ano na conferência', async () => {
    const validacao = await validar('ibge_pib', respostasDoPib());

    expect(validacao.erros).toEqual([]);
    expect(item(validacao, 'pib_2021')).toMatchObject({ fonte: '1000.00', calculado: '1000.00', diferenca: '0.00' });
  });

  it('ano com a composição em `...` não entra na soma nem rejeita', async () => {
    const validacao = await validar('ibge_pib', respostasDoPib());

    expect(item(validacao, 'pib_2023')).toBeUndefined();
    expect(validacao.erros).toEqual([]);
  });

  it('diferença de arredondamento de até 3 mil reais passa', async () => {
    const validacao = await validar('ibge_pib', respostasDoPib({ pib2021: '1003' }));

    expect(validacao.erros).toEqual([]);
    expect(item(validacao, 'pib_2021')?.diferenca).toBe('-3.00');
  });

  it('diferença acima do arredondamento é erro, citando o ano', async () => {
    const validacao = await validar('ibge_pib', respostasDoPib({ pib2021: '1004' }));

    expect(validacao.erros).toEqual(['pib_2021: a composição difere do PIB em -4.00 mil reais']);
  });

  it('sem nenhuma linha de PIB, o lote é rejeitado', async () => {
    const validacao = await validar('ibge_pib', respostasDoPib({ comPib: false }));

    expect(validacao.erros).toEqual(['falta o PIB (tabela 5938)']);
  });
});

describe('fixture completa', () => {
  it('as três consultas passam com as respostas fictícias', async () => {
    const respostas = respostasCompletas();

    const erros = await Promise.all(
      ['ibge_populacao', 'ibge_censo', 'ibge_pib'].map(async (c) => (await validar(c, respostas)).erros),
    );

    expect(erros).toEqual([[], [], []]);
  });
});

describe('ibge_comparacao', () => {
  it('pede ao Brasil e a Santa Catarina as mesmas tabelas de Orleans', async () => {
    const cliente = new ClienteIbgeFake(respostasDaComparacao());
    const consulta = criarImportadorIbge({ cliente }).consultas.find((c) => c.chave === 'ibge_comparacao')!;

    await consulta.coletar({ ano: 2026 });

    expect(cliente.pedidos.map((p) => p.tabela)).toEqual([
      '6579',
      '200',
      '4709',
      '4714',
      '9923',
      '9514',
      '10295',
      '5938',
    ]);
    expect(new Set(cliente.pedidos.map((p) => p.localidades))).toEqual(new Set(['N1[all]|N3[42]']));
  });

  it('com os dois lugares coerentes, passa, e a conferência diz de qual lugar é cada item', async () => {
    const validacao = await validar('ibge_comparacao', respostasDaComparacao());

    expect(validacao.erros).toEqual([]);
    expect(item(validacao, 'brasil_situacao_domicilio')?.diferenca).toBe('0.00');
    expect(item(validacao, 'santa_catarina_piramide_etaria')?.diferenca).toBe('0.00');
    expect(item(validacao, 'santa_catarina_pib_2021')?.diferenca).toBe('0.00');
  });

  it('sem Santa Catarina, recusa dizendo o lugar e a tabela', async () => {
    const validacao = await validar('ibge_comparacao', respostasDaComparacao({ santaCatarina: {} }));

    expect(validacao.erros).toContain('Santa Catarina: falta o Censo 2022 (tabela 4709)');
    expect(validacao.erros).not.toContain('Brasil: falta o Censo 2022 (tabela 4709)');
  });

  it('urbana + rural que não fecha no Brasil recusa dizendo o lugar', async () => {
    const validacao = await validar(
      'ibge_comparacao',
      respostasDaComparacao({ brasil: { ...respostasCompletas(), ...respostasDoCenso({ rural: '299' }) } }),
    );

    expect(validacao.erros).toEqual(['Brasil: situacao_domicilio: as partes diferem do total em -1.00']);
  });

  it('linha de Orleans dentro da comparação é recusada', async () => {
    const consulta = criarImportadorIbge({ cliente: new ClienteIbgeFake(respostasCompletas()) }).consultas.find(
      (c) => c.chave === 'ibge_comparacao',
    )!;

    const coleta = await consulta.coletar({ ano: 2026 });

    expect(() => consulta.normalizar(coleta.registros[0]!)).toThrow('4211702');
  });
});
