import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Receitas from '../../src/paginas/Receitas';
import {
  api,
  CONTA_ENCERRADO,
  contaNaTela,
  natureza,
  PROPS,
  receitas,
  receitasDeExemplo,
  receitasParciais,
  receitasSemConferencia,
  TEXTO_PROIBIDO,
} from '../support/conferidos';
import { municipioIndisponivel } from '../support/municipio';

const NBSP = ' ';

afterEach(() => vi.unstubAllGlobals());

const abrir = async (receita = receitas()) => {
  api({ receita });
  const { container } = render(<Receitas {...PROPS} />);
  await screen.findByRole('heading', { level: 1 });
  return container;
};
const totais = () => screen.getByRole('region', { name: 'Totais de receita' });
const celula = (rotulo: string | RegExp) => within(totais()).getByText(rotulo).parentElement as HTMLElement;
const conta = () => screen.getByRole('group', { name: 'A conta do conferido' });

describe('Receitas com o conferido', () => {
  it('o cartão principal mostra o conferido, em milhões e por extenso', async () => {
    await abrir();

    const arrecadado = celula('Arrecadado');
    expect(arrecadado.querySelector('.numero-valor')).toHaveTextContent('1,2 mi');
    expect(arrecadado.querySelector('.numero-detalhe')).toHaveTextContent(`R$${NBSP}1.200.000,50`);
  });

  it('um valor presente só no total da Betha nunca é número principal nem aparece nas tabelas', async () => {
    const container = await abrir();

    for (const valor of container.querySelectorAll('.numero-valor')) {
      expect(valor.textContent).not.toContain('9,9');
    }
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('9,9');
    expect(screen.getByRole('table').textContent).not.toContain('9,9');
    expect(screen.getByRole('table').textContent).not.toContain('9.900.000,80');
    expect(conta()).toHaveTextContent(`= total da BethaR$${NBSP}9.900.000,80`);
  });

  it('a conta mostrada fecha: conferido + em discrepância = total da Betha', async () => {
    await abrir();

    const { parcelas, total } = contaNaTela(conta());
    expect(parcelas).toEqual([120000050, 870000030]);
    expect(total).toBe(990000080);
  });

  it('a conta leva à seção de discrepâncias', async () => {
    await abrir();

    expect(within(conta()).getByRole('link', { name: 'Ver discrepâncias →' })).toHaveAttribute(
      'href',
      '#discrepancias',
    );
  });

  it('o que só o TCE-SC registra aparece fora da conta, quando é maior que zero', async () => {
    await abrir();

    expect(
      within(conta()).getByText(`Só o TCE-SC registra mais R$${NBSP}428,37, fora desta conta.`),
    ).toBeInTheDocument();
    expect(contaNaTela(conta()).parcelas).not.toContain(42837);
  });

  it('sem nada só no TCE-SC, a linha não aparece', async () => {
    await abrir(receitas({ conferencia: { ...CONTA_ENCERRADO, diferencaTce: 0, totalTce: 1200000.5 } }));

    expect(screen.queryByText(/Só o TCE-SC registra/)).not.toBeInTheDocument();
  });

  it('conferido abaixo das duas fontes é explicado pela conta, sem aviso de problema', async () => {
    const container = await abrir();

    expect(within(conta()).getByText(/pode ficar abaixo de cada uma/)).toBeInTheDocument();
    expect(container.querySelector('.aviso')).toBeNull();
  });

  it('conferido igual a uma das fontes dispensa a explicação', async () => {
    await abrir(receitas({ conferencia: { ...CONTA_ENCERRADO, diferencaTce: 0, totalTce: 1200000.5 } }));

    expect(screen.queryByText(/pode ficar abaixo de cada uma/)).not.toBeInTheDocument();
  });

  it('exercício encerrado diz conferido com o TCE-SC, sem mês', async () => {
    await abrir();

    expect(within(celula('Arrecadado')).getByText('conferido com o TCE-SC')).toBeInTheDocument();
  });

  describe('orçado × realizado', () => {
    it('o orçamento tem o selo de fonte única', async () => {
      await abrir();

      expect(within(celula('Previsto')).getByText('fonte única, sem conferência')).toBeInTheDocument();
    });

    it('o percentual da manchete e do cartão usa o conferido, e não o total da fonte', async () => {
      await abrir();

      // 1.200.000,50 ÷ 2.000.000; com o total da Betha seriam 495%.
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('arrecadou 60,0% do que o orçamento');
      expect(celula('Realizado').querySelector('.numero-valor')).toHaveTextContent('60,0%');
    });

    it('o realizado da linha da tabela usa o conferido da rubrica', async () => {
      await abrir();

      const linha = within(screen.getByRole('table')).getByText('IPTU (exemplo)').closest('tr') as HTMLElement;
      // 500.000,25 ÷ 1.000.000
      expect(linha).toHaveTextContent('50%');
    });

    it('por morador divide o conferido pela população', async () => {
      await abrir();

      await screen.findByText('Por morador');
      // 1.200.000,50 ÷ 24.686 moradores
      expect(celula('Por morador').querySelector('.numero-valor')).toHaveTextContent('R$ 49');
      expect(celula('Por morador').querySelector('.numero-detalhe')).toHaveTextContent('IBGE, estimativa 2025');
    });

    it('sem coleta do IBGE, a linha por morador some, e o resto continua', async () => {
      api({ municipio: municipioIndisponivel() });
      render(<Receitas {...PROPS} />);
      await screen.findByRole('heading', { level: 1 });
      await act(() => new Promise((r) => setTimeout(r, 0)));

      expect(document.body).not.toHaveTextContent('por morador');
      expect(screen.queryByText('Por morador')).not.toBeInTheDocument();
      expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument();
    });
  });

  describe('tabela de rubricas', () => {
    it('14 e 8 dígitos convivem, e só a de 8 diz que está agrupada', async () => {
      await abrir();

      const tabela = within(screen.getByRole('table'));
      const de8 = tabela.getByText('FPM (exemplo)').closest('tr') as HTMLElement;
      const de14 = tabela.getByText('IPTU (exemplo)').closest('tr') as HTMLElement;
      expect(de8).toHaveTextContent('17115101');
      expect(de8).toHaveTextContent('Agrupada em 8 dígitos: há mês em discrepância.');
      expect(within(de8).getByRole('link', { name: 'Ver discrepâncias' })).toHaveAttribute('href', '#discrepancias');
      expect(de14).toHaveTextContent('11125001000000');
      expect(de14).not.toHaveTextContent('Agrupada');
    });

    it('a mesma rubrica em duas entidades soma numa linha, e continua com o nível', async () => {
      await abrir(
        receitas({
          naturezas: [
            natureza({ chave: '728|17115101', rubrica: '17115101', nivel: 8, descricao: 'FPM', arrecadadoNoMes: 10 }),
            natureza({ chave: '319|17115101', rubrica: '17115101', nivel: 8, descricao: 'FPM', entidade: 'FMS' }),
          ],
        }),
      );

      expect(within(screen.getByRole('table')).getAllByText('FPM')).toHaveLength(1);
      expect(screen.getByRole('table')).toHaveTextContent('Agrupada em 8 dígitos');
    });
  });

  describe('ano parcial', () => {
    it('o indicador diz até quando, no título', async () => {
      await abrir(receitasParciais());

      expect(within(totais()).getByText('Arrecadado até setembro de 2025')).toBeInTheDocument();
      expect(within(totais()).getByText('Realizado até setembro de 2025')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Até setembro de 2025, Orleans arrecadou');
    });

    it('o selo não diz conferido do ano todo', async () => {
      await abrir(receitasParciais());

      expect(screen.getByText('conferido com o TCE-SC até setembro')).toBeInTheDocument();
      expect(screen.queryByText('conferido com o TCE-SC')).not.toBeInTheDocument();
    });

    it('o que aguarda o TCE-SC entra na conta, e a conta fecha', async () => {
      await abrir(receitasParciais());

      expect(within(conta()).getByText('+ aguardando TCE')).toBeInTheDocument();
      const { parcelas, total } = contaNaTela(conta());
      expect(parcelas).toEqual([120000050, 30000025, 40000010]);
      expect(total).toBe(190000085);
    });

    it('o aviso é neutro e tem o valor, como pendência', async () => {
      await abrir(receitasParciais());

      const selo = screen.getByText('aguardando TCE').closest('.selo') as HTMLElement;
      expect(selo).toHaveClass('pendente');
      expect(selo).toHaveTextContent(`R$${NBSP}400.000,10 da Betha depois de setembro ainda não chegaram ao TCE-SC`);
      expect(selo.textContent).not.toMatch(TEXTO_PROIBIDO);
    });

    it('o previsto é do ano: a falta é o que ainda falta, e não o que faltou', async () => {
      await abrir(receitasParciais());

      expect(
        screen.getByText(/Faltam R\$ 0,8 milhões para os R\$ 2,0 milhões previstos para o ano/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Faltaram/)).not.toBeInTheDocument();
    });

    it('sem nada aguardando, não há aviso nem linha na conta', async () => {
      await abrir();

      expect(screen.queryByText('aguardando TCE')).not.toBeInTheDocument();
      expect(screen.queryByText('+ aguardando TCE')).not.toBeInTheDocument();
    });
  });

  it('sem conferência, explica o que falta e não mostra número', async () => {
    api({ receita: receitasSemConferencia() });
    const { container } = render(<Receitas {...PROPS} />);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Ainda não dá para conferir 2025.');
    expect(screen.getByText(/Falta publicar: receitas do TCE-SC, empenhos do TCE-SC\./)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/R\$|\d,\d/);
    expect(container.querySelector('.numero-valor')).toBeNull();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('dado de exemplo mantém os números, sem selo de conferido nem conta', async () => {
    await abrir(receitasDeExemplo());

    expect(celula('Arrecadado').querySelector('.numero-valor')).toHaveTextContent('1,2 mi');
    expect(screen.queryByText(/^conferido com/)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'A conta do conferido' })).not.toBeInTheDocument();
    expect(screen.getAllByText('dados fictícios, sem conferência').length).toBeGreaterThan(0);
    expect(screen.getByText(/DADOS FICTÍCIOS/)).toBeInTheDocument();
  });

  it.each([
    ['encerrado', receitas],
    ['parcial', receitasParciais],
    ['de exemplo', receitasDeExemplo],
    ['sem conferência', receitasSemConferencia],
  ])('ano %s: nenhum texto proibido na página', async (_nome, resposta) => {
    api({ receita: resposta() });
    const { container } = render(<Receitas {...PROPS} />);
    await screen.findByRole('heading', { level: 1 });

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });
});
