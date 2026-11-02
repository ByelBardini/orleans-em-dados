import { describe, expect, it } from 'vitest';
import type { CelulaQlik } from '../src/celulas';
import { criarImportadorTcesc } from '../src/importador';
import type { CuboQlik, SessaoQlik } from '../src/sessao-qlik';

const dim = (qText: string | null): CelulaQlik => (qText === null ? { qIsNull: true } : { qText, qNum: 'NaN' });
const num = (qNum: number | 'NaN', qText = String(qNum)): CelulaQlik => ({ qNum, qText });

/** Motor Qlik de mentira: guarda o que foi pedido e devolve o cubo preparado. */
class SessaoQlikFake implements SessaoQlik {
  selecionados: [string, string][] = [];
  limpou = false;
  fechou = false;
  recargas: string[];
  selecoesAtivas: Record<string, string[]> | null = null;

  constructor(
    private cubo: CuboQlik,
    recargas = ['2025-03-01T06:00:00.000Z'],
  ) {
    this.recargas = recargas;
  }
  async limparSelecoes() {
    this.limpou = true;
  }
  async selecionar(campo: string, texto: string) {
    this.selecionados.push([campo, texto]);
  }
  async selecoes() {
    return this.selecoesAtivas ?? Object.fromEntries(this.selecionados.map(([c, t]) => [c, [t]]));
  }
  async hipercubo() {
    return this.cubo;
  }
  async infoApp() {
    const ultimaRecarga = this.recargas.length > 1 ? (this.recargas.shift() as string) : (this.recargas[0] as string);
    return { titulo: 'App', ultimaRecarga };
  }
  fechar() {
    this.fechou = true;
  }
}

const linhaReceita = (unidade: string, mes: string, valor: number, natureza = 'IPTU') => [
  dim(unidade),
  dim('1.1.1'),
  dim(mes),
  dim(null),
  num(valor),
  dim(natureza),
];

const cuboDeReceita = (linhas: CelulaQlik[][], total: number | 'NaN', linhasTotal = linhas.length): CuboQlik => ({
  linhasTotal,
  linhas,
  totais: [num(total), dim(null)],
});

function preparar(sessao: SessaoQlik) {
  const aberturas: string[] = [];
  const importador = criarImportadorTcesc({
    abrirSessao: async (appId) => {
      aberturas.push(appId);
      return sessao;
    },
  });
  const consulta = (chave: string) => {
    const achada = importador.consultas.find((c) => c.chave === chave);
    if (!achada) throw new Error(`Sem consulta ${chave}`);
    return achada;
  };
  return { importador, aberturas, consulta };
}

describe('criarImportadorTcesc', () => {
  it('declara receitas e empenhos do TCE-SC, com a rodada do ano corrente e do anterior', () => {
    const { importador } = preparar(new SessaoQlikFake(cuboDeReceita([], 0)));

    expect({ id: importador.id, fonte: importador.fonte }).toEqual({ id: 'tcesc', fonte: 'tcesc' });
    expect(importador.consultas.map((c) => [c.chave, c.id])).toEqual([
      ['receitas', 900001],
      ['empenhos', 900002],
    ]);
    expect(importador.anosDaRodada(new Date('2026-03-10T06:00:00.000Z'))).toEqual([2026, 2025]);
  });
});

describe('coletar', () => {
  it('abre o app da consulta, limpa e seleciona município e exercício, e fecha a sessão', async () => {
    const sessao = new SessaoQlikFake(cuboDeReceita([], 0));
    const { consulta, aberturas } = preparar(sessao);

    await consulta('receitas').coletar({ ano: 2025 });

    expect(aberturas).toEqual(['c97cd52c-9dd8-4c8c-83c4-733d037539f9']);
    expect(sessao.limpou).toBe(true);
    expect(sessao.selecionados).toEqual([
      ['nome_ente', 'ORLEANS'],
      ['ano_competencia', '2025'],
    ]);
    expect(sessao.fechou).toBe(true);
  });

  it('fecha a sessão mesmo quando o motor falha', async () => {
    const sessao = new SessaoQlikFake(cuboDeReceita([], 0));
    sessao.hipercubo = async () => {
      throw new Error('Qlik: erro no hipercubo');
    };
    const { consulta } = preparar(sessao);

    await expect(consulta('receitas').coletar({ ano: 2025 })).rejects.toThrow('Qlik: erro no hipercubo');
    expect(sessao.fechou).toBe(true);
  });

  it('cada linha do cubo vira registro com id das dimensões e dinheiro em texto', async () => {
    const sessao = new SessaoQlikFake(cuboDeReceita([linhaReceita('Prefeitura', 'jan', 300000.1)], 300000.1));
    const { consulta } = preparar(sessao);

    const { registros, totalHits } = await consulta('receitas').coletar({ ano: 2025 });

    expect(totalHits).toBe(1);
    expect(registros).toEqual([
      {
        id: 'Prefeitura|1.1.1|jan|',
        nomeunidade: 'Prefeitura',
        codigoreceita: '1.1.1',
        Mês: 'jan',
        descricaotipodeducaoreceita: null,
        valorArrecadado: '300000.10',
        natureza: 'IPTU',
      },
    ]);
  });

  it('o filtro guarda seleções, medidas e a recarga do app, que a conferência exibe', async () => {
    const sessao = new SessaoQlikFake(cuboDeReceita([], 0));
    const { consulta } = preparar(sessao);

    const { filtro } = await consulta('receitas').coletar({ ano: 2025 });

    expect(filtro).toMatchObject({
      appId: 'c97cd52c-9dd8-4c8c-83c4-733d037539f9',
      selecoes: { nome_ente: 'ORLEANS', ano_competencia: '2025' },
      selecoesConfirmadas: { nome_ente: ['ORLEANS'], ano_competencia: ['2025'] },
      ultimaRecargaApp: '2025-03-01T06:00:00.000Z',
    });
  });

  it('seleção diferente da pedida vira erro citando as seleções', async () => {
    const sessao = new SessaoQlikFake(cuboDeReceita([], 0));
    sessao.selecoesAtivas = { nome_ente: ['ORLEANS'], ano_competencia: ['2024'] };
    const { consulta } = preparar(sessao);

    const { erros } = await consulta('receitas').coletar({ ano: 2025 });

    expect(erros).toEqual(['seleções inesperadas: {"nome_ente":["ORLEANS"],"ano_competencia":["2024"]}']);
  });

  it('filtro a mais ativo no app também vira erro', async () => {
    const sessao = new SessaoQlikFake(cuboDeReceita([], 0));
    sessao.selecoesAtivas = { nome_ente: ['ORLEANS'], ano_competencia: ['2025'], outro: ['x'] };
    const { consulta } = preparar(sessao);

    expect((await consulta('receitas').coletar({ ano: 2025 })).erros?.[0]).toContain('seleções inesperadas');
  });

  it('app recarregado durante a coleta vira erro com as duas datas', async () => {
    const sessao = new SessaoQlikFake(cuboDeReceita([], 0), ['2025-03-01T06:00:00.000Z', '2025-03-02T06:00:00.000Z']);
    const { consulta } = preparar(sessao);

    const { erros } = await consulta('receitas').coletar({ ano: 2025 });

    expect(erros).toEqual(['app recarregado durante a coleta (2025-03-01T06:00:00.000Z → 2025-03-02T06:00:00.000Z)']);
  });

  it('valor que não é dinheiro vira erro citando o campo, e o registro fica com nulo', async () => {
    const linha = [dim('P'), dim('1'), dim('jan'), dim(null), num(10.123), dim('IPTU')];
    const { consulta } = preparar(new SessaoQlikFake(cuboDeReceita([linha], 10.12)));

    const { erros, registros, camposAusentes } = await consulta('receitas').coletar({ ano: 2025 });

    expect(erros).toEqual(['valor não monetário em valorArrecadado: 10.123']);
    expect(registros[0]?.valorArrecadado).toBeNull();
    expect(camposAusentes?.valorArrecadado).toBe(1);
  });

  it('célula vazia de medida é contada como ausente, sem erro', async () => {
    const linha = [dim('P'), dim('1'), dim('jan'), dim(null), { qNum: 'NaN', qText: '-' } as CelulaQlik, dim('IPTU')];
    const { consulta } = preparar(new SessaoQlikFake(cuboDeReceita([linha], 0)));

    const { erros, camposAusentes } = await consulta('receitas').coletar({ ano: 2025 });

    expect(erros).toEqual([]);
    expect(camposAusentes?.valorArrecadado).toBe(1);
  });
});

describe('validar', () => {
  const conferir = async (cubo: CuboQlik) => {
    const { consulta } = preparar(new SessaoQlikFake(cubo));
    const receitas = consulta('receitas');
    const coleta = await receitas.coletar({ ano: 2025 });
    return receitas.validar(coleta, []);
  };

  it('soma das linhas igual ao total do motor aprova, em centavos', async () => {
    const linhas = [linhaReceita('P', 'jan', 0.1), linhaReceita('P', 'fev', 0.2)];

    const { erros, conferencia } = await conferir(cuboDeReceita(linhas, 0.30000000000000004));

    expect(erros).toEqual([]);
    expect(conferencia).toEqual([
      {
        campo: 'valorArrecadado',
        titulo: 'Sum(valorarrecadado)',
        descricao: 'Total geral do hipercubo no motor Qlik',
        fonte: '0.30',
        calculado: '0.30',
        diferenca: '0.00',
      },
    ]);
  });

  it('soma diferente do total reprova citando o campo e a diferença', async () => {
    const { erros } = await conferir(cuboDeReceita([linhaReceita('P', 'jan', 10)], 10.01));

    expect(erros).toEqual(['valorArrecadado: soma das linhas difere do total do motor (-0.01)']);
  });

  it('total do motor ausente reprova, e a conferência fica sem o valor da fonte', async () => {
    const { erros, conferencia } = await conferir(cuboDeReceita([linhaReceita('P', 'jan', 10)], 'NaN'));

    expect(erros).toEqual(['total do motor ausente para valorArrecadado']);
    expect(conferencia[0]).toMatchObject({ fonte: null, diferenca: null, calculado: '10.00' });
  });
});

describe('empenhos', () => {
  it('confere as seis medidas somadas, e não as descritivas', async () => {
    const medidas = [10, 10, 5, 10, 0, 0];
    const linha = [
      dim('5001'),
      ...medidas.map((m) => num(m)),
      dim('204'),
      dim('10'),
      dim('2025-01-10'),
      dim('X'),
      dim('H'),
    ];
    const totais = [...medidas.map((m) => num(m)), ...Array.from({ length: 5 }, () => dim(null))];
    const { consulta } = preparar(new SessaoQlikFake({ linhasTotal: 1, linhas: [linha], totais }));
    const empenhos = consulta('empenhos');

    const coleta = await empenhos.coletar({ ano: 2025 });
    const { conferencia, erros } = empenhos.validar(coleta, []);

    expect(erros).toEqual([]);
    expect(conferencia.map((c) => c.campo)).toEqual([
      'valorEmpenhado',
      'valorLiquidado',
      'valorPago',
      'valorOriginal',
      'valorReforco',
      'valorEstorno',
    ]);
    expect(coleta.registros[0]).toMatchObject({ id: '5001', codigoUG: '204', valorPago: '5.00', numero: '10' });
  });
});
