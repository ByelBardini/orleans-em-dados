import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Despesas from '../../src/paginas/Despesas';
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
  resumoDeEmpenhos,
  TEXTO_PROIBIDO,
} from '../support/conferidos';
import { municipioIndisponivel } from '../support/municipio';

const NBSP = ' ';

afterEach(() => vi.unstubAllGlobals());

const abrir = async (respostas: Parameters<typeof api>[0] = {}) => {
  api(respostas);
  const { container } = render(<Despesas {...PROPS} />);
  await screen.findByRole('heading', { level: 1 });
  return container;
};
const totais = () => screen.getByRole('region', { name: 'Totais de despesa' });
const celula = (rotulo: string | RegExp) => within(totais()).getByText(rotulo).parentElement as HTMLElement;
const porEntidade = () => screen.getByRole('region', { name: 'Despesa por entidade' });
const linhaDa = (nome: string) => within(porEntidade()).getByText(nome).closest('tr') as HTMLElement;

describe('Despesas com o conferido', () => {
  it('sem coleta do IBGE, o "por morador" some, e os totais continuam', async () => {
    await abrir({ municipio: municipioIndisponivel() });
    await act(() => new Promise((r) => setTimeout(r, 0)));

    expect(document.body).not.toHaveTextContent('por morador');
    expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument();
    expect(celula('Empenhado').querySelector('.numero-valor')).toHaveTextContent('10,8 mi');
  });

  it('a entidade mostra o valor sem as linhas retiradas, e não o total da Betha', async () => {
    await abrir();

    const samae = linhaDa('SAMAE (exemplo)');
    expect(samae).toHaveTextContent(`R$${NBSP}10.791.652,53`);
    expect(samae).not.toHaveTextContent('10.915.539,85');
  });

  it('o total da Betha fica só na conta, e a conta fecha', async () => {
    const container = await abrir();

    const conta = within(celula('Empenhado')).getByRole('group', { name: 'A conta do conferido' });
    expect(contaNaTela(conta)).toEqual({ parcelas: [1079165253, 12388732], total: 1091553985 });
    expect(within(conta).getByRole('link', { name: 'Ver discrepâncias →' })).toHaveAttribute('href', '#discrepancias');
    expect(celula('Empenhado').querySelector('.numero-valor')).toHaveTextContent('10,8 mi');
    expect(container.textContent?.match(/10\.915\.539,85/g)).toHaveLength(1);
  });

  it('exercício encerrado tem o selo do TCE-SC', async () => {
    await abrir();

    expect(within(celula('Empenhado')).getByText('conferido com o TCE-SC')).toBeInTheDocument();
  });

  describe('entidade não conferida', () => {
    const comFora = () => ({ despesa: despesas({ porEntidade: [entidadeDaDespesa(), ENTIDADE_FORA] }) });

    it('aparece fora da soma, sem número, com aviso e link', async () => {
      await abrir(comFora());

      const fora = linhaDa('Fundo de Saúde (exemplo)');
      expect(fora).toHaveTextContent('Fora da soma.');
      expect(fora).toHaveTextContent('—');
      expect(within(fora).getByRole('link')).toHaveAttribute('href', '#discrepancias');
      const aviso = screen.getByText('Fora da soma:').closest('p') as HTMLElement;
      expect(aviso).toHaveTextContent('Fundo de Saúde (exemplo)');
      expect(within(aviso).getByRole('link')).toHaveAttribute('href', '#discrepancias');
    });

    it('o aviso é neutro, sem a cor de problema', async () => {
      await abrir(comFora());

      expect(screen.getByText('Fora da soma:').closest('p')).toHaveClass('aviso-neutro');
    });

    it('os totais não mudam com ela', async () => {
      await abrir(comFora());

      expect(celula('Empenhado').querySelector('.numero-valor')).toHaveTextContent('10,8 mi');
    });

    it('no recorte dela, não há total nem zero', async () => {
      await abrir({
        despesa: despesas({
          totais: { orcadoAtualizado: 100, empenhado: null, liquidado: null, pago: null },
          porEntidade: [ENTIDADE_FORA],
        }),
      });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('fora da soma conferida');
      expect(screen.queryByRole('region', { name: 'Totais de despesa' })).not.toBeInTheDocument();
    });

    it('sem entidade fora, não há aviso', async () => {
      await abrir();

      expect(screen.queryByText('Fora da soma:')).not.toBeInTheDocument();
    });
  });

  describe('ano em curso', () => {
    const emCurso = () => ({
      despesa: despesasParciais(),
      empenhos: resumoDeEmpenhos({ excluidos: 956, aguardandoTce: 956, emDiscrepancia: 0 }),
    });

    it('o selo diz conferido com a Betha até DD/MM, com os valores do TCE-SC', async () => {
      await abrir(emCurso());

      const selo = within(celula('Empenhado até 30/09/2025')).getByText('conferido com a Betha até 30/09');
      expect(selo.closest('.selo')).toHaveTextContent('Valores do TCE-SC.');
      expect(screen.queryByText('conferido com o TCE-SC')).not.toBeInTheDocument();
    });

    it('não soma o que aguarda, valor original da Betha, ao líquido do TCE-SC', async () => {
      await abrir(emCurso());

      expect(screen.queryByRole('group', { name: 'A conta do conferido' })).not.toBeInTheDocument();
    });

    it('aguardando é pendência, com a quantidade e o valor', async () => {
      await abrir(emCurso());

      const selo = screen.getByText('aguardando TCE').closest('.selo') as HTMLElement;
      expect(selo).toHaveClass('pendente');
      expect(selo).toHaveTextContent(
        `956 empenhos da Betha depois de 30/09/2025 (R$${NBSP}14.233.097,48 no valor original)`,
      );
    });

    // Regressão: o texto dizia que os 956 de 2026 eram versões antigas ou repetidas (02/11/2026).
    it('quem aguarda o TCE-SC não é chamado de discrepância', async () => {
      await abrir(emCurso());

      const nota = screen.getByText(/956 empenhos aguardam o TCE-SC/);
      expect(nota).not.toHaveTextContent('em discrepância');
      expect(nota).not.toHaveTextContent('versões antigas');
      expect(nota).not.toHaveTextContent('com um selo');
    });

    it('aguardando e em discrepância saem separados, cada um com o seu número', async () => {
      await abrir({
        despesa: despesasParciais(),
        empenhos: resumoDeEmpenhos({ excluidos: 963, aguardandoTce: 956, emDiscrepancia: 7 }),
      });

      const nota = screen.getByText(/956 empenhos aguardam o TCE-SC/);
      expect(nota).toHaveTextContent('7 estão em discrepância');
      expect(within(nota).getByRole('link', { name: 'ver discrepâncias' })).toHaveAttribute('href', '#discrepancias');
    });
  });

  it('exercício encerrado com registros de fora só fala em discrepância', async () => {
    await abrir({ empenhos: resumoDeEmpenhos({ excluidos: 19, aguardandoTce: 0, emDiscrepancia: 19 }) });

    const nota = screen.getByText(/19 estão em discrepância/);
    expect(nota).not.toHaveTextContent('aguardam');
  });

  it('a Câmara tem selo de fonte única, fica à parte e não soma com as entidades', async () => {
    await abrir();

    const secao = screen.getByRole('heading', { name: 'Câmara Municipal' }).closest('section') as HTMLElement;
    expect(within(secao).getByText('fonte única, sem conferência')).toBeInTheDocument();
    expect(secao).toHaveTextContent('fora dos totais acima');
    // 10.791.652,53 + 2.718.927,41
    expect(secao).not.toHaveTextContent('13.510.579,94');
    expect(within(porEntidade()).queryByText('Câmara Municipal (exemplo)')).not.toBeInTheDocument();
  });

  describe('lista de empenhos', () => {
    const listaDeEmpenhos = async () => {
      await abrir();
      return (await screen.findByText('Agua Exemplo LTDA', { selector: 'strong' })).closest('table') as HTMLElement;
    };

    it('tem as colunas de empenhado, liquidado e pago', async () => {
      const tabela = await listaDeEmpenhos();

      const colunas = within(tabela)
        .getAllByRole('columnheader')
        .map((c) => c.textContent);
      expect(colunas).toEqual(['Empenho', 'Órgão', 'Credor e descrição', 'Empenhado', 'Liquidado', 'Pago', 'Situação']);
    });

    it('cada coluna traz o seu valor: o original da Betha e a execução do TCE-SC', async () => {
      const tabela = await listaDeEmpenhos();

      const celulas = [...(within(tabela).getByText('Nº 1').closest('tr') as HTMLElement).querySelectorAll('td.num')];
      expect(celulas.map((c) => c.textContent)).toEqual(['1.000,00', '850,10', '750,05']);
    });

    it('diz o nível da conferência, junto do título', async () => {
      await listaDeEmpenhos();

      const secao = screen.getByRole('heading', { name: 'Todos os empenhos' }).closest('section') as HTMLElement;
      expect(within(secao).getByText('conferido com o TCE-SC')).toBeInTheDocument();
    });

    it('mantém o que já mostrava de credor', async () => {
      const tabela = await listaDeEmpenhos();

      expect(within(tabela).getByText('Agua Exemplo LTDA')).toBeInTheDocument();
    });
  });

  it('sem conferência, explica a falta e não mostra número', async () => {
    const container = await abrir({ despesa: despesasSemConferencia() });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ainda não dá para conferir 2025.');
    expect(container.querySelector('.numero-valor')).toBeNull();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/R\$|\d,\d/);
  });

  it('dado de exemplo mantém os números, sem selo de conferido nem conta', async () => {
    await abrir({ despesa: despesasDeExemplo() });

    expect(celula('Empenhado').querySelector('.numero-valor')).toHaveTextContent('10,8 mi');
    expect(screen.queryByText(/^conferido com/)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'A conta do conferido' })).not.toBeInTheDocument();
    expect(screen.getAllByText('dados fictícios, sem conferência').length).toBeGreaterThan(0);
    expect(screen.queryByText('Fora da soma:')).not.toBeInTheDocument();
  });

  it.each([
    ['encerrado', despesas],
    ['parcial', despesasParciais],
    ['de exemplo', despesasDeExemplo],
    ['sem conferência', despesasSemConferencia],
  ])('ano %s: nenhum texto proibido na página', async (_nome, resposta) => {
    api({ despesa: resposta(), empenhos: resumoDeEmpenhos({ aguardandoTce: 2, emDiscrepancia: 3, excluidos: 5 }) });
    const { container } = render(<Despesas {...PROPS} />);
    await screen.findByRole('heading', { level: 1 });

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });
});
