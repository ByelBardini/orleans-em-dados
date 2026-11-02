import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { popularBancoDeTeste, limparColetas } from '../../../importadores/fixtures/src/banco-de-teste';
import { conferencia } from '../../src/conferencia/conferencia.service';
import { pool } from '../../src/index';

const GRAVADA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/api/test/paridade/respostas/api_conferencias_ano_2025.json',
);

afterAll(() => pool.end());

describe('conferencia(ano)', () => {
  beforeAll(popularBancoDeTeste);

  it('com as cinco coletas publicadas, devolve o mesmo que a API gravada', async () => {
    const { corpo } = JSON.parse(readFileSync(GRAVADA, 'utf8'));
    const resultado = await conferencia(2025);
    // A resposta passou por JSON; `coletadoEm` vira texto no caminho.
    expect({ ...JSON.parse(JSON.stringify(resultado)), geradoEm: corpo.geradoEm }).toEqual(corpo);
  });

  it('mês divergente decompõe a diferença por rubrica, e o mês igual fica sem parcela', async () => {
    const resultado = await conferencia(2025);
    if (!resultado.disponivel) throw new Error('fixture deveria estar disponível');
    expect(resultado.receitaPorMes.map((m) => [m.mes, m.parcelas])).toEqual([
      [1, []],
      [2, [{ mes: 2, ent: '319', entidade: 'FMS', natureza: '17135011', diferenca: 50000 }]],
    ]);
  });

  it('rubrica explicada pelo acumulado recebe causa e sai da lista sem explicação', async () => {
    const resultado = await conferencia(2025);
    if (!resultado.disponivel) throw new Error('fixture deveria estar disponível');
    expect(resultado.receitaPorNatureza[0]).toMatchObject({
      natureza: '17135011',
      causa: 'Lançamento fora do acumulado',
      explicada: true,
    });
    expect(resultado.semExplicacao.filter((i) => i.onde === 'receita')).toEqual([]);
  });

  it('sem outro exercício publicado, nenhuma rubrica é conhecida', async () => {
    const resultado = await conferencia(2025);
    if (!resultado.disponivel) throw new Error('fixture deveria estar disponível');
    expect(resultado.resumo.conhecidas).toBe(0);
  });

  it('ano sem coleta nenhuma lista as cinco que faltam', async () => {
    expect(await conferencia(2019)).toEqual({
      ano: 2019,
      disponivel: false,
      faltando: ['receitas', 'empenhos', 'despesas', 'tcesc_receitas', 'tcesc_empenhos'],
      coletas: [],
    });
  });

  it('falta da coleta do TCE-SC é apontada, sem comparar pela metade', async () => {
    await pool.query(`DELETE FROM publicacoes WHERE consulta_id = 900002`);
    const resultado = await conferencia(2025);
    await limparColetas();
    expect(resultado.disponivel).toBe(false);
    expect(resultado).toMatchObject({ faltando: ['tcesc_empenhos'] });
  });
});
