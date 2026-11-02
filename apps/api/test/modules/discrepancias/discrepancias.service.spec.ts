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
