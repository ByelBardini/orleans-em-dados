import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Financas from '../../src/paginas/Financas';
import {
  api,
  contaNaTela,
  despesas,
  despesasDeExemplo,
  despesasParciais,
  despesasSemConferencia,
  ENTIDADE_FORA,
  entidadeDaDespesa,
  PROPS,
  receitas,
  receitasDeExemplo,
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

describe('Visão geral com o conferido', () => {
  it('manchete e cartão falam do conferido, e não do total da fonte', async () => {
    await abrir();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Em 2025, Orleans arrecadou R$ 1,2 milhões e empenhou R$ 10,8 milhões em despesas.',
    );
    expect(celula('Arrecadado').querySelector('.numero-valor')).toHaveTextContent('1,2 mi');
    expect(celula('Empenhado').querySelector('.numero-valor')).toHaveTextContent('10,8 mi');
  });

  it('o total só da Betha fica na conta, nunca como número principal', async () => {
    const container = await abrir();

    for (const valor of container.querySelectorAll('.numero-valor')) {
      expect(valor.textContent).not.toContain('9,9');
    }
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('9,9');
  });

  it('a conta da receita e a da despesa fecham, cada uma no seu cartão', async () => {
    await abrir();

    const daReceita = within(celula('Arrecadado')).getByRole('group', { name: 'A conta do conferido' });
    expect(contaNaTela(daReceita)).toEqual({ parcelas: [120000050, 870000030], total: 990000080 });
    const daDespesa = within(celula('Empenhado')).getByRole('group', { name: 'A conta do conferido' });
    expect(contaNaTela(daDespesa)).toEqual({ parcelas: [1079165253, 12388732], total: 1091553985 });
    expect(within(daDespesa).getByRole('link', { name: 'Ver discrepâncias →' })).toHaveAttribute(
      'href',
      '#discrepancias',
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
    expect(within(linha).getByRole('link')).toHaveAttribute('href', '#discrepancias');
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
      expect(screen.getByText('conferido com a Betha até 30/09')).toBeInTheDocument();
      expect(screen.queryByText('conferido com o TCE-SC')).not.toBeInTheDocument();
    });

    it('o texto do pago diz até quando, e não "até agora"', async () => {
      await abrir(parciais);

      expect(screen.getByText(/já estava pago até 30\/09\./)).toBeInTheDocument();
    });

    it('avisa o valor que aguarda o TCE-SC, em tom de pendência', async () => {
      await abrir(parciais);

      expect(screen.getByText('aguardando TCE').closest('.selo')).toHaveClass('pendente');
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
    expect(screen.queryByRole('group', { name: 'A conta do conferido' })).not.toBeInTheDocument();
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
