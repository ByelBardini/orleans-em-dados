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

describe('Metodologia: IBGE e SICONFI', () => {
  const texto = () => document.body.textContent ?? '';
  const secao = () => screen.getByRole('heading', { name: 'IBGE e SICONFI' }).parentElement as HTMLElement;

  it('cita o IBGE e o que ele cobre', () => {
    render(<Metodologia />);

    expect(screen.getByText(/o IBGE cobre população/i)).toHaveTextContent(
      /população, território, situação do domicílio, pirâmide etária, rendimento e PIB/,
    );
  });

  it('cita o SICONFI e o anexo da despesa por função', () => {
    render(<Metodologia />);

    expect(screen.getByText(/o SICONFI cobre a despesa por função/i)).toHaveTextContent('DCA, Anexo I-E');
  });

  it('diz o selo de cada nível: total conferido, cada função fonte única', () => {
    render(<Metodologia />);

    const nivel = screen.getByText(/O total da despesa por função é comparado/);
    expect(nivel).toHaveTextContent('conferido com o TCE-SC');
    expect(nivel).toHaveTextContent('Cada função leva fonte única, sem conferência');
  });

  it('diz que Santa Catarina e Brasil não são a média simples dos municípios', () => {
    render(<Metodologia />);

    expect(texto()).toMatch(/não são a média simples\s+dos municípios/);
  });

  it('diz onde o verde e o vermelho aparecem', () => {
    render(<Metodologia />);

    expect(texto()).toMatch(/Verde e vermelho\s+só aparecem no dinheiro/);
  });

  it('explica o divisor da população', () => {
    render(<Metodologia />);

    expect(texto()).toMatch(/número do próprio ano, ou o anterior mais próximo/);
    expect(texto()).toMatch(/o texto diz qual divisor foi usado/);
  });

  it('diz que o PIB per capita de 2023 é o mesmo que o IBGE publica', () => {
    render(<Metodologia />);

    expect(texto()).toContain('R$ 59.547,10, é o mesmo que o IBGE publica');
  });

  it('explica por que o PIB per capita do Brasil difere do das Contas Nacionais', () => {
    render(<Metodologia />);

    expect(texto()).toContain('a mesma conta dá R$ 53.886,67');
    expect(texto()).toContain('As Contas Nacionais do IBGE publicam R$ 51.693,92');
    expect(texto()).toContain('porque Orleans também divide pelo Censo');
  });

  it('explica a diferença entre PIB per capita e renda', () => {
    render(<Metodologia />);

    expect(screen.getByText(/PIB per capita não é a renda do morador/)).toBeInTheDocument();
  });

  it('explica os reais nominais', () => {
    render(<Metodologia />);

    expect(screen.getByText(/valores nominais, sem correção pela inflação/)).toBeInTheDocument();
  });

  it('diz que a Câmara fica fora do total da função', () => {
    render(<Metodologia />);

    expect(screen.getByText(/A função Legislativa é a Câmara/)).toHaveTextContent('fora do total');
  });

  it('a seção fica entre os títulos da página', () => {
    render(<Metodologia />);

    expect(within(secao()).getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
  });
});

describe('Metodologia: os símbolos dos selos', () => {
  it.each([
    ['conferido com o TCE-SC', '✓'],
    ['conferido com a Betha até DD/MM', '✓'],
    ['fonte única, sem conferência', '–'],
  ])('"%s" aparece ao lado do símbolo %s', (nivel, simbolo) => {
    render(<Metodologia />);

    const item = screen.getByText(nivel).closest('li') as HTMLElement;
    expect(item.querySelector('.selo-icone')).toHaveTextContent(simbolo);
  });

  it('diz como ler o texto do símbolo', () => {
    render(<Metodologia />);

    expect(document.body).toHaveTextContent('Passe o mouse ou toque nele para ler o texto');
  });
});
