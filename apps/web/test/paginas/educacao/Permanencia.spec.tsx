import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Permanencia from '../../../src/paginas/educacao/Permanencia';
import { TEXTO_PROIBIDO } from '../../support/conferidos';
import { permanencia, permanenciaIndisponivel } from '../../support/educacao';
import { FetchFake } from '../../support/fetch-fake';

afterEach(() => vi.unstubAllGlobals());

const CAMINHO = '/api/educacao/permanencia';

const abrir = async (resposta = permanencia()) => {
  new FetchFake().responder(CAMINHO, resposta).instalar();
  const { container } = render(<Permanencia />);
  await screen.findByRole('link', { name: /baixar csv/i });
  return container;
};

const escolher = (rede: string) => userEvent.click(screen.getByRole('button', { name: rede }));
const bloco = (nome: string | RegExp) => screen.getByRole('region', { name: nome });
const COMO_TERMINA = /como termina o ano letivo/i;
const COMPARADOS = /abandono e reprovação, comparados/i;
const ONDE_PESA = /onde os números pesam mais/i;
const ATRASO = /2 anos ou mais atrasados/i;
const EVASAO = /não voltaram no ano seguinte/i;
const SELO = 'fonte única, sem conferência';

const abrirDetalhes = (doBloco: RegExp) =>
  userEvent.click(within(bloco(doBloco)).getByRole('button', { name: 'Fonte e detalhes' }));
// A seta e o tom de cada lugar, como o leitor vê: "▲ 0,6 ponto acima de SC" e se é melhor ou pior.
const setasEm = (elemento: Element | null) =>
  Array.from(elemento?.querySelectorAll('.cmp-diante li') ?? []).map((li) => [li.textContent, li.className]);
const setasDa = (tabela: HTMLElement) => setasEm(tabela.closest('.cmp'));

const barras = () => within(bloco(COMO_TERMINA)).getByRole('table', { name: /como termina o ano/i });
// O grupo de uma barra, como o leitor vê: o nome da etapa, a barra, os valores e a comparação embaixo.
const grupoDaBarra = (etapa: string) =>
  within(within(bloco(COMO_TERMINA)).getByRole('img'))
    .getByText(etapa, { selector: '.emp-rotulo' })
    .closest('.emp-linha') as HTMLElement;
const linhaDasBarras = (etapa: string) => within(barras()).getByRole('row', { name: new RegExp(`^${etapa}`) });

describe('Permanência: estados', () => {
  it('enquanto carrega, diz que está carregando', () => {
    const fake = new FetchFake();
    fake.segurar = true;
    fake.responder(CAMINHO, permanencia()).instalar();

    render(<Permanencia />);

    expect(screen.getByText('Carregando os números…')).toBeInTheDocument();
  });

  it('com a API fora do ar, mostra o aviso e nenhum número', async () => {
    new FetchFake().responderTexto(CAMINHO, JSON.stringify({ erro: 'Erro interno' }), 500).instalar();

    render(<Permanencia />);

    expect(await screen.findByText(/Não foi possível carregar: Erro interno/)).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('sem nenhuma coleta, avisa e não mostra bloco, alternador nem CSV', async () => {
    new FetchFake().responder(CAMINHO, permanenciaIndisponivel()).instalar();

    render(<Permanencia />);

    expect(await screen.findByText(/ainda não foram coletados/)).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Rede' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /baixar csv/i })).not.toBeInTheDocument();
  });

  it('sem a coleta da transição, a evasão some e o resto segue', async () => {
    await abrir(permanencia({ evasao: null, faltando: ['inep_transicao'] }));

    expect(screen.queryByRole('region', { name: EVASAO })).not.toBeInTheDocument();
    expect(bloco(COMO_TERMINA)).toBeInTheDocument();
  });

  it('sem as matrículas, as estimativas somem e as barras seguem', async () => {
    await abrir(permanencia({ series: null, faltando: ['ibge_rede_escolar'] }));

    expect(screen.queryByRole('region', { name: ONDE_PESA })).not.toBeInTheDocument();
    expect(bloco(COMPARADOS)).toBeInTheDocument();
  });

  it('o CSV da aba está a um clique', async () => {
    await abrir();

    expect(screen.getByRole('link', { name: /baixar csv/i })).toHaveAttribute('href', '/api/educacao/permanencia.csv');
  });

  it('nenhuma palavra proibida, em nenhuma rede', async () => {
    const container = await abrir();
    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);

    await escolher('Municipal');

    expect(container.textContent).not.toMatch(TEXTO_PROIBIDO);
  });

  it.each([COMO_TERMINA, COMPARADOS, ONDE_PESA, ATRASO, EVASAO])('o bloco %s traz o selo no título', async (nome) => {
    await abrir();

    expect(within(bloco(nome)).getByText(SELO)).toBeInTheDocument();
  });
});

describe('Permanência: alternador de rede', () => {
  it('abre na rede pública', async () => {
    await abrir();

    expect(screen.getByRole('button', { name: 'Pública' })).toHaveAttribute('aria-pressed', 'true');
    expect(linhaDasBarras('Anos iniciais')).toHaveTextContent('97,4%');
  });

  it('sem dado na rede pública, abre na primeira rede com dado', async () => {
    const dados = permanencia({ series: null, distorcao: null, evasao: null });
    for (const etapa of dados.rendimento?.etapas ?? []) {
      delete etapa.aprovacao.porRede.publica;
      delete etapa.reprovacao.porRede.publica;
      delete etapa.abandono.porRede.publica;
    }

    await abrir(dados);

    expect(screen.getByRole('button', { name: 'Municipal' })).toHaveAttribute('aria-pressed', 'true');
    expect(linhaDasBarras('Anos iniciais')).toHaveTextContent('96,3%');
  });

  it('rede sem dado em nenhum bloco fica desabilitada', async () => {
    await abrir();

    expect(screen.getByRole('button', { name: 'Todas' })).toBeDisabled();
  });

  it('muda as barras e a comparação juntas', async () => {
    await abrir();
    const reprovacao = () => within(bloco(COMPARADOS)).getByRole('group', { name: 'Reprovação' });
    expect(within(reprovacao()).getByRole('table', { name: 'Anos finais, rede pública, 2025' })).toHaveTextContent(
      '4,2%',
    );

    await escolher('Municipal');

    expect(linhaDasBarras('Anos finais')).toHaveTextContent('93,8%');
    expect(within(reprovacao()).getByRole('table', { name: 'Anos finais, rede municipal, 2025' })).toHaveTextContent(
      '6,2%',
    );
    expect(within(bloco(ATRASO)).getByRole('table', { name: 'Anos finais, rede municipal, 2025' })).toHaveTextContent(
      '17,6%',
    );
  });

  it('a frase de cada rede diz que compara rede com rede onde a fonte abre a rede', async () => {
    await abrir();
    expect(screen.getByText(/rede com rede onde a fonte abre a rede/)).toHaveTextContent('na rede pública');

    await escolher('Municipal');

    expect(screen.getByText(/rede com rede onde a fonte abre a rede/)).toHaveTextContent('na rede municipal');
  });

  it('em "todas as redes", a frase não fala em rede com rede', async () => {
    const dados = permanencia({ series: null, distorcao: null, evasao: null });
    const etapa = dados.rendimento?.etapas[0];
    if (etapa) etapa.aprovacao.porRede.todas = { orleans: 97.8, santaCatarina: 98.5, brasil: 98.3 };
    await abrir(dados);

    await escolher('Todas');

    expect(screen.getByText(/peso de cada rede/)).toBeInTheDocument();
    expect(screen.queryByText(/rede com rede/)).not.toBeInTheDocument();
  });
});

describe('Permanência: como termina o ano', () => {
  it('cada etapa tem aprovados, reprovados e abandono, por escrito', async () => {
    await abrir();

    const medio = linhaDasBarras('Ensino médio');
    expect(medio).toHaveTextContent('85,1%');
    expect(medio).toHaveTextContent('8,9%');
    expect(medio).toHaveTextContent('6,0%');
  });

  it('abandono zero aparece como 0,0%, e não como travessão', async () => {
    await abrir();

    expect(within(linhaDasBarras('Anos finais')).getAllByRole('cell')[2]).toHaveTextContent('0,0%');
  });

  it('as barras não usam o vermelho de Orleans: só tons neutros e hachura', async () => {
    await abrir();

    const figura = within(bloco(COMO_TERMINA)).getByRole('img');
    expect(figura.querySelector('.orleans')).toBeNull();
    expect(figura.querySelectorAll('.emp-tom-0, .emp-tom-1, .emp-tom-2').length).toBeGreaterThan(0);
  });

  it('passar o mouse na fatia de reprovados do médio abre a dica com a etapa e o valor', async () => {
    const container = await abrir();

    const figura = within(bloco(COMO_TERMINA)).getByRole('img');
    const medio = within(figura).getByText('Ensino médio').closest('.emp-linha') as HTMLElement;
    await userEvent.hover(medio.querySelector('[data-parte="Reprovados"]') as HTMLElement);

    expect(container.querySelector('.emp-dica')).toHaveTextContent('Ensino médioReprovados8,9%');
  });

  it('rede municipal, sem ensino médio em Orleans, sai sem a linha do médio', async () => {
    await abrir();

    await escolher('Municipal');

    expect(within(barras()).queryByRole('row', { name: /^Ensino médio/ })).not.toBeInTheDocument();
    expect(linhaDasBarras('Anos iniciais')).toHaveTextContent('96,3%');
  });

  it('a frase sai dos dados da rede escolhida', async () => {
    await abrir();
    expect(within(bloco(COMO_TERMINA)).getByText(/a aprovação em Orleans/)).toHaveTextContent(
      'Na rede pública, em 2025, a aprovação em Orleans vai de 85,1% no ensino médio a 97,4% nos anos iniciais.',
    );

    await escolher('Municipal');

    expect(within(bloco(COMO_TERMINA)).getByText(/a aprovação em Orleans/)).toHaveTextContent(
      'Na rede municipal, em 2025, a aprovação em Orleans vai de 93,8% nos anos finais a 96,3% nos anos iniciais.',
    );
  });

  it('uma etapa só na rede não vira intervalo nem "nas 1 etapas"', async () => {
    const dados = permanencia({ series: null, distorcao: null, evasao: null });
    if (dados.rendimento) dados.rendimento.etapas = dados.rendimento.etapas.slice(0, 1);
    await abrir(dados);

    expect(within(bloco(COMO_TERMINA)).getByText(/a aprovação em Orleans/)).toHaveTextContent(
      'Na rede pública, em 2025, a aprovação em Orleans é de 97,4% nos anos iniciais.',
    );
  });

  it('aprovação igual nas etapas não vira intervalo', async () => {
    const dados = permanencia({ series: null, distorcao: null, evasao: null });
    const medio = dados.rendimento?.etapas[2];
    const finais = dados.rendimento?.etapas[1];
    const iniciais = dados.rendimento?.etapas[0];
    for (const e of [medio, finais, iniciais]) {
      if (e) e.aprovacao.porRede.privada = { orleans: 100, santaCatarina: 99, brasil: 99 };
    }
    await abrir(dados);

    await escolher('Privada');

    expect(within(bloco(COMO_TERMINA)).getByText(/a aprovação em Orleans/)).toHaveTextContent(
      'Na rede privada, em 2025, a aprovação em Orleans é de 100,0% nas 3 etapas.',
    );
  });

  it('a comparação de cada etapa fica embaixo da barra dela, depois dos valores', async () => {
    await abrir();

    expect(
      ['Anos iniciais', 'Anos finais', 'Ensino médio'].map((etapa) => {
        const apoio = grupoDaBarra(etapa).querySelector('.emp-valores + .emp-apoio');
        return within(apoio as HTMLElement).getByText(/^Aprovação em SC/).textContent;
      }),
    ).toEqual([
      'Aprovação em SC 98,1% · Brasil 97,9%.',
      'Aprovação em SC 96,1% · Brasil 95,2%.',
      'Aprovação em SC 88,7% · Brasil 94,3%.',
    ]);
  });

  it('a comparação não fica num grupo separado no fim do bloco', async () => {
    await abrir();

    const fora = within(bloco(COMO_TERMINA))
      .queryAllByText(/aprovação em SC/i)
      .filter((elemento) => !elemento.closest('.emp-linha, table'));
    expect(fora).toEqual([]);
  });

  it.each([
    ['Aprovação', /passa para a série seguinte/],
    ['Reprovação', /termina o ano, mas não passa/],
    ['Abandono', /sai da escola durante o ano/],
    ['Evasão', /não se matricula no ano seguinte/],
    ['Distorção idade-série', /2 anos ou mais atrasado/],
  ])('%s tem definição', async (palavra, definicao) => {
    await abrir();

    const termo = within(bloco(/o que cada palavra quer dizer/i)).getByText(palavra);
    expect(termo.closest('div')).toHaveTextContent(definicao);
  });

  it('as definições não levam selo: não são dado', async () => {
    await abrir();

    expect(within(bloco(/o que cada palavra quer dizer/i)).queryByText(SELO)).not.toBeInTheDocument();
  });
});

describe('Permanência: abandono e reprovação comparados', () => {
  it('a comparação da rede municipal não tem a linha do ensino médio, nem de SC e do Brasil', async () => {
    await abrir();

    await escolher('Municipal');

    expect(within(bloco(COMPARADOS)).queryByRole('table', { name: /Ensino médio/ })).not.toBeInTheDocument();
  });

  it('na rede pública, o ensino médio aparece nos dois lados', async () => {
    await abrir();

    expect(within(bloco(COMPARADOS)).getAllByRole('table', { name: /Ensino médio/ })).toHaveLength(2);
  });

  it('a escala escrita acompanha o maior valor do bloco, em todas as redes', async () => {
    await abrir();

    // Reprovação municipal de SC no médio chega a 14,5%: a base de 10% não caberia.
    expect(within(bloco(COMPARADOS)).getByText(/Escala de 0 a 14,5%/)).toBeInTheDocument();
  });
});

describe('Permanência: onde os números pesam mais', () => {
  const grade = () => within(bloco(ONDE_PESA)).getByRole('list', { name: /^As séries que mais pesam/ });
  const todosOsCartoes = () => Array.from(grade().children) as HTMLElement[];
  const cartoes = () => todosOsCartoes().filter((c) => c.textContent?.includes('foram reprovados'));

  it('a rede municipal mostra as três maiores reprovações, da maior para a menor', async () => {
    await abrir();

    await escolher('Municipal');

    expect(cartoes().map((c) => c.textContent)).toEqual([
      expect.stringContaining('cerca de 6 de 52 alunos'),
      expect.stringContaining('cerca de 18 de 177 alunos'),
      expect.stringContaining('cerca de 10 de 130 alunos'),
    ]);
  });

  it('o cartão diz a rede, a série, a taxa, o ano e os outros lugares', async () => {
    await abrir();

    await escolher('Municipal');

    const segundoAno = cartoes()[1];
    expect(segundoAno).toHaveTextContent('rede municipal · 2º ano');
    expect(segundoAno).toHaveTextContent('foram reprovados em 2025 (10,1%). SC 2,1% · Brasil 1,3%.');
  });

  it('a 1ª série estadual dá cerca de 44 de 224, sem contar a série sem matrícula', async () => {
    await abrir();

    await escolher('Estadual');

    expect(cartoes()).toHaveLength(1);
    expect(cartoes()[0]).toHaveTextContent('rede estadual · 1ª série do médio');
    expect(cartoes()[0]).toHaveTextContent('cerca de 44 de 224 alunos');
  });

  it('contagem abaixo de 5 vira "menos de 5"', async () => {
    await abrir();

    await escolher('Privada');

    expect(cartoes()[0]).toHaveTextContent('menos de 5 de 38 alunos');
    expect(cartoes()[0]).not.toHaveTextContent('cerca de 2');
  });

  it('taxa zero não vira cartão: "menos de 5" sugeriria alguém', async () => {
    const dados = permanencia();
    if (dados.series) dados.series.series = dados.series.series.filter((s) => s.etapa === 'ano_3');
    await abrir(dados);

    await escolher('Municipal');

    expect(within(bloco(ONDE_PESA)).queryByRole('list', { name: /^As séries que mais pesam/ })).not.toBeInTheDocument();
    expect(bloco(ONDE_PESA)).not.toHaveTextContent('de 132 alunos');
  });

  it('o aviso de "um ano só" está no bloco', async () => {
    await abrir();

    expect(bloco(ONDE_PESA)).toHaveTextContent('poucos alunos e um ano só');
    expect(bloco(ONDE_PESA)).toHaveTextContent('não indicam tendência');
  });

  it('a nota diz como a conta é feita e aponta as matrículas do IBGE, nos detalhes', async () => {
    await abrir();

    await abrirDetalhes(ONDE_PESA);

    expect(
      within(bloco(ONDE_PESA)).getByRole('link', { name: 'IBGE, sinopse do Censo Escolar (INEP)' }),
    ).toHaveAttribute('href', 'https://ibge.exemplo/pesquisas');
    expect(bloco(ONDE_PESA)).toHaveTextContent('taxa do INEP × matrículas da série e da rede');
  });

  it('o maior abandono da rede é o quarto cartão da mesma grade, no mesmo formato', async () => {
    await abrir();

    const cartao = todosOsCartoes()[3];
    expect(todosOsCartoes()).toHaveLength(4);
    expect(cartao?.querySelector('.edu-permanencia-onde')).toHaveTextContent(
      'rede pública · 1ª série do médio · abandono',
    );
    expect(cartao?.querySelector('.edu-permanencia-quantos')).toHaveTextContent('cerca de 22 de 224 alunos');
    expect(cartao).toHaveTextContent('abandonaram a escola em 2025 (9,7%). SC 4,1% · Brasil 3,0%.');
  });

  it('o abandono não fica mais solto embaixo dos cartões', async () => {
    await abrir();

    expect(
      within(bloco(ONDE_PESA))
        .getByText(/abandonaram/)
        .closest('li'),
    ).not.toBeNull();
    expect(within(bloco(ONDE_PESA)).queryByRole('table', { name: /^Abandono na/ })).not.toBeInTheDocument();
  });

  it('a grade tem uma coluna por cartão, até quatro, e fecha sem buraco', async () => {
    await abrir();
    expect(grade().style.getPropertyValue('--edu-permanencia-colunas')).toBe('4');

    await escolher('Estadual');
    expect(todosOsCartoes()).toHaveLength(2);
    expect(grade().style.getPropertyValue('--edu-permanencia-colunas')).toBe('2');
  });

  it('sem abandono na rede, não há cartão de abandono', async () => {
    await abrir();

    await escolher('Municipal');

    expect(todosOsCartoes()).toHaveLength(3);
    expect(within(bloco(ONDE_PESA)).queryByText(/abandonaram/)).not.toBeInTheDocument();
  });

  it('sem nenhuma estimativa na rede, diz isso, sem número', async () => {
    const dados = permanencia();
    for (const serie of dados.series?.series ?? []) serie.matriculas.municipal = null;
    await abrir(dados);

    await escolher('Municipal');

    expect(bloco(ONDE_PESA)).toHaveTextContent('Sem estimativa de alunos nesta rede em 2025.');
  });
});

describe('Permanência: atraso escolar', () => {
  it('a rede municipal sai sem a linha do ensino médio', async () => {
    await abrir();

    await escolher('Municipal');

    expect(within(bloco(ATRASO)).queryByRole('table', { name: /Ensino médio/ })).not.toBeInTheDocument();
    expect(within(bloco(ATRASO)).getAllByRole('table')).toHaveLength(2);
  });

  it('rede sem distorção de Orleans diz que não há dado', async () => {
    await abrir();

    await escolher('Privada');

    expect(within(bloco(ATRASO)).getByText('Sem dado de Orleans nesta rede.')).toBeInTheDocument();
  });
});

describe('Permanência: evasão', () => {
  it('é rotulada como 2021–2022, em cada linha, nos detalhes e na fonte', async () => {
    await abrir();
    await abrirDetalhes(EVASAO);

    expect(
      within(bloco(EVASAO)).getByRole('table', { name: 'Ensino médio, rede pública, 2021–2022' }),
    ).toHaveTextContent('9,6%');
    expect(bloco(EVASAO)).toHaveTextContent('De 2021 para 2022, o dado mais recente do INEP');
    expect(bloco(EVASAO)).toHaveTextContent('INEP, taxas de transição · 2021–2022');
  });

  it('sem a rede municipal, mostra o aviso com as redes que têm dado, e nenhum valor', async () => {
    await abrir();

    await escolher('Municipal');

    expect(within(bloco(EVASAO)).getByText(/O painel não tem a evasão de Orleans/)).toHaveTextContent(
      'O painel não tem a evasão de Orleans na rede municipal; tem na rede pública e na rede privada.',
    );
    expect(within(bloco(EVASAO)).queryByRole('table')).not.toBeInTheDocument();
    expect(bloco(EVASAO)).not.toHaveTextContent('0,0%');
    expect(bloco(EVASAO)).not.toHaveTextContent('1,3%');
  });

  it('com a rede presente, não há aviso', async () => {
    await abrir();

    expect(within(bloco(EVASAO)).queryByText(/O painel não tem a evasão/)).not.toBeInTheDocument();
  });

  it('etapa sem dado de Orleans na rede fica sem linha', async () => {
    await abrir();

    await escolher('Privada');

    expect(within(bloco(EVASAO)).getAllByRole('table')).toHaveLength(1);
    expect(
      within(bloco(EVASAO)).getByRole('table', { name: 'Ensino médio, rede privada, 2021–2022' }),
    ).toHaveTextContent('1,1%');
  });
});

describe('Permanência: setas diante de SC e do Brasil', () => {
  const ACIMA_PIOR = ['▲ 0,6 ponto acima de SC', 'ruim'];

  it('reprovação acima de SC sobe a seta e fica como pior: menos é melhor', async () => {
    await abrir();

    const reprovacao = within(bloco(COMPARADOS)).getByRole('group', { name: 'Reprovação' });
    expect(setasDa(within(reprovacao).getByRole('table', { name: 'Anos finais, rede pública, 2025' }))).toEqual([
      ACIMA_PIOR,
      ['▲ 0,3 ponto acima do Brasil', 'ruim'],
    ]);
  });

  it('abandono abaixo de SC desce a seta e fica como melhor', async () => {
    await abrir();

    const abandono = within(bloco(COMPARADOS)).getByRole('group', { name: 'Abandono' });
    expect(setasDa(within(abandono).getByRole('table', { name: 'Anos finais, rede pública, 2025' }))).toEqual([
      ['▼ 0,3 ponto abaixo de SC', 'bom'],
      ['▼ 0,9 ponto abaixo do Brasil', 'bom'],
    ]);
  });

  it('a distorção da rede municipal fica acima de SC, pior, e abaixo do Brasil, melhor', async () => {
    await abrir();
    await escolher('Municipal');

    expect(setasDa(within(bloco(ATRASO)).getByRole('table', { name: 'Anos finais, rede municipal, 2025' }))).toEqual([
      ['▲ 4,2 pontos acima de SC', 'ruim'],
      ['▼ 1,9 ponto abaixo do Brasil', 'bom'],
    ]);
  });

  it('a evasão do médio, abaixo de SC, desce a seta como melhor', async () => {
    await abrir();

    expect(
      setasDa(within(bloco(EVASAO)).getByRole('table', { name: 'Ensino médio, rede pública, 2021–2022' })),
    ).toEqual([
      ['▼ 3,9 pontos abaixo de SC', 'bom'],
      ['▲ 0,1 ponto acima do Brasil', 'ruim'],
    ]);
  });

  it('a aprovação abaixo de SC desce a seta e fica como pior: mais é melhor', async () => {
    await abrir();

    expect(setasEm(grupoDaBarra('Anos iniciais'))).toEqual([
      ['▼ 0,7 ponto abaixo de SC', 'ruim'],
      ['▼ 0,5 ponto abaixo do Brasil', 'ruim'],
    ]);
  });

  it('o cartão de reprovação leva a seta da série diante de SC e do Brasil', async () => {
    await abrir();
    await escolher('Municipal');

    const segundoAno = within(bloco(ONDE_PESA)).getByText('rede municipal · 2º ano').closest('li');
    expect(setasEm(segundoAno)).toEqual([
      ['▲ 8,0 pontos acima de SC', 'ruim'],
      ['▲ 8,8 pontos acima do Brasil', 'ruim'],
    ]);
  });

  it('o cartão do maior abandono também leva a seta, como pior', async () => {
    await abrir();

    const cartao = within(bloco(ONDE_PESA))
      .getByText(/abandonaram/)
      .closest('li');
    expect(setasEm(cartao)).toEqual([
      ['▲ 5,6 pontos acima de SC', 'ruim'],
      ['▲ 6,7 pontos acima do Brasil', 'ruim'],
    ]);
  });
});
