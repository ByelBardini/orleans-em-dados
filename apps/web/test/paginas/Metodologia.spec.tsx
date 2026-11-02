import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Metodologia from '../../src/paginas/Metodologia';
import { TEXTO_PROIBIDO } from '../support/conferidos';

const FRASE_PERMITIDA =
  'Diferença entre fontes pode decorrer de critério, abrangência ou atualização, e não indica, por si só, erro nem irregularidade.';

afterEach(() => vi.unstubAllGlobals());

const termo = (nome: string) => screen.getByText(nome).closest('li') as HTMLElement;

describe('Metodologia: o que o painel exibe', () => {
  it('"conferido com o TCE-SC" vem com a definição: a parte que as duas fontes registram', () => {
    render(<Metodologia />);

    expect(termo('conferido com o TCE-SC')).toHaveTextContent('as duas fontes registram');
  });

  it('"conferido com a Betha" explica o ano em curso, com a data do corte', () => {
    render(<Metodologia />);

    expect(termo('conferido com a Betha até DD/MM')).toHaveTextContent('ano em curso');
  });

  it('"fonte única, sem conferência" vem com a definição e diz o que é assim', () => {
    render(<Metodologia />);

    const item = termo('fonte única, sem conferência');
    expect(item).toHaveTextContent('Orçamento, órgão e Câmara');
    expect(item).toHaveTextContent('uma fonte só');
  });

  it('"aguardando TCE" vem como pendência de remessa', () => {
    render(<Metodologia />);

    const item = termo('aguardando TCE');
    expect(item).toHaveTextContent('ainda não recebeu');
    expect(item).toHaveTextContent('quando a remessa chegar');
  });

  it('o texto diz que igualdade entre as fontes não é auditoria', () => {
    render(<Metodologia />);

    expect(screen.getByText(/Igualdade entre as fontes não é auditoria/)).toBeInTheDocument();
  });

  it('o principal é o conferido, e pode ficar abaixo de cada fonte', () => {
    render(<Metodologia />);

    expect(screen.getByText(/pode ficar abaixo de cada uma/)).toBeInTheDocument();
  });

  it('a seção de discrepâncias é explicada, com link para o endereço novo', () => {
    render(<Metodologia />);

    const secao = screen.getByRole('heading', { name: 'O que aparece no painel' }).parentElement as HTMLElement;
    expect(within(secao).getAllByRole('link', { name: 'Discrepâncias' })[0]).toHaveAttribute('href', '#discrepancias');
  });

  it('nenhum link aponta para o endereço antigo da seção', () => {
    const { container } = render(<Metodologia />);

    expect(container.querySelector('a[href="#conferencia"]')).toBeNull();
  });

  it('nenhum termo proibido; "erro" e "irregularidade" só na frase permitida', () => {
    const { container } = render(<Metodologia />);

    const texto = container.textContent ?? '';
    expect(texto).toContain(FRASE_PERMITIDA);
    expect(texto.replace(FRASE_PERMITIDA, '')).not.toMatch(TEXTO_PROIBIDO);
  });
});
