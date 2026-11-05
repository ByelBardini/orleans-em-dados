import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComparacaoDeEducacao, Meta, Rede } from '@orleans-em-dados/contracts';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  AlternadorDeRede,
  BarrasEmpilhadas,
  BarrasHorizontais,
  BarrasPorAno,
  BlocoDoCaderno,
  CabecalhoDoCaderno,
  Comparacao,
  Detalhes,
  Quadros,
  SerieDoIdeb,
} from '../../src/educacao/componentes';
import { seloAguardando } from '../../src/selos';

const dados = (mudancas: Partial<ComparacaoDeEducacao> = {}): ComparacaoDeEducacao => ({
  indicador: 'abandono',
  etapa: 'fundamental',
  ano: '2025',
  unidade: '%',
  fonte: { nome: 'INEP', url: 'https://inep.exemplo' },
  porRede: {
    publica: { orleans: 25, santaCatarina: 50, brasil: 75 },
    municipal: { orleans: 11, santaCatarina: 12, brasil: 13 },
    estadual: { orleans: null, santaCatarina: null, brasil: null },
  },
  ...mudancas,
});

const pontos = (container: HTMLElement, lugar: string) => container.querySelectorAll(`.cmp-ponto.${lugar}`);
const linhasDa = (tabela: HTMLElement) =>
  within(tabela)
    .getAllByRole('row')
    .slice(1)
    .map((linha) => [...linha.children].map((celula) => celula.textContent));

describe('Comparacao', () => {
  it('diz os três valores em texto, e cada ponto fica na posição do valor', () => {
    const { container } = render(<Comparacao comparacao={dados()} rede="publica" />);

    expect(screen.getByText('Orleans 25,0%')).toBeInTheDocument();
    expect(screen.getByText('SC 50,0%')).toBeInTheDocument();
    expect(screen.getByText('Brasil 75,0%')).toBeInTheDocument();
    expect(pontos(container, 'orleans')[0]).toHaveStyle({ left: '25%' });
    expect(pontos(container, 'santa-catarina')[0]).toHaveStyle({ left: '50%' });
    expect(pontos(container, 'brasil')[0]).toHaveStyle({ left: '75%' });
  });

  it('a tabela para leitor de tela traz os três lugares, com a rede e o ano no nome', () => {
    render(<Comparacao comparacao={dados()} rede="publica" />);

    const tabela = screen.getByRole('table', { name: 'Ensino fundamental, rede pública, 2025' });
    expect(tabela).toHaveClass('visualmente-oculto');
    expect(linhasDa(tabela)).toEqual([
      ['Orleans', '25,0%'],
      ['Santa Catarina', '50,0%'],
      ['Brasil', '75,0%'],
    ]);
  });

  it('a rede "todas" não vira "rede todas" no nome da tabela', () => {
    render(
      <Comparacao
        comparacao={dados({ porRede: { todas: { orleans: 1, santaCatarina: 2, brasil: 3 } } })}
        rede="todas"
      />,
    );

    expect(screen.getByRole('table', { name: 'Ensino fundamental, todas as redes, 2025' })).toBeInTheDocument();
  });

  it('o rótulo da página substitui o nome da etapa', () => {
    render(<Comparacao comparacao={dados()} rede="publica" rotulo="Abandono" />);

    expect(screen.getByText('Abandono')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Abandono, rede pública, 2025' })).toBeInTheDocument();
  });

  it('o ano aparece junto do nome', () => {
    render(<Comparacao comparacao={dados({ ano: '2021-2022' })} rede="publica" />);

    expect(screen.getByText('2021-2022')).toBeInTheDocument();
  });

  it('a figura descreve os três lugares no nome acessível, sem depender de title', () => {
    const { container } = render(<Comparacao comparacao={dados()} rede="publica" />);

    expect(screen.getByRole('img', { name: 'Orleans 25,0%, Santa Catarina 50,0%, Brasil 75,0%' })).toBeInTheDocument();
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('escala que não começa em zero está escrita', () => {
    const c = dados({ unidade: 'nota', porRede: { todas: { orleans: 500, santaCatarina: 550, brasil: 600 } } });

    const { container } = render(<Comparacao comparacao={c} rede="todas" escala={{ min: 450, max: 650 }} />);

    expect(screen.getByText('A escala vai de 450 a 650: não começa em zero.')).toBeInTheDocument();
    expect(pontos(container, 'orleans')[0]).toHaveStyle({ left: '25%' });
  });

  it('escala que começa em zero não leva o aviso', () => {
    render(<Comparacao comparacao={dados()} rede="publica" />);

    expect(screen.queryByText(/não começa em zero/)).not.toBeInTheDocument();
  });

  it('lugar nulo fica sem ponto, com travessão no texto e na tabela', () => {
    const c = dados({ porRede: { publica: { orleans: 25, santaCatarina: 50, brasil: null } } });

    const { container } = render(<Comparacao comparacao={c} rede="publica" />);

    expect(pontos(container, 'brasil')).toHaveLength(0);
    expect(pontos(container, 'orleans')).toHaveLength(1);
    expect(screen.getByText('Brasil —')).toBeInTheDocument();
    expect(linhasDa(screen.getByRole('table'))[2]).toEqual(['Brasil', '—']);
    expect(
      screen.getByRole('img', { name: 'Orleans 25,0%, Santa Catarina 50,0%, Brasil sem dado' }),
    ).toBeInTheDocument();
  });

  it('zero é ponto na ponta da escala, e não travessão', () => {
    const c = dados({ porRede: { publica: { orleans: 0, santaCatarina: 50, brasil: 75 } } });

    const { container } = render(<Comparacao comparacao={c} rede="publica" />);

    expect(pontos(container, 'orleans')[0]).toHaveStyle({ left: '0%' });
    expect(screen.getByText('Orleans 0,0%')).toBeInTheDocument();
    expect(linhasDa(screen.getByRole('table'))[0]).toEqual(['Orleans', '0,0%']);
  });

  it('meta desenha a linha na posição dela, e fica no texto e na tabela', () => {
    const c = dados({ meta: { valor: 60, referencia: 'até 2036' } });

    const { container } = render(<Comparacao comparacao={c} rede="publica" />);

    expect(container.querySelector('.cmp-meta')).toHaveStyle({ left: '60%' });
    expect(screen.getByText('Meta: 60% até 2036')).toBeInTheDocument();
    expect(linhasDa(screen.getByRole('table'))[3]).toEqual(['Meta: até 2036', '60%']);
  });

  // Regressão: `casas` de 2 valia também para a meta, e a aba Acesso mostrava "Meta: 100,00%" (05/11/2026).
  it('as casas pedidas valem para os três lugares, e a meta redonda sai sem casas', () => {
    const c = dados({ meta: { valor: 100, referencia: 'até 2036' } });

    render(<Comparacao comparacao={c} rede="publica" casas={2} />);

    expect(screen.getByText('Meta: 100% até 2036')).toBeInTheDocument();
    const [orleans, santaCatarina, brasil, meta] = linhasDa(screen.getByRole('table'));
    expect(meta).toEqual(['Meta: até 2036', '100%']);
    expect([orleans, santaCatarina, brasil].map((l) => l?.[1])).toEqual(['25,00%', '50,00%', '75,00%']);
  });

  it('meta com fração mantém a fração, sem zeros a mais', () => {
    const c = dados({ meta: { valor: 62.5, referencia: 'até 2036' } });

    render(<Comparacao comparacao={c} rede="publica" casas={2} />);

    expect(screen.getByText('Meta: 62,5% até 2036')).toBeInTheDocument();
  });

  it('sem meta, não há linha nem linha de tabela', () => {
    const { container } = render(<Comparacao comparacao={dados()} rede="publica" />);

    expect(container.querySelector('.cmp-meta')).toBeNull();
    expect(linhasDa(screen.getByRole('table'))).toHaveLength(3);
  });

  it.each(['estadual', 'privada'] as const)('a rede %s, sem dado, avisa e não desenha ponto', (rede) => {
    const { container } = render(<Comparacao comparacao={dados()} rede={rede} />);

    expect(screen.getByText('Sem dado nesta rede.')).toBeInTheDocument();
    expect(container.querySelectorAll('.cmp-ponto')).toHaveLength(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/0,0/)).not.toBeInTheDocument();
  });

  it('as casas podem ser pedidas', () => {
    render(<Comparacao comparacao={dados()} rede="publica" casas={0} />);

    expect(screen.getByText('Orleans 25%')).toBeInTheDocument();
  });
});

function ComAlternador({ comparacao }: { comparacao: ComparacaoDeEducacao }) {
  const [rede, setRede] = useState<Rede>('publica');
  return (
    <>
      <AlternadorDeRede comparacoes={[comparacao]} valor={rede} aoMudar={setRede} />
      <Comparacao comparacao={comparacao} rede={rede} />
    </>
  );
}

describe('Comparacao com sentido', () => {
  it('onde menor é melhor, Orleans abaixo de SC e do Brasil leva seta para baixo e tom bom, com os pontos', () => {
    render(<Comparacao comparacao={dados()} rede="publica" sentidoBom="menor" />);

    const sc = screen.getByText(/abaixo de SC/).closest('li') as HTMLElement;
    expect(sc).toHaveTextContent('▼ 25,0 pontos abaixo de SC');
    expect(sc).toHaveClass('bom');
    expect(screen.getByText(/abaixo do Brasil/).closest('li')).toHaveTextContent('▼ 50,0 pontos abaixo do Brasil');
  });

  it('onde maior é melhor, o mesmo dado leva tom ruim', () => {
    render(<Comparacao comparacao={dados()} rede="publica" sentidoBom="maior" />);

    expect(screen.getByText(/abaixo de SC/).closest('li')).toHaveClass('ruim');
  });

  it('fora do percentual, a diferença é em percentual do outro lugar', () => {
    render(<Comparacao comparacao={dados({ unidade: 'indice' })} rede="publica" sentidoBom="maior" />);

    expect(screen.getByText(/abaixo de SC/).closest('li')).toHaveTextContent('▼ 50,0% abaixo de SC');
  });

  it('sem sentido declarado, não há seta', () => {
    const { container } = render(<Comparacao comparacao={dados()} rede="publica" />);

    expect(container.querySelector('.cmp-diante')).toBeNull();
  });

  it('lugar sem dado não ganha seta', () => {
    render(<Comparacao comparacao={dados()} rede="municipal" sentidoBom="menor" />);
    render(
      <Comparacao
        comparacao={dados({ porRede: { publica: { orleans: 5, santaCatarina: null, brasil: 4 } } })}
        rede="publica"
        sentidoBom="menor"
      />,
    );

    expect(screen.queryAllByText(/de SC/)).toHaveLength(1);
  });
});

describe('Detalhes', () => {
  const abrirDetalhes = () => screen.getByRole('button', { name: 'Fonte e detalhes' });

  it('fechado, o conteúdo não aparece; passar o mouse abre', async () => {
    render(
      <Detalhes>
        <p>Rede municipal em Orleans, pública em SC.</p>
      </Detalhes>,
    );

    expect(screen.queryByText('Rede municipal em Orleans, pública em SC.')).toBeNull();
    await userEvent.hover(abrirDetalhes());
    expect(screen.getByText('Rede municipal em Orleans, pública em SC.')).toBeVisible();
    expect(abrirDetalhes()).toHaveAttribute('aria-expanded', 'true');
  });

  it('o clique abre e mantém aberto, e o Esc fecha', async () => {
    render(
      <Detalhes>
        <a href="https://inep.exemplo">INEP</a>
      </Detalhes>,
    );

    await userEvent.click(abrirDetalhes());
    expect(screen.getByRole('link', { name: 'INEP' })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: 'INEP' })).toBeNull();
  });
});

describe('Quadros', () => {
  const grupos = [
    {
      titulo: 'Anos iniciais',
      linhas: [
        { nome: 'IDEB', celulas: ['6,6', '6,5', '6,1'] },
        { nome: 'Aprovação', celulas: ['97,4%', '98,3%', '98,0%'] },
      ],
    },
    { titulo: 'Anos finais', linhas: [{ nome: 'IDEB', celulas: ['5,3', '5,2', '5,0'] }] },
  ];
  const colunas = [{ nome: 'Orleans', destaque: true }, { nome: 'SC' }, { nome: 'Brasil' }];

  it('cada grupo vira um quadro com a própria tabela, nomeada pelo grupo', () => {
    render(<Quadros rotulo="Prova e aprovação" colunas={colunas} grupos={grupos} />);

    const iniciais = screen.getByRole('table', { name: 'Prova e aprovação, Anos iniciais' });
    expect(linhasDa(iniciais)).toEqual([
      ['IDEB', '6,6', '6,5', '6,1'],
      ['Aprovação', '97,4%', '98,3%', '98,0%'],
    ]);
    expect(screen.getByRole('table', { name: 'Prova e aprovação, Anos finais' })).toBeInTheDocument();
  });

  it('a coluna em destaque leva a marca de Orleans, e as outras não', () => {
    render(<Quadros rotulo="Prova" colunas={colunas} grupos={grupos} />);

    const linha = screen.getAllByRole('row', { name: /^IDEB 6,6/ })[0] as HTMLElement;
    expect(within(linha).getByText('6,6')).toHaveClass('quadro-destaque');
    expect(within(linha).getByText('6,5')).not.toHaveClass('quadro-destaque');
  });

  it('a linha pode trazer um apoio abaixo do nome', () => {
    render(
      <Quadros
        rotulo="Prova"
        colunas={colunas}
        grupos={[
          { titulo: 'Médio', linhas: [{ nome: 'IDEB', apoio: 'SC: rede estadual', celulas: ['3,9', '4,3', '4,3'] }] },
        ]}
      />,
    );

    expect(screen.getByText('SC: rede estadual')).toBeInTheDocument();
  });

  it('o indicador e o apoio dele formam um grupo só, para o realce cobrir os dois juntos', () => {
    render(
      <Quadros
        rotulo="Prova"
        colunas={colunas}
        grupos={[
          {
            titulo: 'Médio',
            linhas: [
              { nome: 'IDEB', apoio: '▲ acima de SC', celulas: ['3,9', '4,3', '4,3'] },
              { nome: 'Rendimento', celulas: ['0,84', '0,90', '0,94'] },
            ],
          },
        ]}
      />,
    );

    const grupo = screen.getByRole('rowheader', { name: 'IDEB' }).closest('tbody') as HTMLElement;
    expect(within(grupo).getAllByRole('row')).toHaveLength(2);
    expect(grupo).toHaveTextContent('▲ acima de SC');
    expect(grupo).toHaveClass('quadro-item');
  });
});

describe('AlternadorDeRede', () => {
  it('oferece as cinco redes, nesta ordem, com a atual marcada', () => {
    render(<AlternadorDeRede comparacoes={[dados()]} valor="municipal" aoMudar={() => {}} />);

    const grupo = within(screen.getByRole('group', { name: 'Rede' }));
    expect(grupo.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Pública',
      'Municipal',
      'Estadual',
      'Privada',
      'Todas',
    ]);
    expect(grupo.getByRole('button', { name: 'Municipal' })).toHaveAttribute('aria-pressed', 'true');
    expect(grupo.getByRole('button', { name: 'Pública' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('trocar de rede troca os três lugares', async () => {
    render(<ComAlternador comparacao={dados()} />);
    expect(screen.getByText('Orleans 25,0%')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Municipal' }));

    expect(screen.getByText('Orleans 11,0%')).toBeInTheDocument();
    expect(screen.getByText('SC 12,0%')).toBeInTheDocument();
    expect(screen.getByText('Brasil 13,0%')).toBeInTheDocument();
    expect(screen.queryByText('Orleans 25,0%')).not.toBeInTheDocument();
  });

  it.each(['Estadual', 'Privada', 'Todas'])('%s, sem dado em nenhum lugar, fica desabilitada', (rede) => {
    render(<AlternadorDeRede comparacoes={[dados()]} valor="publica" aoMudar={() => {}} />);

    expect(screen.getByRole('button', { name: rede })).toBeDisabled();
  });

  it('rede com dado fica habilitada', () => {
    render(<AlternadorDeRede comparacoes={[dados()]} valor="publica" aoMudar={() => {}} />);

    expect(screen.getByRole('button', { name: 'Municipal' })).toBeEnabled();
  });

  it('clicar em rede desabilitada não avisa a página, e clicar em rede com dado avisa qual', async () => {
    const aoMudar = vi.fn();
    render(<AlternadorDeRede comparacoes={[dados()]} valor="publica" aoMudar={aoMudar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Privada' }));
    expect(aoMudar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Municipal' }));
    expect(aoMudar).toHaveBeenCalledWith('municipal');
  });
});

describe('SerieDoIdeb', () => {
  const series = [
    {
      lugar: 'orleans',
      pontos: [
        { ano: 2017, valor: 4 },
        { ano: 2019, valor: 5 },
        { ano: 2021, valor: null },
        { ano: 2025, valor: 6 },
      ],
    },
    {
      lugar: 'santaCatarina',
      pontos: [
        { ano: 2017, valor: 4.5 },
        { ano: 2019, valor: 4.6 },
        { ano: 2021, valor: 4.7 },
        { ano: 2023, valor: 4.8 },
        { ano: 2025, valor: 4.9 },
      ],
    },
  ] as const;

  it('ano sem dado quebra a linha: nenhum traço passa por cima da lacuna', () => {
    const { container } = render(<SerieDoIdeb series={series} descricao="IDEB dos anos iniciais" />);

    const orleans = container.querySelectorAll('polyline.orleans');
    expect(orleans).toHaveLength(1);
    expect(orleans[0]).toHaveAttribute('points', '0,180 250,150');
    expect(container.querySelectorAll('polyline.santa-catarina')).toHaveLength(1);
  });

  it('o ponto solto depois da lacuna aparece, e o ano sem dado não vira ponto zerado', () => {
    const { container } = render(<SerieDoIdeb series={series} descricao="IDEB dos anos iniciais" />);

    const orleans = [...container.querySelectorAll<HTMLElement>('.ideb-ponto.orleans')];
    expect(orleans.map((p) => p.style.left)).toEqual(['0%', '25%', '100%']);
    expect(orleans.map((p) => p.style.bottom)).toEqual(['40%', '50%', '60%']);
  });

  it('a figura leva a descrição', () => {
    render(<SerieDoIdeb series={series} descricao="IDEB dos anos iniciais" />);

    expect(screen.getByRole('img', { name: 'IDEB dos anos iniciais' })).toBeInTheDocument();
  });

  it('a tabela traz todos os anos e lugares, com travessão na lacuna, nunca zero', () => {
    render(<SerieDoIdeb series={series} descricao="IDEB dos anos iniciais" />);

    const tabela = screen.getByRole('table', { name: 'IDEB dos anos iniciais' });
    expect(tabela).toHaveClass('visualmente-oculto');
    expect(linhasDa(tabela)).toEqual([
      ['2017', '4,0', '4,5'],
      ['2019', '5,0', '4,6'],
      ['2021', '—', '4,7'],
      ['2023', '—', '4,8'],
      ['2025', '6,0', '4,9'],
    ]);
  });

  it('abre dizendo os valores do último ano, em texto', () => {
    render(<SerieDoIdeb series={series} descricao="IDEB" />);

    expect(screen.getByRole('button', { name: '2025' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Orleans 6,0')).toBeInTheDocument();
    expect(screen.getByText('Santa Catarina 4,9')).toBeInTheDocument();
  });

  it('escolher um ano diz os valores dele, e ano sem dado é travessão', async () => {
    render(<SerieDoIdeb series={series} descricao="IDEB" />);

    await userEvent.click(screen.getByRole('button', { name: '2021' }));

    expect(screen.getByText('Orleans —')).toBeInTheDocument();
    expect(screen.getByText('Santa Catarina 4,7')).toBeInTheDocument();
    expect(screen.queryByText('Orleans 6,0')).not.toBeInTheDocument();
  });

  it('escala do IDEB que não começa em zero está escrita', () => {
    const { container } = render(<SerieDoIdeb series={series} descricao="IDEB" escala={{ min: 3, max: 7 }} />);

    expect(screen.getByText('A escala vai de 3 a 7: não começa em zero.')).toBeInTheDocument();
    expect(container.querySelector<HTMLElement>('.ideb-ponto.orleans')?.style.bottom).toBe('25%');
  });

  it('não usa title como forma de ler o valor', () => {
    const { container } = render(<SerieDoIdeb series={series} descricao="IDEB" />);

    expect(container.querySelector('[title]')).toBeNull();
  });

  const zona = (container: HTMLElement, ano: number) =>
    container.querySelector<HTMLElement>(`.ideb-zona[data-ano="${ano}"]`) as HTMLElement;

  it('passar o mouse num ano abre a dica com os três valores dele', async () => {
    const { container } = render(<SerieDoIdeb series={series} descricao="IDEB" />);

    await userEvent.hover(zona(container, 2019));

    const dica = container.querySelector('.ideb-dica') as HTMLElement;
    expect(within(dica).getByText('2019')).toBeInTheDocument();
    expect(dica).toHaveTextContent('Orleans5,0');
    expect(dica).toHaveTextContent('Santa Catarina4,6');
    expect(dica.querySelector('.ideb-dica-valor.orleans')).toHaveTextContent('5,0');
  });

  it('a dica do ano sem dado diz travessão, e sair da figura fecha a dica', async () => {
    const { container } = render(<SerieDoIdeb series={series} descricao="IDEB" />);

    await userEvent.hover(zona(container, 2021));
    expect(container.querySelector('.ideb-dica')).toHaveTextContent('Orleans—');

    await userEvent.unhover(zona(container, 2021));
    expect(container.querySelector('.ideb-dica')).toBeNull();
  });

  it('o ano sob o mouse destaca os pontos dele', async () => {
    const { container } = render(<SerieDoIdeb series={series} descricao="IDEB" />);

    await userEvent.hover(zona(container, 2019));

    expect([...container.querySelectorAll('.ideb-ponto.is-ativo')].map((p) => p.className)).toEqual([
      'ideb-ponto orleans is-ativo',
      'ideb-ponto santa-catarina is-ativo',
    ]);
  });

  it('a régua marca cada inteiro da escala', () => {
    const { container } = render(<SerieDoIdeb series={series} descricao="IDEB" escala={{ min: 3, max: 7 }} />);

    expect([...container.querySelectorAll('.ideb-eixo-y')].map((r) => r.textContent)).toEqual([
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
  });

  it('com a unidade em percentual, a série serve para a alfabetização', async () => {
    const { container } = render(
      <SerieDoIdeb series={series} descricao="Alfabetização" unidade="%" casas={0} escala={{ min: 0, max: 10 }} />,
    );

    await userEvent.hover(zona(container, 2025));

    expect(container.querySelector('.ideb-dica')).toHaveTextContent('Orleans6%');
  });

  describe('com a meta de Orleans', () => {
    const meta = {
      rotulo: 'Meta de Orleans',
      pontos: [
        { ano: 2019, valor: 5.5 },
        { ano: 2025, valor: 6.5 },
        { ano: 2030, valor: 9.5 },
      ],
    };
    const comMeta = () =>
      render(<SerieDoIdeb series={series} meta={meta} descricao="IDEB" escala={{ min: 3, max: 7 }} />);

    it('a meta é marca vazada só nos anos da série: a de 2030 não estica o eixo', () => {
      const { container } = comMeta();

      const marcas = [...container.querySelectorAll<HTMLElement>('.ideb-meta')];
      expect(marcas.map((m) => [m.style.left, m.style.bottom])).toEqual([
        ['25%', '62.5%'],
        ['100%', '87.5%'],
      ]);
      expect(screen.queryByRole('button', { name: '2030' })).not.toBeInTheDocument();
    });

    it('a dica do ano diz a meta dele; o ano sem meta não ganha linha de meta', async () => {
      const { container } = comMeta();

      await userEvent.hover(zona(container, 2019));
      expect(container.querySelector('.ideb-dica')).toHaveTextContent('Meta de Orleans5,5');

      await userEvent.hover(zona(container, 2023));
      expect(container.querySelector('.ideb-dica')).not.toHaveTextContent('Meta');
    });

    it('a meta do ano escolhido fica escrita, e a tabela ganha a coluna da meta', () => {
      comMeta();

      expect(screen.getByText('Meta de Orleans 6,5')).toBeInTheDocument();
      expect(linhasDa(screen.getByRole('table', { name: 'IDEB' }))).toEqual([
        ['2017', '4,0', '4,5', '—'],
        ['2019', '5,0', '4,6', '5,5'],
        ['2021', '—', '4,7', '—'],
        ['2023', '—', '4,8', '—'],
        ['2025', '6,0', '4,9', '6,5'],
      ]);
    });

    it('a meta acima da escala alarga a escala, sem marca fora do lugar', () => {
      const { container } = render(
        <SerieDoIdeb
          series={series}
          meta={{ rotulo: 'Meta de Orleans', pontos: [{ ano: 2025, valor: 8 }] }}
          descricao="IDEB"
          escala={{ min: 3, max: 7 }}
        />,
      );

      expect(container.querySelector<HTMLElement>('.ideb-meta')?.style.bottom).toBe('100%');
      expect(screen.getByText('A escala vai de 3 a 8: não começa em zero.')).toBeInTheDocument();
    });
  });
});

describe('BarrasPorAno', () => {
  const coluna = (container: HTMLElement, ano: number) =>
    container.querySelector<HTMLElement>(`.bpa-coluna[data-ano="${ano}"]`) as HTMLElement;
  const anos = [
    { ano: 2023, valor: 66 },
    { ano: 2024, valor: 68 },
  ];

  it('passar o mouse numa barra destaca a barra e abre a dica com o ano e o valor', async () => {
    const { container } = render(<BarrasPorAno unidade="%" casas={0} descricao="Alfabetização" barras={anos} />);

    await userEvent.hover(coluna(container, 2024));

    expect(coluna(container, 2024)).toHaveClass('is-ativa');
    expect(coluna(container, 2023)).not.toHaveClass('is-ativa');
    expect(container.querySelector('.bpa-dica')).toHaveTextContent('202468%');
  });

  it('a dica traz o detalhe da barra e o mínimo do ano, e sair da barra fecha a dica', async () => {
    const { container } = render(
      <BarrasPorAno
        unidade="%"
        descricao="Fundeb"
        barras={[{ ano: 2021, valor: 78, minimo: 70 }]}
        detalhar={() => 'R$ 9.054.678,04 aplicados'}
      />,
    );

    await userEvent.hover(coluna(container, 2021));
    const dica = container.querySelector('.bpa-dica') as HTMLElement;
    expect(dica).toHaveTextContent('R$ 9.054.678,04 aplicados');
    expect(dica).toHaveTextContent('Mínimo: 70,0%');

    await userEvent.unhover(coluna(container, 2021));
    expect(container.querySelector('.bpa-dica')).toBeNull();
  });

  it('o teclado também abre a dica, pelo foco na barra', async () => {
    const { container } = render(<BarrasPorAno unidade="%" casas={0} descricao="Alfabetização" barras={anos} />);

    await userEvent.tab();

    expect(coluna(container, 2023)).toHaveFocus();
    expect(container.querySelector('.bpa-dica')).toHaveTextContent('202366%');
  });

  it('com o mínimo de cada barra, a tabela traz a coluna com o mínimo do ano', () => {
    render(
      <BarrasPorAno
        unidade="%"
        descricao="Mínimo por ano"
        barras={[
          { ano: 2020, valor: 80, minimo: 60 },
          { ano: 2021, valor: 78, minimo: 70 },
        ]}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Mínimo' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '2020' }).closest('tr')).toHaveTextContent('60,0%');
    expect(screen.getByRole('rowheader', { name: '2021' }).closest('tr')).toHaveTextContent('70,0%');
  });

  it('sem mínimo por barra, a coluna não aparece', () => {
    render(<BarrasPorAno unidade="%" descricao="Sem mínimo" barras={[{ ano: 2020, valor: 80 }]} />);

    expect(screen.queryByRole('columnheader', { name: 'Mínimo' })).toBeNull();
  });

  const barras = [
    { ano: 2020, valor: 25 },
    { ano: 2021, valor: 0 },
    { ano: 2022, valor: null },
  ];
  const props = { barras, unidade: '%', descricao: 'Aplicação em educação' } as const;
  const alturas = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLElement>('.bpa-barra')].map((b) => b.style.height);

  it('cada ano tem o rótulo do valor, com travessão onde não há dado, nunca zero', () => {
    const { container } = render(<BarrasPorAno {...props} />);

    expect([...container.querySelectorAll('.bpa-valor')].map((v) => v.textContent)).toEqual(['25,0%', '0,0%', '—']);
  });

  it('a altura é proporcional ao topo da escala, e ano sem dado não tem barra', () => {
    const { container } = render(<BarrasPorAno {...props} maximo={50} />);

    expect(alturas(container)).toEqual(['50%', '0%']);
  });

  it('a linha de mínimo fica na altura dele, com o rótulo escrito', () => {
    const { container } = render(
      <BarrasPorAno {...props} maximo={50} minimo={{ valor: 10, rotulo: 'mínimo legal' }} />,
    );

    expect(container.querySelector('.bpa-minimo')).toHaveStyle({ bottom: '20%' });
    expect(screen.getByText('mínimo legal: 10,0%')).toBeInTheDocument();
  });

  it('o mínimo acima do máximo pedido alarga a escala, para caber no gráfico', () => {
    const { container } = render(<BarrasPorAno {...props} maximo={20} minimo={{ valor: 40, rotulo: 'mínimo' }} />);

    expect(container.querySelector('.bpa-minimo')).toHaveStyle({ bottom: '100%' });
  });

  it('sem máximo pedido, o topo é redondo e acima do maior valor', () => {
    const { container } = render(<BarrasPorAno {...props} />);

    expect(alturas(container)).toEqual(['83.33%', '0%']);
  });

  it('sem mínimo, não há linha', () => {
    const { container } = render(<BarrasPorAno {...props} />);

    expect(container.querySelector('.bpa-minimo')).toBeNull();
  });

  it('a tabela para leitor de tela traz os anos e o mínimo', () => {
    render(<BarrasPorAno {...props} minimo={{ valor: 10, rotulo: 'mínimo legal' }} />);

    const tabela = screen.getByRole('table', { name: 'Aplicação em educação' });
    expect(tabela).toHaveClass('visualmente-oculto');
    expect(linhasDa(tabela)).toEqual([
      ['2020', '25,0%'],
      ['2021', '0,0%'],
      ['2022', '—'],
      ['mínimo legal', '10,0%'],
    ]);
  });

  it('`formatar` troca o rótulo, para dinheiro por exemplo, e a falta segue travessão', () => {
    const { container } = render(<BarrasPorAno {...props} formatar={(v) => `R$ ${v}`} />);

    expect([...container.querySelectorAll('.bpa-valor')].map((v) => v.textContent)).toEqual(['R$ 25', 'R$ 0', '—']);
  });
});

describe('BarrasEmpilhadas', () => {
  const linhas = [
    {
      rotulo: 'Anos iniciais',
      partes: [
        { nome: 'Aprovados', valor: 90 },
        { nome: 'Reprovados', valor: 6 },
        { nome: 'Abandono', valor: 4 },
      ],
    },
    {
      rotulo: 'Ensino médio',
      partes: [
        { nome: 'Aprovados', valor: 80 },
        { nome: 'Reprovados', valor: 0 },
        { nome: 'Abandono', valor: null },
      ],
    },
    {
      rotulo: 'EJA',
      partes: [
        { nome: 'Aprovados', valor: null },
        { nome: 'Reprovados', valor: null },
        { nome: 'Abandono', valor: null },
      ],
    },
  ];
  const props = { linhas, descricao: 'Como termina o ano', unidade: '%' } as const;
  const segmentos = (container: HTMLElement, linha: number) => [
    ...(container.querySelectorAll('.emp-barra')[linha]?.querySelectorAll<HTMLElement>('span') ?? []),
  ];

  it('cada parte tem a largura da sua fatia', () => {
    const { container } = render(<BarrasEmpilhadas {...props} />);

    expect(segmentos(container, 0).map((s) => s.style.width)).toEqual(['90%', '6%', '4%']);
  });

  it('parte nula não desenha fatia, e o texto diz travessão; zero diz zero', () => {
    const { container } = render(<BarrasEmpilhadas {...props} />);

    expect(segmentos(container, 1).map((s) => s.style.width)).toEqual(['100%', '0%']);
    expect(screen.getByText('Reprovados 0,0%')).toBeInTheDocument();
    expect(screen.getByText('Abandono —')).toBeInTheDocument();
  });

  it('linha toda sem dado não desenha barra', () => {
    const { container } = render(<BarrasEmpilhadas {...props} />);

    expect(container.querySelectorAll('.emp-barra')).toHaveLength(2);
    expect(screen.getByText('Sem dado.')).toBeInTheDocument();
  });

  it('cada valor escrito leva a amostra do tom da sua fatia, para não grudar no vizinho', () => {
    render(<BarrasEmpilhadas {...props} />);

    const reprovados = screen.getAllByText('Reprovados 6,0%')[0] as HTMLElement;
    expect(reprovados.querySelector('.emp-amostra')).toHaveClass('emp-tom-1');
    expect((screen.getAllByText('Aprovados 90,0%')[0] as HTMLElement).querySelector('.emp-amostra')).toHaveClass(
      'emp-tom-0',
    );
  });

  it('os valores ficam escritos, sem depender de title', () => {
    const { container } = render(<BarrasEmpilhadas {...props} />);

    expect(screen.getByText('Aprovados 90,0%')).toBeInTheDocument();
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('a fatia usa tom neutro pela posição, e o vermelho, que é só de Orleans, fica de fora', () => {
    const { container } = render(<BarrasEmpilhadas {...props} />);

    expect(container.querySelector('.vermelho')).toBeNull();
    expect(segmentos(container, 0).map((s) => s.className)).toEqual(['emp-tom-0', 'emp-tom-1', 'emp-tom-2']);
  });

  it('a legenda traz cada parte uma vez', () => {
    const { container } = render(<BarrasEmpilhadas {...props} />);

    expect([...container.querySelectorAll('.emp-legenda > span')].map((s) => s.textContent)).toEqual([
      'Aprovados',
      'Reprovados',
      'Abandono',
    ]);
  });

  const fatia = (container: HTMLElement, linha: number, parte: string) =>
    container
      .querySelectorAll('.emp-barra')
      [linha]?.querySelector<HTMLElement>(`[data-parte="${parte}"]`) as HTMLElement;

  it('passar o mouse numa fatia destaca só ela e abre a dica com a linha, a parte e o valor', async () => {
    const { container } = render(<BarrasEmpilhadas {...props} />);

    await userEvent.hover(fatia(container, 0, 'Reprovados'));

    expect(fatia(container, 0, 'Reprovados')).toHaveClass('is-ativa');
    expect(fatia(container, 0, 'Aprovados')).not.toHaveClass('is-ativa');
    expect(container.querySelector('.emp-dica')).toHaveTextContent('Anos iniciaisReprovados6,0%');
  });

  it('sair da fatia fecha a dica', async () => {
    const { container } = render(<BarrasEmpilhadas {...props} />);

    await userEvent.hover(fatia(container, 1, 'Aprovados'));
    await userEvent.unhover(fatia(container, 1, 'Aprovados'));

    expect(container.querySelector('.emp-dica')).toBeNull();
  });

  it('o teclado também abre a dica, pelo foco na fatia', async () => {
    const { container } = render(<BarrasEmpilhadas {...props} />);

    await userEvent.tab();

    expect(fatia(container, 0, 'Aprovados')).toHaveFocus();
    expect(container.querySelector('.emp-dica')).toHaveTextContent('Anos iniciaisAprovados90,0%');
  });

  it('a tabela traz uma coluna por parte, com travessão onde falta', () => {
    render(<BarrasEmpilhadas {...props} />);

    const tabela = screen.getByRole('table', { name: 'Como termina o ano' });
    expect(tabela).toHaveClass('visualmente-oculto');
    expect(linhasDa(tabela)).toEqual([
      ['Anos iniciais', '90,0%', '6,0%', '4,0%'],
      ['Ensino médio', '80,0%', '0,0%', '—'],
      ['EJA', '—', '—', '—'],
    ]);
  });

  describe('com apoio por linha', () => {
    const comApoio = [
      { ...linhas[0]!, apoio: 'SC 91,0% · Brasil 92,0%.' },
      { ...linhas[1]!, apoio: 'SC 85,0% · Brasil 84,0%.' },
      linhas[2]!,
    ];

    it('o apoio fica embaixo da barra da própria linha, depois dos valores', () => {
      const { container } = render(<BarrasEmpilhadas {...props} linhas={comApoio} />);

      const linha = container.querySelectorAll('.emp-linha')[1];
      expect(linha?.querySelector('.emp-valores + .emp-apoio')).toHaveTextContent('SC 85,0% · Brasil 84,0%.');
      expect(container.querySelectorAll('.emp-linha')[0]).not.toHaveTextContent('SC 85,0%');
    });

    it('linha sem apoio não ganha o espaço do apoio', () => {
      const { container } = render(<BarrasEmpilhadas {...props} linhas={comApoio} />);

      expect(container.querySelectorAll('.emp-linha')[2]?.querySelector('.emp-apoio')).toBeNull();
    });

    it('a tabela ganha a coluna do apoio, com travessão onde falta', () => {
      render(<BarrasEmpilhadas {...props} linhas={comApoio} />);

      expect(linhasDa(screen.getByRole('table', { name: 'Como termina o ano' }))).toEqual([
        ['Anos iniciais', '90,0%', '6,0%', '4,0%', 'SC 91,0% · Brasil 92,0%.'],
        ['Ensino médio', '80,0%', '0,0%', '—', 'SC 85,0% · Brasil 84,0%.'],
        ['EJA', '—', '—', '—', '—'],
      ]);
    });
  });
});

describe('BarrasHorizontais', () => {
  const reais = (valor: number) => `R$ ${valor.toLocaleString('pt-BR')}`;
  const itens = [
    { nome: 'Fundeb', valor: 200 },
    { nome: 'PNAE', valor: 50 },
    { nome: 'Tempo integral', valor: null, semValor: 'fora do conferido' },
  ];
  const props = { itens, descricao: 'Repasses', formatar: reais };
  // A dica repete o nome: o item se acha pelo nome da linha, não pelo texto solto.
  const item = (nome: string) =>
    [...document.querySelectorAll<HTMLElement>('.bh-item')].find(
      (li) => li.querySelector('.bh-nome')?.textContent === nome,
    ) as HTMLElement;
  const barra = (nome: string) => item(nome).querySelector<HTMLElement>('.bh-barra');

  it('o valor fica escrito ao lado do nome, e a barra tem a largura relativa ao maior', () => {
    render(<BarrasHorizontais {...props} />);

    expect(item('Fundeb')).toHaveTextContent('Fundeb R$ 200');
    expect(barra('Fundeb')?.style.width).toBe('100%');
    expect(barra('PNAE')?.style.width).toBe('25%');
  });

  it('o item sem valor mostra o texto dele, sem barra e sem foco', () => {
    render(<BarrasHorizontais {...props} />);

    expect(item('Tempo integral')).toHaveTextContent('fora do conferido');
    expect(item('Tempo integral')).not.toHaveTextContent('R$');
    expect(barra('Tempo integral')).toBeNull();
    expect(item('Tempo integral')).not.toHaveAttribute('tabindex');
  });

  it('passar o mouse destaca o item e abre a dica com nome, valor e detalhe; sair fecha', async () => {
    const { container } = render(<BarrasHorizontais {...props} detalhar={(i) => `${i.nome}: detalhe`} />);

    await userEvent.hover(item('PNAE'));
    expect(item('PNAE')).toHaveClass('is-ativa');
    expect(item('Fundeb')).not.toHaveClass('is-ativa');
    expect(container.querySelector('.bh-dica')).toHaveTextContent('PNAER$ 50PNAE: detalhe');

    await userEvent.unhover(item('PNAE'));
    expect(container.querySelector('.bh-dica')).toBeNull();
  });

  it('o teclado também abre a dica, pelo foco no item', async () => {
    const { container } = render(<BarrasHorizontais {...props} />);

    await userEvent.tab();

    expect(item('Fundeb')).toHaveFocus();
    expect(container.querySelector('.bh-dica')).toHaveTextContent('FundebR$ 200');
  });

  it('a lista leva a descrição, e nenhum valor depende de title', () => {
    const { container } = render(<BarrasHorizontais {...props} />);

    expect(screen.getByRole('list', { name: 'Repasses' })).toBeInTheDocument();
    expect(container.querySelector('[title]')).toBeNull();
  });
});

describe('BlocoDoCaderno', () => {
  const fonte = { nome: 'INEP', url: 'https://inep.exemplo/indicadores' };

  it('o título é um heading que nomeia a seção, e o selo padrão é o de fonte única', () => {
    render(
      <BlocoDoCaderno titulo="Abandono" fonte={fonte}>
        <p>Conteúdo</p>
      </BlocoDoCaderno>,
    );

    const secao = screen.getByRole('region', { name: 'Abandono' });
    expect(within(secao).getByRole('heading', { level: 2, name: 'Abandono' })).toBeInTheDocument();
    expect(within(secao).getByRole('button', { name: 'fonte única, sem conferência' })).toBeInTheDocument();
    expect(within(secao).getByText('Conteúdo')).toBeInTheDocument();
  });

  it('o selo fica no cabeçalho, junto do título', () => {
    render(<BlocoDoCaderno titulo="Abandono" fonte={fonte} />);

    const titulo = screen.getByRole('heading', { name: 'Abandono' });
    expect(within(titulo.parentElement as HTMLElement).getByRole('button')).toBeInTheDocument();
  });

  it('a página pode trocar o selo', () => {
    render(<BlocoDoCaderno titulo="Gasto" fonte={fonte} selo={seloAguardando()} />);

    expect(screen.getByText('aguardando TCE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'fonte única, sem conferência' })).not.toBeInTheDocument();
  });

  it('`selo={null}` tira o selo', () => {
    render(<BlocoDoCaderno titulo="Definições" selo={null} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('a fonte leva ao endereço de origem, e diz o ano', () => {
    const { container } = render(<BlocoDoCaderno titulo="Abandono" fonte={fonte} ano="2025" />);

    expect(screen.getByRole('link', { name: 'INEP' })).toHaveAttribute('href', 'https://inep.exemplo/indicadores');
    expect(container.querySelector('.bloco-fonte')).toHaveTextContent('Fonte: INEP · 2025');
  });

  it('a nota aparece; sem nota e sem fonte, nada sobra', () => {
    const { container, rerender } = render(<BlocoDoCaderno titulo="Abandono" nota="Poucos alunos." />);
    expect(screen.getByText('Poucos alunos.')).toBeInTheDocument();

    rerender(<BlocoDoCaderno titulo="Abandono" />);
    expect(container.querySelector('.bloco-nota')).toBeNull();
    expect(container.querySelector('.bloco-fonte')).toBeNull();
  });

  it('`meta` mostra os metadados da coleta, com o componente Fonte', () => {
    const meta = {
      fonte: 'IBGE',
      consultaId: 900107,
      consultaNome: 'Rede escolar',
      urlOrigem: 'https://ibge.exemplo',
      filtro: {},
      coletadoEm: '2026-11-04T12:00:00.000Z',
      capturados: 1,
      totalHits: 1,
      idsUnicos: 1,
      status: 'coletado',
      conferencia: [],
    } as unknown as Meta;

    const { container } = render(<BlocoDoCaderno titulo="Matrículas" meta={meta} />);

    expect(container.querySelector('details.fonte summary')).toHaveTextContent(/Fonte: IBGE · consulta 900107/);
  });
});

describe('CabecalhoDoCaderno', () => {
  it('o título é o heading principal, com a entrada embaixo', () => {
    render(<CabecalhoDoCaderno titulo="Quem está na escola">Texto de entrada.</CabecalhoDoCaderno>);

    expect(screen.getByRole('heading', { level: 1, name: 'Quem está na escola' })).toBeInTheDocument();
    expect(screen.getByText('Texto de entrada.')).toBeInTheDocument();
  });

  it('traz a legenda dos três lugares, sem a frase global de fonte única', () => {
    render(<CabecalhoDoCaderno titulo="T" />);

    const legenda = screen.getByLabelText('Legenda das comparações');
    expect(legenda).toHaveTextContent('Orleans');
    expect(legenda).toHaveTextContent('Santa Catarina');
    expect(legenda).toHaveTextContent('Brasil');
    expect(legenda).not.toHaveTextContent(/fonte única/i);
  });

  it('`semLegenda` tira a legenda, na aba sem comparação', () => {
    render(<CabecalhoDoCaderno titulo="T" semLegenda />);

    expect(screen.queryByLabelText('Legenda das comparações')).not.toBeInTheDocument();
  });
});
