// Receita e despesa conferidas cada uma com as próprias coletas. O Farol do TCE-SC tem receitas desde 2018 e
// empenhos só desde 2023: sem a separação, de 2018 a 2022 o ano inteiro ficaria sem número.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { popularBancoDeTeste } from '../../../importadores/fixtures/src/banco-de-teste';
import { conferenciaPorArea, dadosConferidos, empenhosConferidos } from '../../src/conferencia/conferencia.service';
import { pool } from '../../src/index';

const TCE_RECEITAS = 900001;
const TCE_EMPENHOS = 900002;
const BETHA = [57153, 57140, 57170];

const tirar = (...consultas: number[]) =>
  pool.query('DELETE FROM publicacoes WHERE consulta_id = ANY($1::int[])', [consultas]);

const areas = (lista: readonly { area: string }[]) => [...new Set(lista.map((d) => d.area))].sort();

beforeEach(popularBancoDeTeste);
afterAll(() => pool.end());

describe('conferenciaPorArea', () => {
  it('com as cinco coletas, as duas áreas têm os mesmos números de dadosConferidos', async () => {
    const [porArea, juntos] = await Promise.all([conferenciaPorArea(2025), dadosConferidos(2025)]);
    if (!juntos.disponivel || !porArea.receita.disponivel || !porArea.despesa.disponivel) {
      throw new Error('fixture deveria estar disponível');
    }

    expect(porArea.receita.receita).toEqual(juntos.receita);
    expect(porArea.despesa.despesa).toEqual(juntos.despesa);
    expect(areas(porArea.receita.discrepancias)).toEqual(['receita']);
    // A fixture de 2025 só tem casos de empenho do lado da despesa; nenhum de receita vai para lá.
    expect(areas(porArea.despesa.discrepancias)).toEqual(['empenho']);
    expect(porArea.receita.discrepancias.length + porArea.despesa.discrepancias.length).toBe(
      juntos.discrepancias.length,
    );
  });

  it('sem os empenhos do TCE-SC, a receita continua conferida, igual, e a despesa diz o que falta', async () => {
    const antes = await conferenciaPorArea(2025);
    await tirar(TCE_EMPENHOS);

    const depois = await conferenciaPorArea(2025);

    if (!antes.receita.disponivel || !depois.receita.disponivel) throw new Error('a receita deveria estar disponível');
    expect(depois.receita.receita).toEqual(antes.receita.receita);
    expect(depois.receita.discrepancias).toEqual(antes.receita.discrepancias);
    expect(depois.despesa).toEqual({ disponivel: false, faltando: ['tcesc_empenhos'] });
  });

  it('sem as receitas do TCE-SC, as duas áreas ficam sem conferência: o corte da despesa vem do mês da receita', async () => {
    await tirar(TCE_RECEITAS);

    const { receita, despesa } = await conferenciaPorArea(2025);

    expect(receita).toEqual({ disponivel: false, faltando: ['tcesc_receitas'] });
    expect(despesa).toEqual({ disponivel: false, faltando: ['tcesc_receitas'] });
  });

  it('só com o Portal da Transparência, cada área lista as próprias coletas do TCE-SC que faltam', async () => {
    await tirar(TCE_RECEITAS, TCE_EMPENHOS);

    const { receita, despesa } = await conferenciaPorArea(2025);

    expect(receita).toEqual({ disponivel: false, faltando: ['tcesc_receitas'] });
    expect(despesa).toEqual({ disponivel: false, faltando: ['tcesc_receitas', 'tcesc_empenhos'] });
  });

  it('sem o Portal da Transparência, as duas áreas listam as consultas dela', async () => {
    await tirar(...BETHA);

    const { receita, despesa } = await conferenciaPorArea(2025);

    expect(receita).toEqual({ disponivel: false, faltando: ['receitas'] });
    expect(despesa).toEqual({ disponivel: false, faltando: ['empenhos', 'despesas'] });
  });
});

describe('dadosConferidos e empenhosConferidos sem os empenhos do TCE-SC', () => {
  it('dadosConferidos continua exigindo as cinco coletas', async () => {
    await tirar(TCE_EMPENHOS);

    expect(await dadosConferidos(2025)).toMatchObject({ disponivel: false, faltando: ['tcesc_empenhos'] });
  });

  it('empenhosConferidos fica indisponível, porque é a despesa', async () => {
    await tirar(TCE_EMPENHOS);

    expect(await empenhosConferidos(2025)).toMatchObject({ disponivel: false, faltando: ['tcesc_empenhos'] });
  });

  it('empenhosConferidos não depende das receitas do Portal da Transparência', async () => {
    await tirar(57153);

    expect(await empenhosConferidos(2025)).toMatchObject({ disponivel: true });
  });
});
