import type { Conferencia } from '@orleans-em-dados/contracts';
import { describe, expect, it } from 'vitest';
import { seloDespesa, seloEmpenho, seloEmpenhos, seloReceita, seloRubrica } from '../src/selos';

const NBSP = ' ';

type LinhaDeNatureza = Conferencia['receitaPorNatureza'][number];
type LinhaDeDespesa = Conferencia['despesaPorEntidade'][number];
type EmpenhoSemPar = Conferencia['empenhosSemPar'][number];

const conferencia = (campos: Partial<Conferencia> = {}): Conferencia => ({
  ano: 2025,
  disponivel: true,
  geradoEm: '2026-01-15T10:00:00.000Z',
  parcial: false,
  limites: { mesReceita: 12, dataEmpenho: '2025-12-31' },
  coletas: [],
  camara: { empenhos: 0, empenhado: null, liquidado: null, pago: null, ultimo: null },
  despesaPorEntidade: [],
  receitaPorEntidade: [],
  receitaPorMes: [],
  receitaPorNatureza: [],
  receitaIncoerente: [],
  empenhos: [],
  empenhosSemPar: [],
  semExplicacao: [],
  resumo: {
    despesaEntidadesComparadas: 0,
    despesaEntidadesIguais: 0,
    receitaBetha: 0,
    receitaTce: 0,
    receitaDiferenca: 0,
    receitaIncoerenteBetha: 0,
    naturezasComparadas: 0,
    naturezasIguais: 0,
    empenhosBetha: 0,
    empenhosTce: 0,
    empenhosCasados: 0,
    semExplicacao: 0,
    comCausaProvavel: 0,
    conhecidas: 0,
  },
  ...campos,
});

const receita = (codigoEntidade: string, diferenca: number) => ({
  sigla: codigoEntidade,
  codigoEntidade,
  betha: 100 + diferenca,
  tce: 100,
  diferenca,
  incoerenciaBetha: 0,
});

const natureza = (campos: Partial<LinhaDeNatureza>): LinhaDeNatureza => ({
  entidade: 'FMS',
  natureza: '17135011',
  descricao: 'SUS',
  betha: 150,
  tce: 100,
  diferenca: 50,
  codigoEntidade: '319',
  tipo: 'valor',
  incoerenciaBetha: 0,
  nota: 'A Betha registra mais que o TCE nesta rubrica.',
  causa: null,
  explicada: false,
  ...campos,
});

const empenhos = (campos: object) => ({
  entidade: 'Prefeitura',
  codigoEntidade: '728',
  betha: 10,
  tce: 10,
  casados: 10,
  soBetha: 0,
  valorSoBetha: 0,
  soTce: 0,
  valorSoTce: 0,
  ...campos,
});

const despesa = (campos: Partial<LinhaDeDespesa>): LinhaDeDespesa => ({
  sigla: 'Prefeitura',
  nome: 'Prefeitura Municipal',
  poder: 'Executivo',
  entidadeBetha: '728',
  bethaEmpenhado: 100,
  tceEmpenhado: 100,
  difEmpenhado: 0,
  bethaLiquidado: 100,
  tceLiquidado: 100,
  difLiquidado: 0,
  bethaPago: 100,
  tcePago: 100,
  difPago: 0,
  comparavel: true,
  ...campos,
});

const semPar = (campos: Partial<EmpenhoSemPar>): EmpenhoSemPar => ({
  fonte: 'betha',
  entidade: 'Prefeitura',
  codigoEntidade: '728',
  numero: 12,
  data: '2025-02-01',
  valor: 7000,
  liquidado: 7000,
  ocorrencia: 1,
  numeroNaOutra: null,
  id: '211:728:1003',
  nota: 'Sem correspondente no TCE.',
  causa: null,
  explicada: false,
  ...campos,
});

describe('seloReceita', () => {
  it('sem conferência, não há selo', () => {
    expect(seloReceita(null, '')).toBeNull();
  });

  it('entidade fora da conferência não tem selo', () => {
    expect(seloReceita(conferencia({ receitaPorEntidade: [receita('728', 0)] }), '319')).toBeNull();
  });

  it('sem diferença, confere', () => {
    expect(seloReceita(conferencia({ receitaPorEntidade: [receita('728', 0)] }), '')).toEqual({
      estado: 'confere',
      titulo: 'Confere com o TCE-SC',
      motivo: null,
    });
  });

  it('diferenças que se anulam entre entidades confere no total', () => {
    const conf = conferencia({ receitaPorEntidade: [receita('728', 10), receita('319', -10)] });
    expect(seloReceita(conf, '')?.estado).toBe('confere');
  });

  it('a diferença da entidade conta no recorte dela, mesmo que o total se anule', () => {
    const conf = conferencia({ receitaPorEntidade: [receita('728', 10), receita('319', -10)] });
    expect(seloReceita(conf, '728')?.estado).toBe('diverge');
  });

  it('com diferença, diverge citando o lado maior, sem sinal, e a maior rubrica com a nota', () => {
    const selo = seloReceita(
      conferencia({ receitaPorEntidade: [receita('319', 50)], receitaPorNatureza: [natureza({})] }),
      '',
    );
    expect(selo?.estado).toBe('diverge');
    expect(selo?.titulo).toBe(`Difere do TCE-SC: R$${NBSP}50,00 a mais na Betha`);
    expect(selo?.motivo).toBe(
      `Maior diferença sem explicação: rubrica 17135011 (FMS), R$${NBSP}50,00 a mais na Betha. A Betha registra mais que o TCE nesta rubrica.`,
    );
  });

  it('diferença negativa aponta o TCE-SC como o lado maior', () => {
    const selo = seloReceita(conferencia({ receitaPorEntidade: [receita('319', -5)] }), '');
    expect(selo?.titulo).toBe(`Difere do TCE-SC: R$${NBSP}5,00 a mais no TCE-SC`);
  });

  it('conta as outras rubricas, no singular e no plural', () => {
    const uma = conferencia({
      receitaPorEntidade: [receita('319', 50)],
      receitaPorNatureza: [natureza({}), natureza({ natureza: '2' })],
    });
    const duas = conferencia({
      receitaPorEntidade: [receita('319', 50)],
      receitaPorNatureza: [natureza({}), natureza({ natureza: '2' }), natureza({ natureza: '3' })],
    });
    expect(seloReceita(uma, '')?.motivo).toContain('Há mais 1 rubrica sem explicação.');
    expect(seloReceita(duas, '')?.motivo).toContain('Há mais 2 rubricas sem explicação.');
  });

  describe('diferença com causa', () => {
    const comRubricas = (...rubricas: LinhaDeNatureza[]) =>
      conferencia({ receitaPorEntidade: [receita('319', 50)], receitaPorNatureza: rubricas });

    it('só rubricas explicadas: explicada, citando as causas em minúsculas e sem repetir', () => {
      const selo = seloReceita(
        comRubricas(
          natureza({ causa: 'Possível duplicidade', explicada: true }),
          natureza({ natureza: '2', causa: 'Possível duplicidade', explicada: true }),
          natureza({ natureza: '3', causa: 'Provável reclassificação', explicada: true }),
        ),
        '',
      );
      expect(selo).toEqual({
        estado: 'explicada',
        titulo: `Difere do TCE-SC: R$${NBSP}50,00 a mais na Betha`,
        motivo: 'Nenhuma diferença nova: possível duplicidade, provável reclassificação.',
      });
    });

    it('rubrica em aberto: diverge, citando a maior em aberto e não a primeira da lista', () => {
      const selo = seloReceita(
        comRubricas(
          natureza({ natureza: '1', diferenca: 40, causa: 'Possível duplicidade', explicada: true }),
          natureza({ natureza: '2', diferenca: 10, nota: 'Sem padrão.' }),
        ),
        '',
      );
      expect(selo?.estado).toBe('diverge');
      expect(selo?.motivo).toBe(
        `Maior diferença sem explicação: rubrica 2 (FMS), R$${NBSP}10,00 a mais na Betha. Sem padrão. Outra diferença já é conhecida.`,
      );
    });

    it('com duas rubricas já conhecidas além da aberta, conta no plural', () => {
      const selo = seloReceita(
        comRubricas(
          natureza({ natureza: '1' }),
          natureza({ natureza: '2', causa: 'Possível duplicidade', explicada: true }),
          natureza({ natureza: '3', causa: 'Conhecida e recorrente', conhecida: true }),
        ),
        '',
      );
      expect(selo?.motivo).toContain('Outras 2 diferenças já são conhecidas.');
    });

    it('rubrica conhecida não conta como aberta, e o motivo avisa que segue sem causa confirmada', () => {
      const selo = seloReceita(
        comRubricas(natureza({ causa: 'Conhecida e recorrente', conhecida: true, recorrenteEm: [2024, 2025] })),
        '',
      );
      expect(selo?.estado).toBe('explicada');
      expect(selo?.motivo).toBe(
        'Nenhuma diferença nova: conhecida e recorrente. A recorrente se repete em outros anos e continua sem causa confirmada.',
      );
    });

    it('só causa provável: não fala em recorrente', () => {
      const selo = seloReceita(comRubricas(natureza({ causa: 'Possível duplicidade', explicada: true })), '');
      expect(selo?.motivo).not.toContain('recorrente');
    });

    it('diferença zero confere, mesmo com rubricas abertas que se anulam', () => {
      const conf = conferencia({
        receitaPorEntidade: [receita('319', 0)],
        receitaPorNatureza: [natureza({ diferenca: 50 }), natureza({ natureza: '2', diferenca: -50 })],
      });
      expect(seloReceita(conf, '')?.estado).toBe('confere');
    });

    it('diferença sem nenhuma rubrica para explicá-la não é explicada', () => {
      const selo = seloReceita(conferencia({ receitaPorEntidade: [receita('319', 50)] }), '');
      expect(selo?.estado).toBe('diverge');
      expect(selo?.motivo).toBe('');
    });

    it('no recorte, a rubrica aberta de outra entidade não conta', () => {
      const conf = conferencia({
        receitaPorEntidade: [receita('319', 50), receita('728', 9)],
        receitaPorNatureza: [
          natureza({ causa: 'Possível duplicidade', explicada: true }),
          natureza({ natureza: '2', entidade: 'Prefeitura', codigoEntidade: '728', diferenca: 9 }),
        ],
      });
      expect(seloReceita(conf, '319')?.estado).toBe('explicada');
      expect(seloReceita(conf, '728')?.estado).toBe('diverge');
    });

    it('explicada no ano em curso continua dizendo o que falta conferir', () => {
      const conf = conferencia({
        parcial: true,
        limites: { mesReceita: 2, dataEmpenho: '2025-02-05' },
        receitaPorEntidade: [receita('319', 50)],
        receitaPorNatureza: [natureza({ causa: 'Possível duplicidade', explicada: true })],
      });
      expect(seloReceita(conf, '')?.motivo).toBe(
        'Nenhuma diferença nova: possível duplicidade. Meses após fevereiro ainda não conferidos: o TCE-SC recebe os dados com atraso.',
      );
    });
  });

  it('no exercício parcial, diz até quando conferiu e o que ficou pendente, sem chamar de divergência', () => {
    const conf = conferencia({
      parcial: true,
      limites: { mesReceita: 2, dataEmpenho: '2025-02-05' },
      receitaPorEntidade: [receita('728', 0)],
    });
    expect(seloReceita(conf, '')).toEqual({
      estado: 'confere',
      titulo: 'Confere com o TCE-SC até fevereiro',
      motivo: 'Meses após fevereiro ainda não conferidos: o TCE-SC recebe os dados com atraso.',
    });
  });
});

describe('seloEmpenhos', () => {
  it('sem empenho de um lado só, confere contando os casados', () => {
    const selo = seloEmpenhos(conferencia({ empenhos: [empenhos({ casados: 1234 })] }), '');
    expect(selo).toEqual({
      estado: 'confere',
      titulo: 'Todos os 1.234 empenhos constam no TCE-SC',
      motivo: null,
    });
  });

  it('empenhos só na Betha divergem, com o valor', () => {
    const selo = seloEmpenhos(conferencia({ empenhos: [empenhos({ soBetha: 2, valorSoBetha: 7000 })] }), '');
    expect(selo?.estado).toBe('diverge');
    expect(selo?.titulo).toBe(`2 empenhos não constam no TCE-SC (R$${NBSP}7.000,00)`);
  });

  it('empenhos só no TCE-SC têm o próprio título', () => {
    const selo = seloEmpenhos(conferencia({ empenhos: [empenhos({ soTce: 3 })] }), '');
    expect(selo?.titulo).toBe('3 empenhos do TCE-SC não aparecem aqui');
  });

  it('diz quantos parecem versões antigas, que ficam fora das somas', () => {
    const conf = conferencia({
      empenhos: [empenhos({ soBetha: 3 })],
      empenhosSemPar: [
        semPar({ id: 'a', ocorrencia: 2 }),
        semPar({ id: 'b', numeroNaOutra: 112 }),
        semPar({ id: 'c' }),
        semPar({ id: 'd', fonte: 'tce', ocorrencia: 2 }),
      ],
    });
    expect(seloEmpenhos(conf, '')?.motivo).toContain('2 deles parecem versões antigas');
  });

  it('todos os sem par explicados: explicada', () => {
    const conf = conferencia({
      empenhos: [empenhos({ soBetha: 1, soTce: 1 })],
      empenhosSemPar: [
        semPar({ id: 'a', causa: 'Provável renumeração', explicada: true, numeroNaOutra: 112 }),
        semPar({ id: 'b', fonte: 'tce', causa: 'Provável renumeração', explicada: true, numeroNaOutra: 12 }),
      ],
    });
    expect(seloEmpenhos(conf, '')?.estado).toBe('explicada');
  });

  it('algum sem par sem causa: diverge, mesmo que seja do lado do TCE-SC', () => {
    const conf = conferencia({
      empenhos: [empenhos({ soBetha: 1, soTce: 1 })],
      empenhosSemPar: [
        semPar({ id: 'a', causa: 'Registro repetido', explicada: true, ocorrencia: 2 }),
        semPar({ id: 'b', fonte: 'tce', nota: 'Sem correspondente na Betha.' }),
      ],
    });
    expect(seloEmpenhos(conf, '')?.estado).toBe('diverge');
  });

  it('no recorte, o sem par sem causa de outra entidade não conta', () => {
    const conf = conferencia({
      empenhos: [empenhos({ soBetha: 1 })],
      empenhosSemPar: [
        semPar({ id: 'a', causa: 'Registro repetido', explicada: true, ocorrencia: 2 }),
        semPar({ id: 'b', entidade: 'FMS', codigoEntidade: '319' }),
      ],
    });
    expect(seloEmpenhos(conf, '728')?.estado).toBe('explicada');
  });

  it('com os dois lados, também conta os do TCE-SC', () => {
    const conf = conferencia({ empenhos: [empenhos({ soBetha: 1, soTce: 4, valorSoTce: 9 })] });
    expect(seloEmpenhos(conf, '')?.motivo).toContain(
      `Outros 4 empenhos do TCE-SC (R$${NBSP}9,00) não aparecem na Betha.`,
    );
  });
});

describe('seloDespesa', () => {
  it('exercício parcial usa a conferência empenho a empenho', () => {
    const conf = conferencia({ parcial: true, empenhos: [empenhos({ casados: 5 })] });
    expect(seloDespesa(conf, '')?.titulo).toBe('Todos os 5 empenhos constam no TCE-SC até 31/12/2025');
  });

  it('sem entidade comparável, não há selo', () => {
    expect(seloDespesa(conferencia({ despesaPorEntidade: [despesa({ comparavel: false })] }), '')).toBeNull();
  });

  it('as três etapas iguais conferem', () => {
    expect(seloDespesa(conferencia({ despesaPorEntidade: [despesa({})] }), '')).toEqual({
      estado: 'confere',
      titulo: 'Confere com o TCE-SC',
      motivo: 'Empenhado, liquidado e pago iguais ao centavo.',
    });
  });

  it('a primeira etapa que diverge vai para o título, e as outras para o motivo', () => {
    const selo = seloDespesa(conferencia({ despesaPorEntidade: [despesa({ difLiquidado: 10, difPago: -5 })] }), '');
    expect(selo?.titulo).toBe(`Liquidado difere do TCE-SC: R$${NBSP}10,00 a mais na Betha`);
    expect(selo?.motivo).toBe(`Empenhado igual; pago: R$${NBSP}5,00 a mais no TCE-SC. Diferença em: Prefeitura.`);
  });

  it('no recorte por entidade, só a entidade conta', () => {
    const conf = conferencia({
      despesaPorEntidade: [despesa({}), despesa({ sigla: 'FMS', entidadeBetha: '319', difPago: 1 })],
    });
    expect(seloDespesa(conf, '728')?.estado).toBe('confere');
    expect(seloDespesa(conf, '319')?.estado).toBe('diverge');
  });

  it('quando diverge, acrescenta a comparação empenho a empenho', () => {
    const conf = conferencia({
      despesaPorEntidade: [despesa({ difPago: 1 })],
      empenhos: [empenhos({ soTce: 3 })],
    });
    expect(seloDespesa(conf, '')?.motivo).toContain('Na comparação empenho a empenho: 3 empenhos do TCE-SC');
  });

  it('empenhos com causa também entram no motivo, e a despesa continua divergindo', () => {
    const conf = conferencia({
      despesaPorEntidade: [despesa({ difPago: 1 })],
      empenhos: [empenhos({ soBetha: 1, valorSoBetha: 7000 })],
      empenhosSemPar: [semPar({ causa: 'Provável renumeração', explicada: true, numeroNaOutra: 112 })],
    });
    const selo = seloDespesa(conf, '');
    expect(selo?.estado).toBe('diverge');
    expect(selo?.motivo).toContain(
      `Na comparação empenho a empenho: 1 empenhos não constam no TCE-SC (R$${NBSP}7.000,00).`,
    );
  });

  it('empenhos que conferem não entram no motivo da despesa', () => {
    const conf = conferencia({ despesaPorEntidade: [despesa({ difPago: 1 })], empenhos: [empenhos({})] });
    expect(seloDespesa(conf, '')?.motivo).not.toContain('Na comparação empenho a empenho');
  });

  it('exercício parcial com empenhos explicados herda o estado explicada', () => {
    const conf = conferencia({
      parcial: true,
      empenhos: [empenhos({ soBetha: 1 })],
      empenhosSemPar: [semPar({ causa: 'Registro repetido', explicada: true, ocorrencia: 2 })],
    });
    expect(seloDespesa(conf, '')?.estado).toBe('explicada');
  });
});

describe('seloRubrica', () => {
  const siglas = new Set(['FMS']);

  it('compara a rubrica de 14 dígitos pelo grupo de 8', () => {
    const conf = conferencia({ receitaPorNatureza: [natureza({})] });
    expect(seloRubrica(conf, '17135011000000', siglas)?.titulo).toBe(
      `Difere do TCE-SC: R$${NBSP}50,00 a mais na Betha`,
    );
  });

  it('rubrica em aberto diverge', () => {
    const conf = conferencia({ receitaPorNatureza: [natureza({})] });
    expect(seloRubrica(conf, '17135011000000', siglas)?.estado).toBe('diverge');
  });

  it('rubrica com causa provável é explicada, com a causa no título', () => {
    const conf = conferencia({ receitaPorNatureza: [natureza({ causa: 'Possível duplicidade', explicada: true })] });
    const selo = seloRubrica(conf, '17135011000000', siglas);
    expect(selo?.estado).toBe('explicada');
    expect(selo?.titulo).toBe(`Possível duplicidade · Difere do TCE-SC: R$${NBSP}50,00 a mais na Betha`);
  });

  it('rubrica conhecida também é explicada', () => {
    const conf = conferencia({
      receitaPorNatureza: [natureza({ causa: 'Conhecida e recorrente', explicada: false, conhecida: true })],
    });
    expect(seloRubrica(conf, '17135011000000', siglas)?.estado).toBe('explicada');
  });

  it('rubrica sem diferença não tem selo', () => {
    expect(seloRubrica(conferencia(), '17135011000000', siglas)).toBeNull();
  });

  it('a diferença de outra entidade não vale para esta', () => {
    const conf = conferencia({ receitaPorNatureza: [natureza({ entidade: 'Prefeitura' })] });
    expect(seloRubrica(conf, '17135011000000', siglas)).toBeNull();
  });

  it('rubrica que só existe na Betha diz que o TCE não tem', () => {
    const conf = conferencia({ receitaPorNatureza: [natureza({ tce: null })] });
    expect(seloRubrica(conf, '17135011000000', siglas)?.motivo).toContain('TCE não consta');
  });

  it('sem conferência, não há selo', () => {
    expect(seloRubrica(null, '17135011000000', siglas)).toBeNull();
  });
});

describe('seloEmpenho', () => {
  it('empenho da Betha sem par traz a nota da conferência', () => {
    const conf = conferencia({ empenhosSemPar: [semPar({ nota: 'Provável renumeração.' })] });
    expect(seloEmpenho(conf, '211:728:1003')).toEqual({
      estado: 'diverge',
      titulo: 'Não consta no TCE-SC',
      motivo: 'Provável renumeração.',
    });
  });

  it('empenho sem par com causa é explicado, com a causa no título', () => {
    const conf = conferencia({
      empenhosSemPar: [semPar({ causa: 'Provável renumeração', explicada: true, nota: 'É o nº 112 no TCE.' })],
    });
    expect(seloEmpenho(conf, '211:728:1003')).toEqual({
      estado: 'explicada',
      titulo: 'Provável renumeração · não consta no TCE-SC',
      motivo: 'É o nº 112 no TCE.',
    });
  });

  it('empenho casado não tem selo', () => {
    expect(seloEmpenho(conferencia(), '211:728:1003')).toBeNull();
  });

  it('o mesmo id do lado do TCE-SC não vale', () => {
    expect(seloEmpenho(conferencia({ empenhosSemPar: [semPar({ fonte: 'tce' })] }), '211:728:1003')).toBeNull();
  });
});

describe('linguagem da conferência', () => {
  it('nenhum selo chama diferença de erro ou irregularidade', () => {
    const conf = conferencia({
      receitaPorEntidade: [receita('319', 50)],
      receitaPorNatureza: [natureza({})],
      empenhos: [empenhos({ soBetha: 1, valorSoBetha: 1 })],
      despesaPorEntidade: [despesa({ difPago: 1 })],
    });
    const texto = JSON.stringify([seloReceita(conf, ''), seloEmpenhos(conf, ''), seloDespesa(conf, '')]);
    expect(texto).not.toMatch(/irregular|erro|fraude/i);
  });
});
