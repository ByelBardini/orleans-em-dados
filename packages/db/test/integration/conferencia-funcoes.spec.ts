import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { limparColetas, popularCenario } from '../../../importadores/fixtures/src/banco-de-teste';
import { siconfiFuncoes, tcescEmpenhos } from '../../../importadores/fixtures/src/snapshots';
import { gravarSnapshot, RepositorioDeLotesPostgres } from '../../../importadores/nucleo/src/index';
import { criarImportadorSiconfi } from '../../../importadores/siconfi/src/importador';
import { conferirFuncoes } from '../../src/conferencia/conferencia.service';
import { pool } from '../../src/index';

beforeEach(() => popularCenario());
afterAll(() => pool.end());

describe('conferirFuncoes', () => {
  it('fixtures iguais nas três etapas ficam conferidas, com o total sem a Câmara', async () => {
    const resultado = await conferirFuncoes(2025);

    expect(resultado).toEqual({
      ano: 2025,
      estado: 'conferido',
      total: {
        estado: 'conferido',
        etapas: [
          { etapa: 'empenhado', dca: 195000, tce: 195000, diferenca: 0, maior: null },
          { etapa: 'liquidado', dca: 120000, tce: 120000, diferenca: 0, maior: null },
          { etapa: 'pago', dca: 100000, tce: 100000, diferenca: 0, maior: null },
        ],
      },
      legislativa: {
        estado: 'conferido',
        etapas: [
          { etapa: 'empenhado', dca: 25000, tce: 25000, diferenca: 0, maior: null },
          { etapa: 'liquidado', dca: 25000, tce: 25000, diferenca: 0, maior: null },
          { etapa: 'pago', dca: 20000, tce: 20000, diferenca: 0, maior: null },
        ],
      },
    });
  });

  it('DCA com um centavo a mais no pago de uma função fica em diferença', async () => {
    await popularCenario({
      siconfiFuncoes: [
        siconfiFuncoes({
          contas: {
            'Despesas Exceto Intraorçamentárias': ['220000.00', '145000.00', '120000.01'],
            '15 - Urbanismo': ['127000.00', '67000.00', '47000.01'],
          },
        }),
      ],
    });

    const resultado = await conferirFuncoes(2025);

    if (resultado.estado !== 'diferenca') throw new Error('esperava diferença');
    expect(resultado.total.etapas[2]).toEqual({
      etapa: 'pago',
      dca: 100000.01,
      tce: 100000,
      diferenca: 0.01,
      maior: 'dca',
    });
    expect(resultado.legislativa.estado).toBe('conferido');
  });

  it('ano com DCA e sem coleta do TCE-SC fica sem_tce', async () => {
    await popularCenario({ siconfiFuncoes: [siconfiFuncoes(), siconfiFuncoes({ ano: 2023 })] });

    expect(await conferirFuncoes(2023)).toEqual({ ano: 2023, estado: 'sem_tce' });
  });

  it('coleta de exemplo do TCE-SC não confere nada: fica sem_tce', async () => {
    const exemplo = tcescEmpenhos();
    exemplo.meta.status = 'exemplo';
    await popularCenario({ tcescEmpenhos: exemplo });

    expect(await conferirFuncoes(2025)).toEqual({ ano: 2025, estado: 'sem_tce' });
  });

  it('ano sem a coleta da DCA fica sem_dca', async () => {
    await popularCenario({ siconfiFuncoes: [] });

    expect(await conferirFuncoes(2025)).toEqual({ ano: 2025, estado: 'sem_dca' });
  });

  it('banco vazio fica sem_dca', async () => {
    await limparColetas();

    expect(await conferirFuncoes(2025)).toEqual({ ano: 2025, estado: 'sem_dca' });
  });

  it('lê só o publicado: cópia antiga da DCA, gravada e não publicada, não entra na soma', async () => {
    const consulta = criarImportadorSiconfi({ cliente: { anexo: async () => [] } }).consultas[0]!;
    const antiga = siconfiFuncoes({ contas: { '12 - Educação': ['1.00', '1.00', '1.00'] } });
    antiga.meta.status = 'rejeitado';
    await gravarSnapshot(consulta, antiga, 'arquivo', new RepositorioDeLotesPostgres());

    const resultado = await conferirFuncoes(2025);

    expect(resultado.estado).toBe('conferido');
  });
});
