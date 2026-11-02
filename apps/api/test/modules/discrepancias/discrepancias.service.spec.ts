import { describe, expect, it } from 'vitest';
import type { DiscrepanciaConferida } from '@orleans-em-dados/db/conferencias';
import { AGUARDANDO, montarSecao, TEXTOS } from '../../../src/modules/discrepancias/discrepancias.service';

const caso = (campos: Partial<DiscrepanciaConferida>): DiscrepanciaConferida => ({
  area: 'receita',
  tipo: 'sem_causa',
  entidade: 'FMS',
  codigoEntidade: '319',
  betha: 100,
  tce: 90,
  diferenca: 10,
  nota: 'Nota (exemplo)',
  situacao: 'calculada',
  ...campos,
});

const secao = (discrepancias: DiscrepanciaConferida[]) =>
  montarSecao({ ano: 2025, parcial: false, limites: { mesReceita: 12, dataEmpenho: '2025-12-31' }, discrepancias });

describe('montarSecao', () => {
  it('o total soma em centavos, sem erro de ponto flutuante', () => {
    const { grupos } = secao([caso({ diferenca: 0.1 }), caso({ diferenca: 0.2 })]);
    expect(grupos[0]?.total).toBe(0.3);
  });

  it('diferença do lado do TCE-SC pesa em módulo', () => {
    const { grupos } = secao([
      caso({ tipo: 'so_tce', betha: null, diferenca: -428.37 }),
      caso({ tipo: 'so_tce', diferenca: -1 }),
    ]);
    expect(grupos[0]?.total).toBe(429.37);
    expect(grupos[0]?.itens[0]?.diferenca).toBe(-428.37);
  });

  it('valor em meses diferentes pesa o que mudou de mês, porque a soma do ano é zero', () => {
    const { grupos } = secao([caso({ tipo: 'mes_diferente', diferenca: 0, diferencaBetha: 70, diferencaTce: 70 })]);
    expect(grupos[0]?.total).toBe(70);
  });

  it('o mesmo tipo em áreas diferentes vira grupos separados: não se somam', () => {
    const { grupos } = secao([
      caso({ area: 'receita', diferenca: 10 }),
      caso({ area: 'despesa', diferenca: 20 }),
      caso({ area: 'empenho', diferenca: 30 }),
    ]);
    expect(grupos.map((g) => [g.area, g.tipo, g.total])).toEqual([
      ['receita', 'sem_causa', 10],
      ['despesa', 'sem_causa', 20],
      ['empenho', 'sem_causa', 30],
    ]);
    expect(new Set(grupos.map((g) => g.rotulo)).size).toBe(3);
  });

  it('o tipo interno do registro sem par sai com outro nome e com o rótulo neutro', () => {
    const { grupos } = secao([caso({ area: 'empenho', tipo: 'empenho_fantasma' })]);
    expect(grupos[0]).toMatchObject({
      tipo: 'empenho_sem_execucao',
      rotulo: 'Registro sem execução e sem par no TCE-SC',
    });
  });

  it('aguardando sai à parte, separado por área, e não conta no resumo', () => {
    const { grupos, aguardando, resumo } = secao([
      caso({ tipo: 'aguardando_tce', mes: 10, diferenca: 100.1 }),
      caso({ tipo: 'aguardando_tce', mes: 11, diferenca: 200.2 }),
      caso({ area: 'despesa', tipo: 'aguardando_tce', diferenca: 50, quantidade: 3 }),
    ]);
    expect(grupos).toEqual([]);
    expect(aguardando.receita.total).toBe(300.3);
    expect(aguardando.despesa).toMatchObject({ total: 50, quantidade: 3 });
    expect(resumo.casos).toBe(0);
  });

  it('caso confirmado em parte é contado à parte no resumo', () => {
    const { resumo } = secao([caso({ situacao: 'confirmada_em_parte' }), caso({ situacao: 'calculada' })]);
    expect(resumo.porSituacao).toEqual({
      confirmada_no_portal: 0,
      confirmada_em_parte: 1,
      calculada: 1,
      rever: 0,
    });
  });

  it('campo fora da lista da seção não passa, mesmo que venha na discrepância', () => {
    const comCredor = { ...caso({}), credor: 'NOME (exemplo)', historico: 'TEXTO (exemplo)' };
    const texto = JSON.stringify(secao([comCredor]));
    expect(texto).not.toContain('NOME');
    expect(texto).not.toContain('TEXTO');
  });
});

describe('textos públicos', () => {
  it('nenhum rótulo nem explicação afirma causa', () => {
    const textos = JSON.stringify([Object.values(TEXTOS), AGUARDANDO]);
    expect(textos).not.toMatch(/fantasma|\berros?\b|irregular|fraude/i);
  });
});

describe('rubricas que se compensam', () => {
  const mes = (n: number, diferenca: number) => ({ mes: n, betha: null, tce: null, diferenca });
  const lado = (campos: Partial<DiscrepanciaConferida>) =>
    caso({
      tipo: 'fora_do_acumulado',
      entidade: 'Prefeitura',
      codigoEntidade: '728',
      natureza: '17295101',
      descricao: 'Sub-rubrica (exemplo)',
      betha: 180,
      tce: 195,
      diferenca: -15,
      meses: [mes(4, -15)],
      ...campos,
    });
  const outroLado = (campos: Partial<DiscrepanciaConferida> = {}) =>
    lado({ natureza: '24299901', betha: 515, tce: 500, diferenca: 15, meses: [mes(4, 15)], ...campos });
  const tipos = (lista: DiscrepanciaConferida[]) => secao(lista).grupos.map((g) => [g.tipo, g.total, g.itens.length]);

  // Regressão: FMS/Prefeitura 2025, ±R$ 15.312,12 saíam como dois casos independentes (conferência de 02/11/2026).
  it('valores opostos da mesma entidade viram um caso de reclassificação, contado uma vez', () => {
    const { grupos, resumo } = secao([lado({}), outroLado()]);
    expect(grupos.map((g) => [g.tipo, g.total, g.itens.length])).toEqual([['reclassificacao', 15, 1]]);
    expect(resumo.casos).toBe(1);
    expect(resumo.porArea.receita).toEqual({ casos: 1, total: 15 });
  });

  it('o caso traz as duas rubricas com o valor de cada fonte e diferença zero no total', () => {
    const [item] = secao([outroLado(), lado({})]).grupos[0]?.itens ?? [];
    expect(item?.compensacao).toEqual({
      aMenos: { natureza: '17295101', betha: 180, tce: 195 },
      aMais: { natureza: '24299901', betha: 515, tce: 500 },
    });
    expect(item).toMatchObject({ diferenca: 0, valor: 15, descricao: null, natureza: null, betha: null, tce: null });
    expect(item?.meses.map((m) => m.mes)).toEqual([4]);
  });

  it('a nota diz o lado de cada rubrica e que não muda o total, sem afirmar a causa', () => {
    const [item] = secao([lado({}), outroLado()]).grupos[0]?.itens ?? [];
    expect(item?.nota).toContain('a menos na rubrica 17295101 e a mais na 24299901');
    expect(item?.nota).toContain('provável reclassificação');
    expect(item?.nota).toContain('sem efeito no total');
  });

  it('lançamento fora do acumulado continua dito na nota do caso', () => {
    const [item] = secao([lado({}), outroLado()]).grupos[0]?.itens ?? [];
    expect(item?.nota).toContain('não fecha com o acumulado');
  });

  it('par já classificado como reclassificação não cita o acumulado', () => {
    const [item] =
      secao([lado({ tipo: 'reclassificacao' }), outroLado({ tipo: 'reclassificacao' })]).grupos[0]?.itens ?? [];
    expect(item?.nota).not.toContain('acumulado');
    expect(item?.compensacao).not.toBeNull();
  });

  it.each([
    ['outra entidade', { codigoEntidade: '319' }],
    ['valor diferente', { diferenca: 14 }],
    ['mesmo lado', { diferenca: -15 }],
    ['parte de uma natureza dividida', { diferencaDaNatureza: 30 }],
    ['outro mês', { meses: [mes(5, 15)] }],
    ['outra situação', { situacao: 'confirmada_no_portal' as const }],
    ['outra área', { area: 'despesa' as const }],
  ])('com %s, os dois lados seguem separados', (_nome, campos) => {
    const itens = secao([lado({}), outroLado(campos)]).grupos.flatMap((g) => g.itens);
    expect(itens).toHaveLength(2);
    expect(itens.every((i) => i.compensacao === null)).toBe(true);
  });

  it('tipo sem relação com reclassificação não é juntado', () => {
    expect(tipos([lado({ tipo: 'so_tce' }), outroLado({ tipo: 'so_tce' })])).toEqual([['so_tce', 30, 2]]);
  });

  it('terceiro caso de mesmo valor fica de fora: cada lado forma um par só', () => {
    const terceiro = lado({ natureza: '13000000', betha: 15, tce: 0, diferenca: 15 });
    expect(tipos([lado({}), outroLado(), terceiro])).toEqual([
      ['reclassificacao', 15, 1],
      ['fora_do_acumulado', 15, 1],
    ]);
  });
});
