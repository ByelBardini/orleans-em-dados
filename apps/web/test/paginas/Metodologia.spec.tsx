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

describe('Metodologia: educação', () => {
  // A página é plana: o trecho de uma seção vai do título até o próximo título do mesmo nível.
  const secaoDe = (nome: string) => {
    const titulo = screen.getByRole('heading', { name: nome, level: 2 });
    let texto = '';
    for (let el = titulo.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) {
      texto += ` ${el.textContent}`;
    }
    return texto.replace(/\s+/g, ' ');
  };

  it('rede diz quem mantém a escola, o que a pública soma e por que se compara rede com rede', () => {
    render(<Metodologia />);

    const secao = secaoDe('Educação: o que é rede');
    expect(secao).toContain('quem mantém a escola');
    expect(secao).toMatch(/pública soma municipal, estadual e federal/);
    expect(secao).toContain('muda com o peso de cada rede');
    expect(secao).toContain('o Censo');
  });

  it.each([
    ['Aprovação', 'termina o ano e passa para a série seguinte'],
    ['Reprovação', 'termina o ano, mas não passa'],
    ['Abandono', 'sai da escola durante o ano'],
    ['Evasão', 'não se matricula no ano seguinte'],
  ])('fluxo: "%s" é definido como "%s"', (nome, definicao) => {
    render(<Metodologia />);

    expect(termo(nome)).toHaveTextContent(definicao);
  });

  it('evasão é de outro período e não se soma às outras três taxas', () => {
    render(<Metodologia />);

    const secao = secaoDe('Educação: como termina o ano');
    expect(secao).toContain('2021–2022');
    expect(secao).toContain('não se soma');
  });

  it('IDEB junta prova e aprovação, em escala de 0 a 10, e ano sem dado é lacuna', () => {
    render(<Metodologia />);

    const secao = secaoDe('Educação: IDEB');
    expect(secao).toContain('junta a nota da prova e a aprovação');
    expect(secao).toContain('de 0 a 10');
    expect(secao).toContain('lacuna, nunca zero');
  });

  it('meta nacional × dado: diz a lei, as faixas e que o dado do Censo é anterior a ela', () => {
    render(<Metodologia />);

    const secao = secaoDe('Educação: meta nacional e dado de Orleans');
    expect(screen.getByRole('link', { name: 'Lei 15.388/2026' })).toHaveAttribute(
      'href',
      'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/L15388.htm',
    );
    expect(secao).toContain('toda a demanda manifesta por creche');
    expect(secao).toContain('ao menos 60% das crianças');
    expect(secao).toContain('universalizar a pré-escola');
    expect(secao).toContain('De 6 a 17 anos: universalizar');
    expect(secao).toContain('A meta é nacional');
    expect(secao).toContain('Censo 2022, anterior à lei');
  });

  it('declarado × medido: a resposta do município leva quem informou, e fila sem número não é zero', () => {
    render(<Metodologia />);

    const secao = secaoDe('Educação: declarado e medido');
    expect(secao).toContain('a Prefeitura informou ao MEC');
    expect(secao).toContain('Medido');
    expect(secao).toContain('Declarado');
    expect(secao).toContain('sem dado, nunca zero');
  });

  it.each([
    ['nada por escola', 'Nenhum número por escola'],
    ['grupos abaixo de 5', 'Contagem abaixo de 5 pessoas sai como “menos de 5”'],
    ['mediana com poucas pessoas', 'Mediana com menos de 10 pessoas'],
    ['cor ou raça e deficiência', 'Cor ou raça e deficiência de Orleans'],
    ['ENEM de rede pequena', 'Média do ENEM de rede com menos de 2 escolas'],
    ['dado pessoal', 'Nome, CPF, número de inscrição'],
  ])('o que não é publicado: %s', (_cenario, frase) => {
    render(<Metodologia />);

    expect(secaoDe('Educação: o que não é publicado')).toContain(frase);
  });

  it('"conferido com a Betha", sem corte, é o gasto da função 12 igual à soma das ações, e cada ação não é conferida', () => {
    render(<Metodologia />);

    const item = termo('conferido com a Betha');
    expect(item.querySelector('.selo-icone')).toHaveTextContent('✓');
    expect(item).toHaveTextContent('função 12');
    expect(item).toHaveTextContent('soma das ações de educação');
    expect(item).toHaveTextContent('nas três etapas');
    expect(item).toHaveTextContent('Cada ação segue em fonte única');
  });

  it.each([
    ['SIOPE', ['índice de 25%', 'Fundeb na remuneração', 'investimento por aluno', 'fonte única']],
    ['SICONFI', ['RREO Anexo 14', 'função 12', 'conferido com a Betha', 'igualdade do percentual não confere']],
    ['INEP', ['rendimento', 'formação', 'ENEM', 'ensino superior', 'fonte única']],
    ['MEC', ['Retrato da Educação Infantil', 'a Prefeitura informou ao MEC', 'fonte única']],
    ['IBGE', ['republica o INEP', 'não conta como conferência', 'fonte única']],
  ])('fontes da educação: %s diz o que cobre e o selo', (fonte, trechos) => {
    render(<Metodologia />);

    const item = termo(fonte);
    for (const trecho of trechos) expect(item).toHaveTextContent(trecho);
  });

  it('os repasses dizem que vêm da receita conferida com o TCE-SC', () => {
    render(<Metodologia />);

    expect(termo('Repasses')).toHaveTextContent('conferido com o TCE-SC');
  });

  it('a explicação das funções cita a exceção da Educação, em vez de dizer que nenhuma tem par', () => {
    render(<Metodologia />);

    expect(screen.getByText(/O total da despesa por função é comparado/)).toHaveTextContent(
      'A função 12, Educação, é a única com par',
    );
  });

  it('fonte única cita as fontes da educação', () => {
    render(<Metodologia />);

    expect(termo('fonte única, sem conferência')).toHaveTextContent('INEP, SIOPE e MEC');
  });

  it('o texto da educação não cita pedido de informação do projeto', () => {
    const { container } = render(<Metodologia />);

    expect(container.textContent).not.toMatch(/e-SIC|protocolo/i);
  });
});
