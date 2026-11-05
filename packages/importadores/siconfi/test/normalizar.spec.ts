import { describe, expect, it } from 'vitest';
import { normalizarConta, normalizarIndice, registroDoItem, registrosDosIndices } from '../src/normalizar';
import { COLUNAS, item } from './support/dca';
import {
  anexo14Coerente,
  COLUNAS_DO_RREO,
  CONTA_DA_EDUCACAO,
  CONTA_DO_FUNDEB,
  CONTA_DO_FUNDEB_ATE_2020,
  contaDoRreo,
  itemDoRreo,
  linhasDeOutrosAssuntos,
} from './support/rreo';

const normalizar = (conta: string, coluna = COLUNAS.empenhado, valor = 44499944.22, campos = {}) =>
  normalizarConta(registroDoItem(item(coluna, conta, valor, campos)));

describe('registroDoItem', () => {
  it('id combina etapa e conta, únicos dentro do anexo', () => {
    expect(registroDoItem(item(COLUNAS.pago, '10 - Saúde', 1)).id).toBe('pago:10 - Saúde');
  });

  it('coluna desconhecida lança citando o texto', () => {
    expect(() => registroDoItem(item('Despesas Orçadas', '10 - Saúde', 1))).toThrow('Despesas Orçadas');
  });
});

describe('normalizarConta', () => {
  it('`10 - Saúde` vira função 10, com o valor em texto decimal', () => {
    expect(normalizar('10 - Saúde')).toEqual({
      idExterno: 'empenhado:10 - Saúde',
      etapa: 'empenhado',
      tipo: 'funcao',
      funcaoCodigo: '10',
      subfuncaoCodigo: null,
      conta: 'Saúde',
      valor: '44499944.22',
    });
  });

  it('`01 - Legislativa` mantém o zero à esquerda', () => {
    expect(normalizar('01 - Legislativa').funcaoCodigo).toBe('01');
  });

  it('`10.301 - Atenção Básica` vira subfunção 10.301 da função 10', () => {
    expect(normalizar('10.301 - Atenção Básica')).toMatchObject({
      tipo: 'subfuncao',
      funcaoCodigo: '10',
      subfuncaoCodigo: '10.301',
      conta: 'Atenção Básica',
    });
  });

  it('`FU12 - Demais Subfunções` vira subfunção da função 12, sem inventar número', () => {
    expect(normalizar('FU12 - Demais Subfunções')).toMatchObject({
      tipo: 'subfuncao',
      funcaoCodigo: '12',
      subfuncaoCodigo: 'FU12',
      conta: 'Demais Subfunções',
    });
  });

  it('`Despesas Exceto Intraorçamentárias` vira a linha de total, sem função', () => {
    expect(normalizar('Despesas Exceto Intraorçamentárias')).toMatchObject({
      tipo: 'total',
      funcaoCodigo: null,
      subfuncaoCodigo: null,
    });
  });

  it.each([
    ['Inscrição de Restos a Pagar Não Processados', 'rp_nao_processados'],
    ['Inscrição de Restos a Pagar Processados', 'rp_processados'],
    ['Despesas Liquidadas', 'liquidado'],
    ['Despesas Pagas', 'pago'],
  ])('coluna %s vira a etapa %s', (coluna, etapa) => {
    expect(normalizar('10 - Saúde', coluna).etapa).toBe(etapa);
  });

  it.each([['Despesas Intraorçamentárias'], ['100 - Outra'], ['10.30 - Curta']])(
    'conta em formato desconhecido %s lança citando o texto',
    (conta) => {
      expect(() => normalizar(conta)).toThrow(conta);
    },
  );

  it('ente diferente de Orleans lança citando o recebido', () => {
    expect(() => normalizar('10 - Saúde', COLUNAS.pago, 1, { cod_ibge: 4200000 })).toThrow('4200000');
  });

  it('valor com mais de duas casas lança, em vez de arredondar', () => {
    expect(() => normalizar('10 - Saúde', COLUNAS.pago, 1.005)).toThrow('1.005');
  });
});

describe('registrosDosIndices', () => {
  it('junta as colunas de cada conta num registro, com a conta como id', () => {
    const { registros, erros } = registrosDosIndices(contaDoRreo(CONTA_DA_EDUCACAO, 1500.25, 26.5));

    expect(erros).toEqual([]);
    expect(registros).toEqual([
      expect.objectContaining({
        id: CONTA_DA_EDUCACAO,
        conta: CONTA_DA_EDUCACAO,
        exercicio: 2025,
        cod_ibge: 4211702,
        colunas: {
          [COLUNAS_DO_RREO.valor]: 1500.25,
          [COLUNAS_DO_RREO.minimo]: 25,
          [COLUNAS_DO_RREO.percentual]: 26.5,
        },
      }),
    ]);
  });

  it('o registro não carrega a coluna e o valor do item que o abriu', () => {
    const { registros } = registrosDosIndices(contaDoRreo(CONTA_DA_EDUCACAO, 1500.25, 26.5));

    expect(Object.keys(registros[0]!)).not.toContain('coluna');
    expect(Object.keys(registros[0]!)).not.toContain('valor');
  });

  it('duas contas viram dois registros, e as linhas de outros assuntos ficam de fora', () => {
    const { registros } = registrosDosIndices(anexo14Coerente());

    expect(registros.map((r) => r.id)).toEqual([CONTA_DA_EDUCACAO, CONTA_DO_FUNDEB]);
  });

  it('anexo só com outros assuntos não vira registro, como o de 2019', () => {
    expect(registrosDosIndices(linhasDeOutrosAssuntos())).toEqual({ registros: [], erros: [] });
  });

  it('conta de formato novo que cita o assunto segue adiante, para a normalização recusar', () => {
    const conta = 'Mínimo Anual de 80% do FUNDEB na Remuneração da Educação';

    const { registros } = registrosDosIndices(contaDoRreo(conta, 1, 2));

    expect(registros.map((r) => r.id)).toEqual([conta]);
  });

  it('a mesma coluna repetida numa conta é erro, sem escolher um dos valores', () => {
    const { erros } = registrosDosIndices([
      itemDoRreo(CONTA_DA_EDUCACAO, COLUNAS_DO_RREO.valor, 1),
      itemDoRreo(CONTA_DA_EDUCACAO, COLUNAS_DO_RREO.valor, 2),
    ]);

    expect(erros).toEqual([`coluna "${COLUNAS_DO_RREO.valor}" repetida em "${CONTA_DA_EDUCACAO}"`]);
  });
});

describe('normalizarIndice', () => {
  const registroDe = (conta: string, valor = 14248662.13, percentual = 28.5, campos = {}) =>
    registrosDosIndices(contaDoRreo(conta, valor, percentual, 25, campos)).registros[0]!;

  it('conta da educação vira indice_educacao, com valor e percentual em texto decimal', () => {
    expect(normalizarIndice(registroDe(CONTA_DA_EDUCACAO))).toEqual({
      idExterno: '4211702:municipal:::indice_educacao:2025',
      indicador: 'indice_educacao',
      lugar: '4211702',
      rede: 'municipal',
      recorte: '',
      periodo: '2025',
      valor: '14248662.13',
      percentual: '28.50',
    });
  });

  it.each([
    ['a redação até 2020 (60%, magistério)', CONTA_DO_FUNDEB_ATE_2020],
    ['a redação desde 2021 (70%, profissionais)', CONTA_DO_FUNDEB],
  ])('Fundeb com %s vira fundeb_remuneracao', (_, conta) => {
    expect(normalizarIndice(registroDe(conta))).toMatchObject({
      idExterno: '4211702:municipal:::fundeb_remuneracao:2025',
      indicador: 'fundeb_remuneracao',
    });
  });

  it('o período é o exercício do item', () => {
    expect(normalizarIndice(registroDe(CONTA_DA_EDUCACAO, 1, 2, { exercicio: 2017 })).periodo).toBe('2017');
  });

  it('conta de formato novo lança citando o texto, sem adivinhar o indicador', () => {
    const conta = 'Mínimo Anual de 80% do FUNDEB na Remuneração da Educação';

    expect(() => normalizarIndice(registroDe(conta))).toThrow(`conta em formato desconhecido: "${conta}"`);
  });

  it.each([
    ['valor', COLUNAS_DO_RREO.valor, COLUNAS_DO_RREO.percentual],
    ['percentual', COLUNAS_DO_RREO.percentual, COLUNAS_DO_RREO.valor],
  ])('conta sem a coluna de %s lança, em vez de gravar nulo ou zero', (_, ausente, presente) => {
    const { registros } = registrosDosIndices([itemDoRreo(CONTA_DA_EDUCACAO, presente, 10)]);

    expect(() => normalizarIndice(registros[0]!)).toThrow(`sem a coluna "${ausente}"`);
  });

  it('coluna com valor nulo lança, em vez de virar zero', () => {
    const { registros } = registrosDosIndices([
      itemDoRreo(CONTA_DA_EDUCACAO, COLUNAS_DO_RREO.valor, null),
      itemDoRreo(CONTA_DA_EDUCACAO, COLUNAS_DO_RREO.percentual, 10),
    ]);

    expect(() => normalizarIndice(registros[0]!)).toThrow(`sem a coluna "${COLUNAS_DO_RREO.valor}"`);
  });

  it('ente diferente de Orleans lança', () => {
    expect(() => normalizarIndice(registroDe(CONTA_DA_EDUCACAO, 1, 2, { cod_ibge: 4200000 }))).toThrow(
      'ente 4200000 recebido',
    );
  });
});
