import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { limparColetas, popularCenario } from '../../../importadores/fixtures/src/banco-de-teste';
import { despesa, siconfiFuncoes, snapshot } from '../../../importadores/fixtures/src/snapshots';
import { conferirGastoEducacao } from '../../src/conferencia/conferencia.service';
import { pool } from '../../src/index';

beforeEach(() => popularCenario());
afterAll(() => pool.end());

type Valores = [empenhado: number, liquidado: number, pago: number];

const linha = (id: string, numero: string, nome: string, [empenhado, liquidado, pago]: Valores) =>
  despesa(`728:${id}`, '33903000000000', { numero, nome }, 0, empenhado, liquidado, pago);

// A DCA das fixtures tem 53.000,00 na função 12, nas três etapas.
const DCA_DA_EDUCACAO = (valores: Valores) => [
  siconfiFuncoes({ contas: { '12 - Educação': valores.map((v) => v.toFixed(2)) as [string, string, string] } }),
];

describe('conferirGastoEducacao', () => {
  it('soma das ações igual à função 12 nas três etapas fica conferida', async () => {
    await popularCenario({
      despesas: snapshot(57170, [
        linha('1', '54', 'Manutenção do Ensino Fundamental', [30000, 30000, 30000]),
        linha('2', '57', 'Manutenção do Ensino Infantil', [20000, 20000, 20000]),
        linha('3', '53', 'Manutenção da Merenda Escolar', [3000, 3000, 3000]),
      ]),
    });

    expect(await conferirGastoEducacao(2025)).toEqual({
      ano: 2025,
      estado: 'conferido',
      etapas: [
        { etapa: 'empenhado', dca: 53000, betha: 53000, diferenca: 0, maior: null },
        { etapa: 'liquidado', dca: 53000, betha: 53000, diferenca: 0, maior: null },
        { etapa: 'pago', dca: 53000, betha: 53000, diferenca: 0, maior: null },
      ],
    });
  });

  it('as etapas somam cada uma a sua coluna, e a função 12 da DCA é lida por etapa', async () => {
    await popularCenario({
      siconfiFuncoes: DCA_DA_EDUCACAO([900.1, 700.2, 500.3]),
      despesas: snapshot(57170, [linha('1', '54', 'Manutenção do Ensino Fundamental', [900.1, 700.2, 500.3])]),
    });

    expect(await conferirGastoEducacao(2025)).toMatchObject({
      estado: 'conferido',
      etapas: [{ betha: 900.1 }, { betha: 700.2 }, { betha: 500.3 }],
    });
  });

  it('um centavo a menos no pago fica em diferença, com a etapa', async () => {
    await popularCenario({
      despesas: snapshot(57170, [linha('1', '54', 'Manutenção do Ensino Fundamental', [53000, 53000, 52999.99])]),
    });

    const resultado = await conferirGastoEducacao(2025);

    if (resultado.estado !== 'diferenca') throw new Error('esperava diferença');
    expect(resultado.etapas.filter((e) => e.maior !== null)).toEqual([
      { etapa: 'pago', dca: 53000, betha: 52999.99, diferenca: 0.01, maior: 'dca' },
    ]);
  });

  it('ação com número novo e o mesmo nome soma', async () => {
    await popularCenario({
      despesas: snapshot(57170, [
        linha('1', '54', 'Manutenção do Ensino Fundamental', [50000, 50000, 50000]),
        linha('2', '9054', 'Manutenção do Ensino Fundamental', [3000, 3000, 3000]),
      ]),
    });

    expect((await conferirGastoEducacao(2025)).estado).toBe('conferido');
  });

  it('nome com outra grafia, sem acento e em caixa alta, soma', async () => {
    await popularCenario({
      despesas: snapshot(57170, [
        linha('1', '54', 'Manutenção do Ensino Fundamental', [50000, 50000, 50000]),
        linha('2', '55', 'MANUTENCAO DO ENSINO INFANTIL', [3000, 3000, 3000]),
      ]),
    });

    expect((await conferirGastoEducacao(2025)).estado).toBe('conferido');
  });

  it('ação de outro nome, com o número de uma ação da educação, fica fora da soma', async () => {
    await popularCenario({
      despesas: snapshot(57170, [
        linha('1', '54', 'Manutenção do Ensino Fundamental', [53000, 53000, 53000]),
        linha('2', '54', 'Obras urbanas', [7000, 7000, 7000]),
      ]),
    });

    expect((await conferirGastoEducacao(2025)).estado).toBe('conferido');
  });

  it('coleta da Betha sem nenhuma ação da educação compara com zero, e fica em diferença', async () => {
    await popularCenario({
      despesas: snapshot(57170, [linha('1', '1', 'Obras urbanas', [53000, 53000, 53000])]),
    });

    expect(await conferirGastoEducacao(2025)).toMatchObject({
      estado: 'diferenca',
      etapas: [{ etapa: 'empenhado', dca: 53000, betha: 0, diferenca: 53000, maior: 'dca' }, {}, {}],
    });
  });

  it('ano com DCA e sem coleta da Betha fica sem_betha', async () => {
    await popularCenario({ siconfiFuncoes: [siconfiFuncoes(), siconfiFuncoes({ ano: 2023 })] });

    expect(await conferirGastoEducacao(2023)).toEqual({ ano: 2023, estado: 'sem_betha' });
  });

  it('coleta de exemplo da Betha não confere: fica sem_betha', async () => {
    const exemplo = snapshot(57170, [linha('1', '54', 'Manutenção do Ensino Fundamental', [53000, 53000, 53000])], {
      status: 'exemplo',
    });
    await popularCenario({ despesas: exemplo });

    expect(await conferirGastoEducacao(2025)).toEqual({ ano: 2025, estado: 'sem_betha' });
  });

  it('coleta de exemplo da DCA não confere: fica sem_dca', async () => {
    const exemplo = siconfiFuncoes();
    exemplo.meta.status = 'exemplo';
    await popularCenario({
      siconfiFuncoes: [exemplo],
      despesas: snapshot(57170, [linha('1', '54', 'Manutenção do Ensino Fundamental', [53000, 53000, 53000])]),
    });

    expect(await conferirGastoEducacao(2025)).toEqual({ ano: 2025, estado: 'sem_dca' });
  });

  it('ano sem a coleta da DCA fica sem_dca', async () => {
    await popularCenario({ siconfiFuncoes: [] });

    expect(await conferirGastoEducacao(2025)).toEqual({ ano: 2025, estado: 'sem_dca' });
  });

  it('banco vazio fica sem_dca', async () => {
    await limparColetas();

    expect(await conferirGastoEducacao(2025)).toEqual({ ano: 2025, estado: 'sem_dca' });
  });
});
