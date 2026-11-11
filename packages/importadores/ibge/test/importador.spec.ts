import type { ItemDeConferencia, RegistroBruto, Validacao } from '@orleans-em-dados/importador-nucleo';
import { describe, expect, it } from 'vitest';
import { ibgeEducacaoCenso, ibgeEducacaoComparacao, ibgeRedeEscolar } from '../../fixtures/src/snapshots';
import { criarImportadorIbge } from '../src/importador';
import {
  ClienteIbgeFake,
  respostasCompletas,
  respostasDaComparacao,
  respostasDaPopulacao,
  respostasDoCenso,
  respostasDoIpca,
  respostasDoPib,
  variavel,
} from './support/agregados';
import { respostasDaEducacao, respostasDasPesquisas, VALORES_DA_REDE } from './support/educacao';

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
      [900105, 'ibge_educacao_censo'],
      [900106, 'ibge_educacao_comparacao'],
      [900107, 'ibge_rede_escolar'],
      [900108, 'ibge_ipca'],
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

describe('ibge_educacao_censo', () => {
  const daConsulta = (cliente: ClienteIbgeFake) =>
    criarImportadorIbge({ cliente }).consultas.find((c) => c.chave === 'ibge_educacao_censo')!;

  it('pede as dez tabelas para Orleans, sem localidade declarada, com os recortes de cada uma', async () => {
    const cliente = new ClienteIbgeFake(respostasDaEducacao());

    await daConsulta(cliente).coletar({ ano: 2026 });

    expect(new Set(cliente.pedidos.map((p) => p.tabela))).toEqual(
      new Set(['10091', '10092', '10056', '10057', '10058', '10059', '10061', '10062', '10324', '1549']),
    );
    expect(cliente.pedidos.every((p) => p.localidades === undefined)).toBe(true);
    expect(cliente.pedidos.filter((p) => p.tabela === '10324').map((p) => p.classificacao)).toEqual([
      '468[all]|2[6794]|58[95253]|11322[79175]',
      '468[12164]|2[6794]|58[95253]|11322[all]',
      '468[all]|2[6794]|58[95253]|11322[121405]',
      '468[all]|2[6794]|58[95253]|11322[12123]',
    ]);
  });

  it('recortes que repetem a mesma linha viram um registro só, e o total acompanha', async () => {
    const coleta = await daConsulta(new ClienteIbgeFake(respostasDaEducacao())).coletar({ ano: 2026 });

    expect(new Set(coleta.registros.map((r) => r.id)).size).toBe(coleta.registros.length);
    expect(coleta.totalHits).toBe(coleta.registros.length);
    expect(coleta.registros.filter((r) => r.id === '10091:2513:2022:')).toHaveLength(1);
  });

  it('dados coerentes passam, com cada conta na conferência', async () => {
    const validacao = await validar('ibge_educacao_censo', respostasDaEducacao());

    expect(validacao.erros).toEqual([]);
    expect(validacao.conferencia.map((i) => i.campo)).toEqual([
      'alfabetizacao_pessoas',
      'local_total',
      'local_graduacao',
      'local_pos_graduacao',
      'local_outro_municipio_por_curso',
      'nivel_ate_5_anos',
      'nivel_6_a_17_anos',
      'nivel_18_anos_ou_mais',
      'instrucao_25_anos_ou_mais',
      'populacao_2010',
      'frequencia_2010',
    ]);
  });

  it('alfabetizadas + não alfabetizadas diferente do total rejeita: é universo, sem tolerância', async () => {
    const validacao = await validar('ibge_educacao_censo', respostasDaEducacao({ alfabetizadas: '901' }));

    expect(validacao.erros).toEqual(['alfabetizacao_pessoas: as partes diferem do total em 1.00']);
  });

  it('398 + 188 contra 585 é arredondamento da amostra: não rejeita e a diferença fica na conferência', async () => {
    const validacao = await validar('ibge_educacao_censo', respostasDaEducacao());

    expect(validacao.erros).toEqual([]);
    expect(item(validacao, 'local_graduacao')).toMatchObject({
      fonte: '585.00',
      calculado: '586.00',
      diferenca: '1.00',
    });
  });

  it('partes acima do total além do arredondamento rejeitam', async () => {
    const validacao = await validar('ibge_educacao_censo', respostasDaEducacao({ municipioGraduacao: '400' }));

    expect(validacao.erros).toEqual(['local_graduacao: as partes diferem do total em 3.00, além da tolerância']);
  });

  it('total até 0,5% acima das partes passa: o IBGE não abre um pedaço das respostas por local', async () => {
    const validacao = await validar(
      'ibge_educacao_censo',
      respostasDaEducacao({ totalGraduacao: '10000', municipioGraduacao: '9762', outroGraduacao: '188' }),
    );

    expect(validacao.erros).toEqual([]);
    expect(item(validacao, 'local_graduacao')).toMatchObject({ diferenca: '-50.00' });
  });

  it('total mais de 0,5% acima das partes rejeita', async () => {
    const validacao = await validar(
      'ibge_educacao_censo',
      respostasDaEducacao({ totalGraduacao: '10000', municipioGraduacao: '9700', outroGraduacao: '188' }),
    );

    expect(validacao.erros).toEqual(['local_graduacao: as partes diferem do total em -112.00, além da tolerância']);
  });

  it('a folga do que não é aberto por local não vale fora da 10324', async () => {
    const respostas = respostasDaEducacao();
    respostas['10058'] = [
      variavel('13283', 'Pessoas', [
        { serie: { '2022': '10000' } },
        { categorias: ['Regular de ensino fundamental'], serie: { '2022': '9960' } },
      ]),
    ];

    const validacao = await validar('ibge_educacao_censo', respostas);

    expect(validacao.erros).toEqual(['nivel_6_a_17_anos: as partes diferem do total em -40.00, além da tolerância']);
  });

  it('parte em X não entra na conta nem rejeita', async () => {
    const validacao = await validar('ibge_educacao_censo', respostasDaEducacao({ estrangeiroGraduacao: 'X' }));

    expect(validacao.erros).toEqual([]);
    expect(item(validacao, 'local_graduacao')).toBeUndefined();
  });

  it.each([
    ['10091'],
    ['10092'],
    ['10056'],
    ['10057'],
    ['10058'],
    ['10059'],
    ['10061'],
    ['10062'],
    ['10324'],
    ['1549'],
  ])('sem a tabela %s, o lote é rejeitado citando o que falta', async (tabela) => {
    const validacao = await validar('ibge_educacao_censo', { ...respostasDaEducacao(), [tabela]: [] });

    expect(validacao.erros).toEqual([`falta o Censo de educação (tabela ${tabela})`]);
  });
});

describe('ibge_educacao_comparacao', () => {
  const daComparacao = async (comparacao: Record<string, unknown>) => {
    const cliente = new ClienteIbgeFake({}, comparacao);
    const consulta = criarImportadorIbge({ cliente }).consultas.find((c) => c.chave === 'ibge_educacao_comparacao')!;
    const coleta = await consulta.coletar({ ano: 2026 });
    const linhas = coleta.registros.map((r: RegistroBruto) => consulta.normalizar(r));
    return { cliente, consulta, validacao: consulta.validar(coleta, linhas) };
  };
  const dosDoisLugares = () =>
    respostasDaComparacao({ brasil: respostasDaEducacao(), santaCatarina: respostasDaEducacao() });

  it('pede as mesmas tabelas para o Brasil e Santa Catarina', async () => {
    const { cliente } = await daComparacao(dosDoisLugares());

    expect(new Set(cliente.pedidos.map((p) => p.localidades))).toEqual(new Set(['N1[all]|N3[42]']));
    expect(new Set(cliente.pedidos.map((p) => p.tabela)).size).toBe(10);
  });

  it('com os dois lugares coerentes, não há erro, e o item diz de qual lugar é', async () => {
    const { validacao } = await daComparacao(dosDoisLugares());

    expect(validacao.erros).toEqual([]);
    expect(item(validacao, 'santa_catarina_local_graduacao')).toMatchObject({ diferenca: '1.00' });
    expect(item(validacao, 'brasil_alfabetizacao_pessoas')).toMatchObject({ diferenca: '0.00' });
  });

  it('erro de um lugar cita o lugar', async () => {
    const { validacao } = await daComparacao(
      respostasDaComparacao({
        brasil: respostasDaEducacao(),
        santaCatarina: respostasDaEducacao({ alfabetizadas: '899' }),
      }),
    );

    expect(validacao.erros).toEqual(['Santa Catarina: alfabetizacao_pessoas: as partes diferem do total em -1.00']);
  });

  it('registro de Orleans na resposta da comparação recusa a linha', async () => {
    const { consulta } = await daComparacao(dosDoisLugares());

    expect(() =>
      consulta.normalizar({
        id: 'x',
        tabela: '10092',
        variavel: '950',
        unidade: 'Pessoas',
        periodo: '2022',
        categoria: '',
        localidade: '4211702',
        valor: '1',
      }),
    ).toThrow('localidade 4211702');
  });
});

describe('ibge_rede_escolar', () => {
  const daRede = async (respostas = respostasDasPesquisas()) => {
    const pesquisas = new ClienteIbgeFake({}, {}, respostas);
    const consulta = criarImportadorIbge({ cliente: new ClienteIbgeFake({}), pesquisas }).consultas.find(
      (c) => c.chave === 'ibge_rede_escolar',
    )!;
    const coleta = await consulta.coletar({ ano: 2026 });
    const linhas = coleta.registros.map((r: RegistroBruto) => consulta.normalizar(r));
    return { pesquisas, consulta, coleta, linhas, validacao: consulta.validar(coleta, linhas) };
  };

  it('pede a árvore uma vez por pesquisa e os resultados de Orleans e de Santa Catarina', async () => {
    const { pesquisas } = await daRede();

    expect(pesquisas.pedidosDePesquisa).toEqual([
      'arvore:40',
      'resultados:40:4211702',
      'resultados:40:42',
      'arvore:13',
      'resultados:13:4211702',
      'resultados:13:42',
    ]);
  });

  it('matrícula por série e rede fica guardada, em cada lugar', async () => {
    const { linhas } = await daRede();

    const daSerie = linhas.filter(
      (l: { categoria: string; periodo: string }) =>
        l.categoria === 'Matrículas > Ensino fundamental > 1º ano > Municipal' && l.periodo === '2025',
    );

    expect(daSerie.map((l: { localidade: string; valor: string }) => [l.localidade, l.valor])).toEqual([
      ['4211702', '60'],
      ['42', '60'],
    ]);
  });

  it('ano sem IDEB fica nulo, nunca zero', async () => {
    const { linhas } = await daRede();

    expect(
      linhas.find(
        (l: { localidade: string; variavel: string; periodo: string }) =>
          l.localidade === '4211702' && l.variavel === '78188' && l.periodo === '2023',
      ),
    ).toMatchObject({ valor: null, simbolo: '-' });
  });

  it('soma das séries por rede fecha com a etapa: passa, com um item por lugar, etapa e ano', async () => {
    const { validacao } = await daRede();

    expect(validacao.erros).toEqual([]);
    expect(item(validacao, 'orleans_matriculas_fundamental_2025')).toMatchObject({
      fonte: '177.00',
      calculado: '177.00',
      diferenca: '0.00',
    });
    expect(item(validacao, 'santa_catarina_matriculas_creche_2021')).toMatchObject({ fonte: '60.00' });
  });

  it('linha da série vazia com série × rede preenchida fecha pela rede, como no fundamental de 2021', async () => {
    const { validacao } = await daRede();

    expect(item(validacao, 'orleans_matriculas_fundamental_2021')).toMatchObject({
      fonte: '150.00',
      calculado: '150.00',
    });
  });

  it('série × rede que não fecha com a etapa rejeita, citando lugar, etapa e ano', async () => {
    const rede = { ...VALORES_DA_REDE, 77945: { '2021': '60', '2025': '71' } };

    const { validacao } = await daRede(respostasDasPesquisas({ rede }));

    expect(validacao.erros).toEqual(['Orleans: matriculas_fundamental_2025: as partes diferem do total em 1.00']);
  });

  it('ano com a etapa sem valor não entra na conta nem vira zero', async () => {
    const { validacao } = await daRede();

    expect(item(validacao, 'orleans_matriculas_medio_2025')).toBeUndefined();
    expect(validacao.erros).toEqual([]);
  });

  it('sem matrículas de um lugar, o lote é rejeitado citando o lugar', async () => {
    const { validacao } = await daRede(respostasDasPesquisas({ redeSc: {} }));

    expect(validacao.erros).toEqual(['Santa Catarina: falta a matrícula do fundamental (pesquisa 13)']);
  });

  it('sem IDEB com número, o lote é rejeitado nos dois lugares', async () => {
    const { validacao } = await daRede(respostasDasPesquisas({ ideb: { 78186: { '2025': null } } }));

    expect(validacao.erros).toEqual([
      'Orleans: falta o IDEB (pesquisa 40)',
      'Santa Catarina: falta o IDEB (pesquisa 40)',
    ]);
  });

  it('id fora da árvore recusa o registro na normalização', async () => {
    const respostas = respostasDasPesquisas();
    respostas.resultados['13:4211702'] = [{ id: 999, res: [{ localidade: '421170', res: { '2025': '1' } }] }];
    const consulta = criarImportadorIbge({
      cliente: new ClienteIbgeFake({}),
      pesquisas: new ClienteIbgeFake({}, {}, respostas),
    }).consultas.find((c) => c.chave === 'ibge_rede_escolar')!;

    const coleta = await consulta.coletar({ ano: 2026 });

    expect(() => consulta.normalizar(coleta.registros.find((r: RegistroBruto) => r.variavel === '999')!)).toThrow(
      '999',
    );
  });
});

describe('fixtures de educação', () => {
  it.each([
    ['ibge_educacao_censo', ibgeEducacaoCenso()],
    ['ibge_educacao_comparacao', ibgeEducacaoComparacao()],
    ['ibge_rede_escolar', ibgeRedeEscolar()],
  ])('%s passa nas validações da própria consulta', (chave, snapshot) => {
    const consulta = criarImportadorIbge({ cliente: new ClienteIbgeFake({}) }).consultas.find(
      (c) => c.chave === chave,
    )!;
    const linhas = snapshot.registros.map((r: RegistroBruto) => consulta.normalizar(r));

    const { erros } = consulta.validar({ filtro: {}, totalHits: linhas.length, registros: snapshot.registros }, linhas);

    expect(erros).toEqual([]);
  });

  it('o Censo fictício de Orleans carrega o arredondamento da amostra na graduação', () => {
    const consulta = criarImportadorIbge({ cliente: new ClienteIbgeFake({}) }).consultas.find(
      (c) => c.chave === 'ibge_educacao_censo',
    )!;
    const { registros } = ibgeEducacaoCenso();
    const linhas = registros.map((r: RegistroBruto) => consulta.normalizar(r));

    const validacao = consulta.validar({ filtro: {}, totalHits: linhas.length, registros }, linhas);

    expect(item(validacao, 'local_graduacao')).toMatchObject({ fonte: '590.00', calculado: '591.00' });
  });
});

describe('ibge_ipca', () => {
  it('pede o número-índice da 1737 só para o Brasil', async () => {
    const cliente = new ClienteIbgeFake(respostasDoIpca(), respostasDoIpca());
    const consulta = criarImportadorIbge({ cliente }).consultas.find((c) => c.chave === 'ibge_ipca')!;

    const coleta = await consulta.coletar({ ano: 2026 });

    expect(cliente.pedidos).toEqual([{ tabela: '1737', variaveis: ['2266'], localidades: 'N1[all]' }]);
    expect(coleta.registros.map((r) => consulta.normalizar(r))).toEqual([
      expect.objectContaining({ idExterno: '1:1737:2266:202412:', periodo: '202412', valor: '7100.5000000000000' }),
      expect.objectContaining({ idExterno: '1:1737:2266:202501:', periodo: '202501', valor: '7111.8600000000000' }),
    ]);
  });

  it('série mensal com número passa', async () => {
    const validacao = await validar('ibge_ipca', respostasDoIpca());

    expect(validacao.erros).toEqual([]);
  });

  it('mês ainda não publicado (`...`) fica nulo e não rejeita', async () => {
    const validacao = await validar('ibge_ipca', respostasDoIpca({ '202412': '7100.5', '202601': '...' }));

    expect(validacao.erros).toEqual([]);
  });

  it('período fora do formato AAAAMM rejeita citando o período', async () => {
    const validacao = await validar('ibge_ipca', respostasDoIpca({ '202412': '7100.5', '2025': '7200' }));

    expect(validacao.erros).toEqual(['IPCA: período 2025 não é mensal (AAAAMM)']);
  });

  it('sem nenhum índice com número, o lote é rejeitado', async () => {
    const validacao = await validar('ibge_ipca', respostasDoIpca({ '202601': '...' }));

    expect(validacao.erros).toEqual(['falta o IPCA (tabela 1737)']);
  });
});
