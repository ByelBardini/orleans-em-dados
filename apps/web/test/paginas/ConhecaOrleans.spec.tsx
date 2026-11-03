import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConhecaOrleans from '../../src/paginas/ConhecaOrleans';
import { TEXTO_PROIBIDO } from '../support/conferidos';
import { FetchFake } from '../support/fetch-fake';
import { COMPARACAO, municipio, municipioIndisponivel } from '../support/municipio';

const SELO = 'fonte única, sem conferência';

afterEach(() => vi.unstubAllGlobals());

const abrir = async (resposta = municipio()) => {
  new FetchFake().responder('/api/municipio', resposta).instalar();
  const { container } = render(<ConhecaOrleans />);
  await screen.findByRole('heading', { level: 1 });
  return container;
};

const totais = () => screen.getByRole('region', { name: 'Renda e produção' });
const item = (nome: string) => screen.getByText(nome, { selector: '.lista-retrato-nome' }).closest('li') as HTMLElement;
const celula = (rotulo: string | RegExp) =>
  screen.getByText(rotulo, { selector: '.rotulo' }).parentElement as HTMLElement;

describe('Conheça Orleans: população', () => {
  it('população mais recente diz "estimativa 2026", e o Censo diz "Censo 2022"', async () => {
    await abrir();

    expect(item('População, estimativa 2026')).toHaveTextContent('24.901 moradores');
    expect(item('População, Censo 2022')).toHaveTextContent('23.661 moradores');
  });

  it('crescimento é dito entre censos, de 2010 a 2022', async () => {
    await abrir();

    // (23.661 − 21.393) ÷ 21.393
    expect(screen.getByText(/entre os censos de 2010 e 2022/i)).toHaveTextContent(
      /de 21\.393 para 23\.661 moradores: 10,6% em 12 anos/,
    );
  });

  it('a série marca cada ano como censo ou estimativa', async () => {
    await abrir();

    const tabela = screen.getByRole('table', { name: 'População de Orleans por ano' });
    expect(within(tabela).getByText('2010').closest('tr')).toHaveTextContent('Censo');
    expect(within(tabela).getByText('2024').closest('tr')).toHaveTextContent('Estimativa');
    expect(within(tabela).getByText('2024').closest('tr')).toHaveTextContent('24.474');
  });

  it('território e situação do domicílio trazem o ano do Censo', async () => {
    await abrir();

    expect(item('Área, Censo 2022')).toHaveTextContent('549,9 km²');
    expect(item('Densidade, Censo 2022')).toHaveTextContent('43,03 moradores por km²');
    expect(screen.getByRole('img', { name: /Situação do domicílio no Censo 2022/ })).toBeInTheDocument();
  });
});

describe('Conheça Orleans: pirâmide', () => {
  it('mostra homens e mulheres por faixa, com tabela equivalente para leitor de tela', async () => {
    await abrir();

    expect(screen.getByRole('img', { name: /Pirâmide etária de Orleans no Censo 2022/ })).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Pirâmide etária por faixa de idade' });
    const linha = within(tabela).getByText('80 anos ou mais').closest('tr') as HTMLElement;
    expect(linha).toHaveTextContent('188');
    expect(linha).toHaveTextContent('275');
  });
});

describe('Conheça Orleans: economia', () => {
  it('PIB per capita aparece ao lado do rendimento domiciliar, com a nota de que não é renda', async () => {
    await abrir();

    expect(celula('PIB per capita, 2023').querySelector('.numero-valor')).toHaveTextContent('59.547');
    expect(celula('Rendimento médio por pessoa, Censo 2022').querySelector('.numero-valor')).toHaveTextContent('2.065');
    expect(screen.getByText(/PIB per capita não é a renda do morador/)).toBeInTheDocument();
  });

  it('o PIB per capita diz o divisor usado', async () => {
    await abrir();

    expect(celula('PIB per capita, 2023')).toHaveTextContent('Censo 2022');
  });

  it('composição do PIB é de um ano só, sem "até"', async () => {
    await abrir();

    expect(screen.getByRole('heading', { name: 'Composição do PIB em 2021' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Composição do PIB em 2021/ })).toBeInTheDocument();
  });

  it('composição de ano anterior traz o total daquele ano e diz que não descreve o PIB mais recente', async () => {
    await abrir();

    const aviso = screen.getByText(/As fatias abaixo são de 2021/);
    expect(aviso).toHaveTextContent('quando o PIB foi de R$ 1.188,0 milhões');
    expect(aviso).toHaveTextContent(/não descrevem 2023/);
  });

  it('composição do mesmo ano do PIB mais recente sai sem o aviso de ano diferente', async () => {
    const base = municipio();
    if (!base.disponivel) throw new Error('fixture');
    const composicao = base.pib.serie[0]!.composicao;
    await abrir({
      ...base,
      pib: {
        serie: base.pib.serie.map((p) => ({ ...p, composicao })),
        ultimoAnoDaComposicao: 2023,
      },
    });

    expect(screen.getByRole('heading', { name: 'Composição do PIB em 2023' })).toBeInTheDocument();
    expect(screen.queryByText(/não descrevem/)).not.toBeInTheDocument();
  });

  it('sem nenhum ano com composição, a seção sai sem número', async () => {
    const base = municipio();
    if (!base.disponivel) throw new Error('fixture');
    await abrir({
      ...base,
      pib: {
        serie: base.pib.serie.map((p) => ({ ...p, composicao: null })),
        ultimoAnoDaComposicao: null,
      },
    });

    expect(screen.queryByRole('heading', { name: /Composição do PIB/ })).not.toBeInTheDocument();
  });
});

describe('Conheça Orleans: rótulos e estados', () => {
  it('cada número tem o selo de fonte única', async () => {
    await abrir();

    const celulas = within(totais()).getAllByText(/./, { selector: '.rotulo' });
    expect(celulas).toHaveLength(3);
    for (const rotulo of celulas) expect(rotulo.parentElement).toHaveTextContent(SELO);
  });

  it('`disponivel: false` mostra o aviso, sem número', async () => {
    new FetchFake().responder('/api/municipio', municipioIndisponivel()).instalar();
    const { container } = render(<ConhecaOrleans />);

    expect(await screen.findByText(/Os dados do IBGE ainda não foram coletados/)).toBeInTheDocument();
    expect(container.querySelector('.numero-valor')).toBeNull();
    expect(container).not.toHaveTextContent(/\d\.\d{3}/);
  });

  it('erro da rota vira aviso, sem número', async () => {
    new FetchFake().responderTexto('/api/municipio', 'fora', 500).instalar();
    const { container } = render(<ConhecaOrleans />);

    expect(await screen.findByText(/Não foi possível carregar/)).toBeInTheDocument();
    expect(container.querySelector('.numero-valor')).toBeNull();
  });

  it('a página não mostra o filtro de ano nem o de entidade', async () => {
    await abrir();

    expect(screen.queryByLabelText('Ano')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Entidade' })).not.toBeInTheDocument();
  });

  it('não usa texto proibido', async () => {
    const container = await abrir();

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });

  it('a fonte diz o IBGE e a data da coleta', async () => {
    await abrir();

    expect(screen.getByText(/Fonte: IBGE — agregados do SIDRA · coletado em/)).toBeInTheDocument();
  });
});

describe('Conheça Orleans: cartões e lista', () => {
  it('os cartões são só de dinheiro', async () => {
    await abrir();

    const rotulos = within(totais())
      .getAllByText(/./, { selector: '.rotulo' })
      .map((r) => r.textContent);

    expect(rotulos).toEqual([
      'Rendimento médio por pessoa, Censo 2022',
      'Rendimento mediano por pessoa, Censo 2022',
      'PIB per capita, 2023',
    ]);
  });

  it('o resto fica na lista, nesta ordem', async () => {
    await abrir();

    const nomes = [...document.querySelectorAll('.lista-retrato-nome')].map((n) => n.textContent);

    expect(nomes).toEqual([
      'População, estimativa 2026',
      'População, Censo 2022',
      'Área, Censo 2022',
      'Densidade, Censo 2022',
      'Moradores na área urbana, Censo 2022',
      'Crescimento da população, 2010 a 2022',
      'Moradores com até 14 anos, Censo 2022',
      'Moradores com 60 anos ou mais, Censo 2022',
    ]);
  });

  it.each([
    ['População, estimativa 2026', '24.901', 'moradores'],
    ['Área, Censo 2022', '549,9', 'km²'],
    ['Densidade, Censo 2022', '43,03', 'moradores por km²'],
  ])('"%s" tem o número logo abaixo do nome, com a unidade separada', async (nome, numero, unidade) => {
    await abrir();

    const valor = screen.getByText(nome).nextElementSibling as HTMLElement;

    expect(valor).toHaveClass('lista-retrato-valor');
    expect(valor.querySelector('.lista-retrato-unidade')).toHaveTextContent(unidade);
    expect(valor.firstChild).toHaveTextContent(numero);
  });

  it('percentual não tem unidade separada: o sinal já diz', async () => {
    await abrir();

    const valor = screen.getByText('Moradores na área urbana, Censo 2022').nextElementSibling as HTMLElement;

    expect(valor).toHaveTextContent('63,4%');
    expect(valor.querySelector('.lista-retrato-unidade')).toBeNull();
  });

  const nomesDa = (lista: string) =>
    [...document.querySelectorAll(`${lista} .lista-retrato-nome`)].map((n) => n.textContent);

  it('o que não tem comparação fica na linha de cima, com os números maiores', async () => {
    await abrir();

    expect(nomesDa('.lista-retrato.sem-comparacao')).toEqual([
      'População, estimativa 2026',
      'População, Censo 2022',
      'Área, Censo 2022',
    ]);
  });

  it('o que tem comparação fica na linha de baixo', async () => {
    await abrir();

    expect(nomesDa('.lista-retrato.com-comparacao')).toEqual([
      'Densidade, Censo 2022',
      'Moradores na área urbana, Censo 2022',
      'Crescimento da população, 2010 a 2022',
      'Moradores com até 14 anos, Censo 2022',
      'Moradores com 60 anos ou mais, Censo 2022',
    ]);
  });

  it('sem a comparação coletada, a densidade sobe para a linha de cima, e a de baixo não aparece', async () => {
    await abrir(municipio({ comparacao: null }));

    expect(nomesDa('.lista-retrato.sem-comparacao')).toContain('Densidade, Censo 2022');
    expect(document.querySelector('.lista-retrato.com-comparacao')).toBeNull();
  });

  it('a lista leva o selo de fonte única no título', async () => {
    await abrir();

    const titulo = screen.getByRole('heading', { name: 'Orleans em números' }).parentElement as HTMLElement;

    expect(within(titulo).getByRole('button', { name: SELO })).toBeInTheDocument();
  });

  it('não há tabela de comparação', async () => {
    await abrir();

    expect(screen.queryByRole('table', { name: 'Orleans, Santa Catarina e Brasil' })).not.toBeInTheDocument();
  });
});

describe('Conheça Orleans: diante de Santa Catarina e do Brasil', () => {
  const linhas = (dono: HTMLElement) => [...dono.querySelectorAll('.diante-dos-lugares li')];
  const textos = (dono: HTMLElement) => linhas(dono).map((l) => l.textContent?.replace(/\s+/g, ' '));

  it('densidade compara em percentual, com o valor do outro lugar', async () => {
    await abrir();

    // 43,03 diante de 79,50 e de 23,86.
    expect(textos(item('Densidade, Censo 2022'))).toEqual([
      '▼ 45,9% abaixo de Santa Catarina (79,50)',
      '▲ 80,3% acima do Brasil (23,86)',
    ]);
  });

  it.each([
    [
      'Moradores na área urbana, Censo 2022',
      '▼ 20,5 pontos abaixo de Santa Catarina (83,9%)',
      '▼ 24,0 pontos abaixo do Brasil (87,4%)',
    ],
    [
      'Crescimento da população, 2010 a 2022',
      '▼ 11,2 pontos abaixo de Santa Catarina (+21,8%)',
      '▲ 4,1 pontos acima do Brasil (+6,5%)',
    ],
    [
      'Moradores com até 14 anos, Censo 2022',
      '▼ 0,6 ponto abaixo de Santa Catarina (18,1%)',
      '▼ 2,3 pontos abaixo do Brasil (19,8%)',
    ],
    [
      'Moradores com 60 anos ou mais, Censo 2022',
      '▲ 2,9 pontos acima de Santa Catarina (16,3%)',
      '▲ 3,6 pontos acima do Brasil (15,6%)',
    ],
  ])('"%s" compara em pontos, porque já é percentual', async (nome, santaCatarina, brasil) => {
    await abrir();

    expect(textos(item(nome))).toEqual([santaCatarina, brasil]);
  });

  it.each([['População, estimativa 2026'], ['População, Censo 2022'], ['Área, Censo 2022']])(
    '"%s" não compara: tamanho não é comparável',
    async (nome) => {
      await abrir();

      expect(linhas(item(nome))).toEqual([]);
    },
  );

  it.each([
    ['Rendimento médio por pessoa, Censo 2022', /7,0% abaixo de Santa Catarina/, /26,1% acima do Brasil/],
    ['Rendimento mediano por pessoa, Censo 2022', /0,5% abaixo de Santa Catarina/, /52,5% acima do Brasil/],
    ['PIB per capita, 2023', /11,7% abaixo de Santa Catarina/, /10,5% acima do Brasil/],
  ])('o cartão "%s" é vermelho onde está abaixo e verde onde está acima', async (rotulo, santaCatarina, brasil) => {
    await abrir();

    const [sc, br] = linhas(celula(rotulo));

    expect(sc).toHaveTextContent(santaCatarina);
    expect(sc).toHaveClass('ruim');
    expect(br).toHaveTextContent(brasil);
    expect(br).toHaveClass('bom');
  });

  it('fora do dinheiro, acima ou abaixo não leva cor', async () => {
    await abrir();

    const naLista = [...document.querySelectorAll('.lista-retrato .diante-dos-lugares li')];

    expect(naLista.length).toBeGreaterThan(0);
    expect(naLista.filter((l) => l.classList.contains('bom') || l.classList.contains('ruim'))).toEqual([]);
  });

  it('o valor igual diz "igual", sem cor', async () => {
    await abrir(
      municipio({
        comparacao: {
          ...COMPARACAO,
          brasil: { ...COMPARACAO.brasil, rendimentoMedio: COMPARACAO.orleans.rendimentoMedio },
        },
      }),
    );

    const [, br] = linhas(celula('Rendimento médio por pessoa, Censo 2022'));

    expect(br).toHaveTextContent(/igual ao Brasil/);
    expect(br).not.toHaveClass('bom');
  });

  it('PIB de Orleans em ano diferente do comparado fica sem a comparação', async () => {
    await abrir(municipio({ comparacao: { ...COMPARACAO, anoDoPib: 2021 } }));

    expect(linhas(celula('PIB per capita, 2023'))).toEqual([]);
  });

  it('lugar sem o censo anterior fica fora da linha do crescimento', async () => {
    await abrir(municipio({ comparacao: { ...COMPARACAO, brasil: { ...COMPARACAO.brasil, crescimento: null } } }));

    expect(textos(item('Crescimento da população, 2010 a 2022'))).toEqual([
      '▼ 11,2 pontos abaixo de Santa Catarina (+21,8%)',
    ]);
  });

  it('diz que o estado e o país são o total, e onde a cor aparece', async () => {
    await abrir();

    expect(document.body).toHaveTextContent('não a média simples dos municípios');
    expect(document.body).toHaveTextContent('Verde e vermelho só aparecem no dinheiro');
  });

  it('sem a comparação coletada, o resto segue, sem as posições nem a nota', async () => {
    await abrir(municipio({ comparacao: null }));

    expect(item('Densidade, Censo 2022')).toHaveTextContent('43,03');
    expect(celula('PIB per capita, 2023').querySelector('.numero-valor')).toHaveTextContent('59.547');
    expect(document.querySelector('.diante-dos-lugares')).toBeNull();
    expect(document.querySelector('.numero-comparacao')).toBeNull();
    expect(document.body).not.toHaveTextContent('média simples');
  });
});

describe('Conheça Orleans: série da população', () => {
  const ponto = (ano: number, tipo: 'censo' | 'estimativa' = 'estimativa') => ({ ano, populacao: 20000 + ano, tipo });
  // Doze pontos: sete anos recentes em ordem e dois censos antigos, com estimativas antigas no meio.
  const SERIE = [
    ponto(1980, 'censo'),
    ponto(2000, 'censo'),
    ponto(2001),
    ponto(2002),
    ponto(2003),
    ponto(2021),
    ponto(2022, 'censo'),
    ponto(2023),
    ponto(2024),
    ponto(2025),
    ponto(2026),
    ponto(2010, 'censo'),
  ].sort((a, b) => a.ano - b.ano);
  const abrirSerie = () => abrir(municipio({ populacao: { serie: SERIE } }));
  const anos = () =>
    within(screen.getByRole('table', { name: 'População de Orleans por ano' }))
      .getAllByRole('rowheader')
      .map((c) => c.textContent);

  it('fechada, mostra os cinco anos mais recentes e os censos antigos', async () => {
    await abrirSerie();

    expect(anos()).toEqual(['2026', '2025', '2024', '2023', '2022', '2010', '2000', '1980']);
  });

  it('o botão diz quantos anos faltam, e não está expandido', async () => {
    await abrirSerie();

    const botao = screen.getByRole('button', { name: 'Ver mais 4 anos' });

    expect(botao).toHaveAttribute('aria-expanded', 'false');
  });

  it('ver mais mostra a série inteira, em ordem', async () => {
    await abrirSerie();

    fireEvent.click(screen.getByRole('button', { name: 'Ver mais 4 anos' }));

    expect(anos()).toEqual([
      '2026',
      '2025',
      '2024',
      '2023',
      '2022',
      '2021',
      '2010',
      '2003',
      '2002',
      '2001',
      '2000',
      '1980',
    ]);
    expect(screen.getByRole('button', { name: 'Ver menos' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('ver menos volta ao resumo', async () => {
    await abrirSerie();
    fireEvent.click(screen.getByRole('button', { name: 'Ver mais 4 anos' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }));

    expect(anos()).toEqual(['2026', '2025', '2024', '2023', '2022', '2010', '2000', '1980']);
  });

  it('um ano só escondido diz "ano", no singular', async () => {
    await abrir(municipio({ populacao: { serie: SERIE.filter((p) => ![2001, 2002, 2003].includes(p.ano)) } }));

    expect(screen.getByRole('button', { name: 'Ver mais 1 ano' })).toBeInTheDocument();
  });

  it('série sem o que esconder não tem botão', async () => {
    await abrir();

    expect(screen.queryByRole('button', { name: /^Ver m/ })).not.toBeInTheDocument();
  });

  it('o trilho usa o maior da série inteira: abrir não muda a escala', async () => {
    await abrir(
      municipio({
        populacao: {
          serie: [
            ponto(1980, 'censo'),
            ponto(2000),
            ponto(2001),
            ponto(2002),
            { ano: 2003, populacao: 44000, tipo: 'estimativa' },
            ponto(2004),
            ponto(2005),
            ponto(2006),
            ponto(2007),
            ponto(2008),
            ponto(2009),
          ],
        },
      }),
    );

    const barra = (ano: string) =>
      (
        within(screen.getByRole('table', { name: 'População de Orleans por ano' }))
          .getByRole('rowheader', { name: ano })
          .closest('tr') as HTMLElement
      ).querySelector('.trilho span') as HTMLElement;

    // 2003 está escondido, e 2009 é medido contra ele: 22.009 ÷ 44.000.
    expect(barra('2009').style.width).toMatch(/^50\.0/);
  });
});
