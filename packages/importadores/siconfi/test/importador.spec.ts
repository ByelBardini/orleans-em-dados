import type { Validacao } from '@orleans-em-dados/importador-nucleo';
import { describe, expect, it } from 'vitest';
import { criarImportadorSiconfi } from '../src/importador';
import type { ItemDaDca, ItemDoRreo } from '../src/normalizar';
import { anexoCoerente, ClienteSiconfiFake, COLUNAS, item } from './support/dca';
import {
  anexo14Coerente,
  CONTA_DA_EDUCACAO,
  CONTA_DO_FUNDEB,
  CONTA_DO_FUNDEB_ATE_2020,
  contaDoRreo,
  linhasDeOutrosAssuntos,
} from './support/rreo';

const importadorCom = (itens: ItemDaDca[] = []) => criarImportadorSiconfi({ cliente: new ClienteSiconfiFake(itens) });

async function validar(itens: ItemDaDca[]): Promise<Validacao> {
  const consulta = importadorCom(itens).consultas[0]!;
  const coleta = await consulta.coletar({ ano: 2025 });
  return consulta.validar(
    coleta,
    coleta.registros.map((r) => consulta.normalizar(r)),
  );
}

describe('declaração do importador', () => {
  it('as consultas usam o id e a chave do catálogo', () => {
    const importador = importadorCom();

    expect(importador.id).toBe('siconfi');
    expect(importador.consultas.map((c) => [c.id, c.chave])).toEqual([
      [900201, 'siconfi_funcoes'],
      [900202, 'siconfi_indices'],
    ]);
  });

  // O prazo de entrega da DCA é 30 de abril.
  it.each([
    ['2027-04-30T12:00:00.000Z', [2025, 2024]],
    ['2027-05-01T12:00:00.000Z', [2026, 2025]],
    ['2026-11-02T12:00:00.000Z', [2025, 2024]],
    ['2027-01-15T12:00:00.000Z', [2025, 2024]],
  ])('rodada em %s atualiza os exercícios %j', (agora, anos) => {
    expect(importadorCom().anosDaRodada(new Date(agora))).toEqual(anos);
  });

  it('a consulta da DCA não pede o RREO', async () => {
    const cliente = new ClienteSiconfiFake(anexoCoerente());

    await criarImportadorSiconfi({ cliente }).consultas[0]!.coletar({ ano: 2025 });

    expect(cliente.anosDoRreo).toEqual([]);
  });

  it('coleta pede o exercício e guarda o filtro e o total de itens', async () => {
    const cliente = new ClienteSiconfiFake(anexoCoerente());
    const consulta = criarImportadorSiconfi({ cliente }).consultas[0]!;

    const coleta = await consulta.coletar({ ano: 2025 });

    expect(cliente.anos).toEqual([2025]);
    expect(coleta.filtro).toEqual({ an_exercicio: 2025, no_anexo: 'DCA-Anexo I-E', id_ente: '4211702' });
    expect(coleta.totalHits).toBe(21);
  });

  it('item de outro exercício entra nos erros da coleta', async () => {
    const consulta = importadorCom([item(COLUNAS.pago, '10 - Saúde', 1, { exercicio: 2024 })]).consultas[0]!;

    const coleta = await consulta.coletar({ ano: 2025 });

    expect(coleta.erros).toEqual(['item do exercício 2024 na coleta de 2025']);
  });
});

describe('validar', () => {
  it('soma das funções igual à linha de total passa nas três etapas, com os itens na conferência', async () => {
    const validacao = await validar(anexoCoerente());

    expect(validacao.erros).toEqual([]);
    expect(validacao.conferencia).toEqual([
      expect.objectContaining({ campo: 'total_empenhado', fonte: '300.50', calculado: '300.50', diferenca: '0.00' }),
      expect.objectContaining({ campo: 'total_liquidado', fonte: '300.50', calculado: '300.50', diferenca: '0.00' }),
      expect.objectContaining({ campo: 'total_pago', fonte: '300.50', calculado: '300.50', diferenca: '0.00' }),
    ]);
  });

  it('colunas de restos a pagar não entram nas somas das três etapas', async () => {
    const validacao = await validar(anexoCoerente());

    expect(validacao.conferencia.map((i) => i.campo)).not.toContain('total_rp_nao_processados');
    expect(validacao.erros).toEqual([]);
  });

  it('soma diferente do total em uma etapa é erro só dessa etapa', async () => {
    const validacao = await validar(anexoCoerente({ totalDoPago: 300.49 }));

    expect(validacao.erros).toEqual(['pago: a soma das funções difere do total em 0.01']);
  });

  it('resposta vazia é erro, para o lote ser rejeitado', async () => {
    const validacao = await validar([]);

    expect(validacao.erros).toEqual([
      'empenhado: a DCA não tem a linha de total',
      'liquidado: a DCA não tem a linha de total',
      'pago: a DCA não tem a linha de total',
    ]);
  });
});

describe('consulta siconfi_indices', () => {
  const consultaCom = (itens: ItemDoRreo[]) => {
    const cliente = new ClienteSiconfiFake([], () => itens);
    const consulta = criarImportadorSiconfi({ cliente }).consultas.find((c) => c.chave === 'siconfi_indices')!;
    return { cliente, consulta };
  };

  async function validarIndices(itens: ItemDoRreo[]): Promise<Validacao> {
    const { consulta } = consultaCom(itens);
    const coleta = await consulta.coletar({ ano: 2025 });
    return consulta.validar(
      coleta,
      coleta.registros.map((r) => consulta.normalizar(r)),
    );
  }

  it('coleta pede o exercício só ao RREO e conta as duas contas, não as linhas do anexo', async () => {
    const { consulta, cliente } = consultaCom(anexo14Coerente());

    const coleta = await consulta.coletar({ ano: 2025 });

    expect(cliente.anosDoRreo).toEqual([2025]);
    expect(cliente.anos).toEqual([]);
    expect(coleta.filtro).toEqual({
      an_exercicio: 2025,
      nr_periodo: 6,
      co_tipo_demonstrativo: 'RREO',
      no_anexo: 'RREO-Anexo 14',
      id_ente: '4211702',
    });
    expect(coleta.totalHits).toBe(2);
    expect(coleta.registros).toHaveLength(2);
  });

  it.each([
    ['de outro exercício', { exercicio: 2024 }, 'item do exercício 2024 e período 6 na coleta de 2025'],
    ['de outro período', { periodo: 5 }, 'item do exercício 2025 e período 5 na coleta de 2025'],
  ])('item %s entra nos erros da coleta', async (_, campos, erro) => {
    const { consulta } = consultaCom([...anexo14Coerente(), ...linhasDeOutrosAssuntos(campos)]);

    const coleta = await consulta.coletar({ ano: 2025 });

    expect(coleta.erros).toEqual([erro]);
  });

  it('as duas contas presentes passam', async () => {
    const validacao = await validarIndices(anexo14Coerente());

    expect(validacao.erros).toEqual([]);
  });

  it('anexo vazio, como o de 2018, é erro nos dois indicadores e a coleta não lança', async () => {
    const validacao = await validarIndices([]);

    expect(validacao.erros).toEqual([
      'indice_educacao: o Anexo 14 não traz a linha',
      'fundeb_remuneracao: o Anexo 14 não traz a linha',
    ]);
  });

  it('anexo sem as linhas, como o de 2019, é erro nos dois indicadores', async () => {
    const validacao = await validarIndices(linhasDeOutrosAssuntos());

    expect(validacao.erros).toEqual([
      'indice_educacao: o Anexo 14 não traz a linha',
      'fundeb_remuneracao: o Anexo 14 não traz a linha',
    ]);
  });

  it('só uma das contas é erro só da outra', async () => {
    const validacao = await validarIndices(contaDoRreo(CONTA_DO_FUNDEB, 1, 2));

    expect(validacao.erros).toEqual(['indice_educacao: o Anexo 14 não traz a linha']);
  });

  it('duas redações do mesmo indicador no ano são erro, sem escolher uma', async () => {
    const validacao = await validarIndices([
      ...contaDoRreo(CONTA_DA_EDUCACAO, 1, 2),
      ...contaDoRreo(CONTA_DO_FUNDEB, 1, 2),
      ...contaDoRreo(CONTA_DO_FUNDEB_ATE_2020, 1, 2),
    ]);

    expect(validacao.erros).toEqual(['fundeb_remuneracao: o Anexo 14 traz 2 linhas']);
  });
});
