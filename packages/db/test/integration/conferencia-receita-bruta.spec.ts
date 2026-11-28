// A receita no formato antigo da Betha (até 2019): ela publica o bruto, com a rubrica de 15 dígitos e
// a classe na frente; o TCE-SC traz o bruto e a dedução do FUNDEB em linhas separadas. Bruto confere
// com bruto; a dedução fica à parte, e a entidade que a Betha não publica é listada.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gravarLote, popularCenario } from '../../../importadores/fixtures/src/banco-de-teste';
import {
  ANO_ANTIGO,
  receitasFormatoAntigo,
  tcescReceitasFormatoAntigo,
} from '../../../importadores/fixtures/src/snapshots';
import { conferenciaPorArea } from '../../src/conferencia/conferencia.service';
import { pool } from '../../src/index';

async function receitaDoAno(ano: number) {
  const { receita } = await conferenciaPorArea(ano);
  if (!receita.disponivel) throw new Error(`a receita de ${ano} deveria estar disponível`);
  return receita;
}

afterAll(() => pool.end());

describe('conferenciaPorArea: receita no formato bruto', () => {
  beforeAll(async () => {
    await popularCenario();
    await gravarLote('betha', 'receitas', receitasFormatoAntigo());
    await gravarLote('tcesc', 'receitas', tcescReceitasFormatoAntigo());
  });

  it('o bruto do Portal da Transparência confere com o bruto do TCE-SC, e a dedução do FUNDEB não entra na diferença', async () => {
    const { receita } = await receitaDoAno(ANO_ANTIGO);

    expect(receita.totais).toMatchObject({ conferido: 1500, diferencaBetha: 0, diferencaTce: 300 });
    expect(receita.porEntidade.find((e) => e.codigoEntidade === '728')).toMatchObject({
      conferido: 1500,
      diferencaBetha: 0,
      diferencaTce: 0,
    });
  });

  it('diz que a receita é bruta e soma à parte a dedução que só o TCE-SC registra', async () => {
    const { receita } = await receitaDoAno(ANO_ANTIGO);

    expect(receita.receitaBruta).toBe(true);
    expect(receita.deducaoSoTce).toBe(-200);
  });

  it('a origem da rubrica antiga sai sem a classe: 17 e 11, nunca 41', async () => {
    const { receita } = await receitaDoAno(ANO_ANTIGO);

    expect(receita.porOrigem.map((o) => o.origem).sort()).toEqual(['11', '17']);
  });

  it('a linha de dedução do Portal da Transparência, com o arrecadado zerado, não vira discrepância', async () => {
    const { discrepancias } = await receitaDoAno(ANO_ANTIGO);

    expect(discrepancias.map((d) => [d.codigoEntidade, d.tipo])).toEqual([['319', 'so_tce']]);
  });

  it('a entidade que só o TCE-SC registra é listada com o total dela, e segue em Discrepâncias', async () => {
    const { receita, discrepancias } = await receitaDoAno(ANO_ANTIGO);

    expect(receita.entidadesSemBetha).toEqual([{ codigo: '319', entidade: 'FMS', totalTce: 300 }]);
    expect(discrepancias.find((d) => d.codigoEntidade === '319')).toMatchObject({ tipo: 'so_tce', tce: 300 });
  });

  it('a coleta no formato novo não é bruta, não tem dedução à parte nem entidade sem Portal da Transparência', async () => {
    const { receita } = await receitaDoAno(2025);

    expect(receita).toMatchObject({ receitaBruta: false, deducaoSoTce: null, entidadesSemBetha: [] });
  });
});
