import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Financas from '../../src/paginas/Financas';
import {
  api,
  contaNaTela,
  despesas,
  despesasDeExemplo,
  despesasFonteUnica,
  despesasForaDaFonte,
  empenhosFonteUnica,
  empenhosForaDaFonte,
  despesasParciais,
  despesasSemConferencia,
  ENTIDADE_FORA,
  entidadeDaDespesa,
  PREFEITURA_SEM_BETHA,
  PROPS,
  receitas,
  receitasBrutas,
  receitasComLacuna,
  receitasDeExemplo,
  receitasFonteUnica,
  receitasSemConferido,
  receitasParciais,
  receitasSemConferencia,
  TEXTO_PROIBIDO,
} from '../support/conferidos';
import { municipioIndisponivel } from '../support/municipio';

afterEach(() => vi.unstubAllGlobals());

const abrir = async (respostas: Parameters<typeof api>[0] = {}) => {
  api(respostas);
  const { container } = render(<Financas {...PROPS} />);
  await screen.findByRole('heading', { level: 1 });
  return container;
};
const totais = () => screen.getByRole('region', { name: 'Totais do ano' });
const celula = (rotulo: string | RegExp) => within(totais()).getByText(rotulo).parentElement as HTMLElement;
const parciais = { receita: receitasParciais(), despesa: despesasParciais() };
const deExemplo = { receita: receitasDeExemplo(), despesa: despesasDeExemplo() };
const semConferencia = { receita: receitasSemConferencia(), despesa: despesasSemConferencia() };

describe('Finanças com o conferido', () => {
  it('manchete e cartão falam do conferido, e não do total da fonte', async () => {
    await abrir();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Em 2025, Orleans arrecadou R$ 1,2 milhões e empenhou R$ 10,8 milhões em despesas.',
    );
    expect(celula('Arrecadado').querySelector('.numero-valor')).toHaveTextContent('1,2 mi');
    expect(celula('Empenhado').querySelector('.numero-valor')).toHaveTextContent('10,8 mi');
  });

  it('o total só do Portal da Transparência fica na conta, nunca como número principal', async () => {
    const container = await abrir();

    for (const valor of container.querySelectorAll('.numero-valor')) {
      expect(valor.textContent).not.toContain('9,9');
    }
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('9,9');
  });

  it('a conta da receita e a da despesa fecham, abaixo dos cartões', async () => {
    await abrir();

    const secao = screen
      .getByRole('heading', { name: 'Como se chega a estes números' })
      .closest('section') as HTMLElement;
    expect(secao).toHaveTextContent('Tribunal de Contas do Estado');
    expect(within(totais()).queryByRole('group')).not.toBeInTheDocument();
    const daReceita = within(secao).getByRole('group', { name: 'A conta da receita' });
    expect(contaNaTela(daReceita)).toEqual({ parcelas: [120000050, 870000030], total: 990000080 });
    const daDespesa = within(secao).getByRole('group', { name: 'A conta da despesa' });
    expect(contaNaTela(daDespesa)).toEqual({ parcelas: [1079165253, 12388732], total: 1091553985 });
    expect(within(daDespesa).getByRole('link', { name: 'Ver discrepâncias →' })).toHaveAttribute(
      'href',
      '/discrepancias',
    );
  });

  it('o previsto usa o conferido no percentual, e declara que é fonte única', async () => {
    await abrir();

    expect(celula('Arrecadado').querySelector('.numero-detalhe')).toHaveTextContent(
      '60,0% dos R$ 2,0 mi previstos para o ano (orçamento: fonte única, sem conferência)',
    );
  });

  it('por morador usa o conferido: a parte própria e, com os repasses, o total', async () => {
    await abrir();

    // 500.000,25 de impostos ÷ 24.686 moradores; 1.200.000,50 ÷ 24.686.
    await within(totais()).findByText('Arrecadado aqui, por morador');
    const morador = celula('Arrecadado aqui, por morador');
    expect(morador.querySelector('.numero-valor')).toHaveTextContent('R$ 20');
    expect(morador.querySelector('.numero-detalhe')).toHaveTextContent('Com os repasses, R$ 49');
    expect(morador.querySelector('.numero-detalhe')).toHaveTextContent('24.686 moradores (IBGE, estimativa 2025)');
  });

  it('sem coleta do IBGE, a linha por morador some, sem erro na tela', async () => {
    await abrir({ municipio: municipioIndisponivel() });
    await act(() => new Promise((r) => setTimeout(r, 0)));

    expect(within(totais()).queryByText('Arrecadado aqui, por morador')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('por morador');
    expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument();
  });

  it('com a rota da população fora do ar, receita e despesa continuam', async () => {
    await abrir({ municipio: null });
    await act(() => new Promise((r) => setTimeout(r, 0)));

    expect(celula('Arrecadado').querySelector('.numero-valor')).toHaveTextContent('1,2 mi');
    expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument();
  });

  it('a Câmara fica à parte, com selo de fonte única e sem somar ao conferido', async () => {
    await abrir();

    const linha = screen.getByText('Câmara Municipal (exemplo)').closest('li') as HTMLElement;
    expect(within(linha).getByText('fonte única, sem conferência')).toBeInTheDocument();
    expect(linha).toHaveTextContent('à parte da soma');
    expect(screen.getByText(/A Câmara Municipal fica à parte/)).toBeInTheDocument();
    // 10,8 mi + 2,7 mi
    expect(screen.queryByText(/R\$ 13,5 milhões/)).not.toBeInTheDocument();
  });

  it.each([
    ['Quem gasta', '10,8 mi'],
    ['De onde vem', '0,5 mi'],
  ])('a lista "%s" diz a unidade do valor, para não parecer percentual', async (titulo, valor) => {
    await abrir();

    const secao = screen.getByRole('heading', { name: titulo }).closest('section') as HTMLElement;
    expect(secao.querySelector('.lp-valor')).toHaveTextContent(valor);
  });

  it('entidade fora da soma aparece sem número, com aviso e link', async () => {
    await abrir({ despesa: despesas({ porEntidade: [entidadeDaDespesa(), ENTIDADE_FORA] }) });

    const linha = screen.getByText('Fundo de Saúde (exemplo)').closest('li') as HTMLElement;
    expect(linha.querySelector('.lp-valor')).toHaveTextContent('—');
    expect(linha).toHaveTextContent('fora da soma');
    expect(within(linha).getByRole('link')).toHaveAttribute('href', '/discrepancias');
  });

  it('recorte de entidade fora da soma não vira zero', async () => {
    await abrir({
      despesa: despesas({
        totais: { orcadoAtualizado: 100, empenhado: null, liquidado: null, pago: null },
        porEntidade: [ENTIDADE_FORA],
      }),
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A despesa deste recorte está fora da soma');
    expect(celula('Empenhado').querySelector('.numero-valor')).toHaveTextContent('—');
    expect(within(totais()).queryByText('Pago')).not.toBeInTheDocument();
  });

  describe('ano parcial', () => {
    it('receita até o mês, despesa até a data, no título e na manchete', async () => {
      await abrir(parciais);

      expect(within(totais()).getByText('Arrecadado até setembro de 2025')).toBeInTheDocument();
      expect(within(totais()).getByText('Empenhado até 30/09/2025')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Até setembro de 2025, Orleans arrecadou R$ 1,2 milhões e, até 30/09, empenhou R$ 10,8 milhões em despesas.',
      );
    });

    it('selos dizem o nível de cada um, sem conferido do ano todo', async () => {
      await abrir(parciais);

      expect(screen.getByText('conferido com o TCE-SC até setembro')).toBeInTheDocument();
      expect(screen.getByText('conferido com o Portal da Transparência até 30/09')).toBeInTheDocument();
      expect(screen.queryByText('conferido com o TCE-SC')).not.toBeInTheDocument();
    });

    it('o texto do pago diz até quando, e não "até agora"', async () => {
      await abrir(parciais);

      expect(screen.getByText(/já estava pago até 30\/09\./)).toBeInTheDocument();
    });

    it('o que aguarda o TCE-SC entra na conta da receita, com o mês e como pendência', async () => {
      await abrir(parciais);

      const conta = screen.getByRole('group', { name: 'A conta da receita' });
      const parcela = within(conta).getByText('+ aguardando TCE').parentElement as HTMLElement;
      expect(parcela).toHaveTextContent('Depois de setembro, ainda não chegou ao TCE-SC');
      expect(parcela.textContent).not.toMatch(TEXTO_PROIBIDO);
    });

    it('a despesa em curso não tem conta, e a da receita continua', async () => {
      await abrir(parciais);

      expect(screen.getByRole('group', { name: 'A conta da receita' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'A conta da despesa' })).not.toBeInTheDocument();
    });
  });

  it('sem conferência, explica a falta, mantém os filtros e não mostra número', async () => {
    const container = await abrir(semConferencia);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ainda não dá para conferir 2025.');
    expect(container.querySelector('.numero-valor')).toBeNull();
    expect(container.textContent).not.toMatch(/R\$|\d,\d/);
  });

  it('dado de exemplo mantém os números, sem selo de conferido nem conta', async () => {
    await abrir(deExemplo);

    expect(celula('Arrecadado').querySelector('.numero-valor')).toHaveTextContent('1,2 mi');
    expect(screen.queryByText(/^conferido com/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Como se chega a estes números' })).not.toBeInTheDocument();
    expect(screen.getAllByText('dados fictícios, sem conferência')).toHaveLength(2);
  });

  it('com a coleção de receitas em qualquer estado, nenhum texto proibido', async () => {
    for (const respostas of [{ receita: receitas() }, parciais, deExemplo, semConferencia]) {
      api(respostas);
      const { container, unmount } = render(<Financas {...PROPS} />);
      await screen.findByRole('heading', { level: 1 });
      expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
      unmount();
    }
  });
});

describe('Finanças com a receita só do Portal da Transparência, no ano que o TCE-SC não publica', () => {
  it('o arrecadado tem número e o selo de fonte única, e o aviso fica acima da manchete', async () => {
    await abrir({ receita: receitasFonteUnica(), despesa: despesasForaDaFonte(), empenhos: empenhosForaDaFonte() });

    expect(celula('Arrecadado').querySelector('.numero-valor')).toHaveTextContent('1,2 mi');
    expect(within(celula('Arrecadado')).getByText('fonte única, sem conferência')).toBeInTheDocument();
    const aviso = screen.getByText(/^O TCE-SC não publica as receitas de 2025\. Os números/);
    expect(
      aviso.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('não mostra a conta da receita', async () => {
    await abrir({ receita: receitasFonteUnica(), despesa: despesasForaDaFonte(), empenhos: empenhosForaDaFonte() });

    expect(screen.queryByRole('group', { name: 'A conta da receita' })).not.toBeInTheDocument();
  });
});

describe('Finanças com a receita bruta e a lacuna do Portal da Transparência', () => {
  it('a receita bruta é rotulada, e a dedução do TCE-SC sai em nota, fora do conferido', async () => {
    await abrir({ receita: receitasBrutas(-790000.4) });

    expect(screen.getByText(/receita bruta, antes da dedução do FUNDEB/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'A conta da receita' })).toHaveTextContent(
      /O TCE-SC registra a dedução do FUNDEB de R\$\s790\.000,40/,
    );
  });

  it('a entidade que o Portal da Transparência não publica tem aviso em destaque, com link para Discrepâncias', async () => {
    await abrir({ receita: receitasComLacuna() });

    const aviso = screen
      .getByText(/O Portal da Transparência não publica a receita da Prefeitura em 2025/)
      .closest('.aviso');
    expect(within(aviso as HTMLElement).getByRole('link', { name: /Ver discrepâncias/ })).toBeInTheDocument();
  });

  it('sem nada conferido, o cartão do arrecadado não mostra R$ 0,0', async () => {
    await abrir({ receita: receitasSemConferido([PREFEITURA_SEM_BETHA]) });

    expect(celula('Arrecadado').querySelector('.numero-valor')).not.toHaveTextContent('0,0');
    expect(celula('Arrecadado')).toHaveTextContent(
      'O Portal da Transparência não publica a receita da Prefeitura em 2025',
    );
  });
});

// De 2018 a 2022 o Farol tem as receitas e não os empenhos: a receita é conferida, a despesa é só da Betha.
describe('Finanças com a receita conferida e a despesa em fonte única', () => {
  const abrirDespesaUnica = () => abrir({ despesa: despesasFonteUnica(), empenhos: empenhosFonteUnica() });

  it('cada cartão tem o próprio selo: o arrecadado conferido, o empenhado fonte única', async () => {
    await abrirDespesaUnica();

    expect(within(celula('Arrecadado')).getByText(/^conferido com o TCE-SC/)).toBeInTheDocument();
    expect(within(celula('Empenhado')).getByText('fonte única, sem conferência')).toBeInTheDocument();
    expect(celula('Empenhado').querySelector('.numero-valor')).toHaveTextContent('10,8 mi');
  });

  it('o aviso diz que o TCE-SC não publica os empenhos e que só a despesa é do Portal da Transparência', async () => {
    await abrirDespesaUnica();

    expect(
      screen.getByText(
        'O TCE-SC não publica os empenhos de 2025. Os números da despesa são só do Portal da Transparência, sem conferência.',
      ),
    ).toBeInTheDocument();
  });

  it('"Quem gasta" e "Para onde vai cada R$ 100" voltam', async () => {
    await abrirDespesaUnica();

    expect(screen.getByRole('heading', { name: 'Para onde vai cada R$ 100' })).toBeInTheDocument();
    const quem = screen.getByRole('heading', { name: 'Quem gasta' }).closest('section') as HTMLElement;
    expect(quem).not.toHaveTextContent('O TCE-SC não publica');
  });

  // Mordida: a despesa em fonte única não tem conta, nem o link do conferido.
  it('o empenhado não leva a Discrepâncias, e só a receita tem conta', async () => {
    await abrirDespesaUnica();

    expect(within(celula('Empenhado')).queryByRole('link', { name: /Ver discrepâncias/ })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'A conta da receita' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'A conta da despesa' })).not.toBeInTheDocument();
  });

  it('o rodapé não diz que os empenhos foram casados com o TCE-SC', async () => {
    await abrirDespesaUnica();

    expect(document.body).not.toHaveTextContent('só dos empenhos casados com o TCE-SC');
  });
});

describe('Finanças de um ano só do Portal da Transparência, na receita e na despesa', () => {
  it('um aviso só, com as duas consultas que o TCE-SC não publica', async () => {
    const despesa = despesasFonteUnica();
    await abrir({
      receita: receitasFonteUnica(),
      despesa: {
        ...despesa,
        conferencia: {
          ...despesa.conferencia,
          faltando: ['tcesc_receitas', 'tcesc_empenhos'],
          foraDaFonte: ['tcesc_receitas', 'tcesc_empenhos'],
        },
      },
      empenhos: empenhosFonteUnica(),
    });

    expect(
      screen.getByText(
        'O TCE-SC não publica as receitas nem os empenhos de 2025. Os números são só do Portal da Transparência, sem conferência.',
      ),
    ).toBeInTheDocument();
    expect(within(totais()).getAllByText('fonte única, sem conferência')).toHaveLength(2);
  });
});

// O estado de antes da fonte única: a despesa sem número nenhum.
describe('Finanças com a receita conferida e a despesa fora da fonte', () => {
  const abrirSemDespesa = () => abrir({ despesa: despesasForaDaFonte(), empenhos: empenhosForaDaFonte() });

  it('a receita aparece conferida, com o número e o selo', async () => {
    await abrirSemDespesa();

    expect(celula('Arrecadado').querySelector('.numero-valor')).not.toBeNull();
    expect(within(totais()).getAllByText(/^conferido com o TCE-SC/).length).toBeGreaterThan(0);
  });

  it('o empenhado diz que o TCE-SC não publica os empenhos, e não "fora da soma"', async () => {
    await abrirSemDespesa();

    expect(celula('Empenhado')).toHaveTextContent('O TCE-SC não publica os empenhos de 2025');
    expect(document.body).not.toHaveTextContent('Fora da soma');
  });

  it('a manchete fala da receita e diz o motivo da despesa', async () => {
    await abrirSemDespesa();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('O TCE-SC não publica os empenhos de 2025');
  });

  it('sem empenhos, não há "cada R$ 100" nem a série de empenhado no mês a mês', async () => {
    await abrirSemDespesa();

    expect(screen.queryByRole('heading', { name: 'Para onde vai cada R$ 100' })).not.toBeInTheDocument();
    const mes = screen.getByRole('heading', { name: 'Mês a mês' }).closest('section') as HTMLElement;
    expect(within(mes).queryByText('Empenhado')).not.toBeInTheDocument();
    expect(mes.querySelectorAll('.barras-mes-grupo .vermelho')).toHaveLength(0);
  });

  it('nada de texto proibido', async () => {
    const container = await abrirSemDespesa();

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });
});
