import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { FetchFake } from './support/fetch-fake';

// As páginas têm spec próprio: aqui, só o que o App decide.
vi.mock('../src/paginas/Capa', () => ({ default: () => <p>Página capa</p> }));
vi.mock('../src/paginas/ConhecaOrleans', () => ({ default: () => <p>Página conheça Orleans</p> }));
vi.mock('../src/paginas/ParaOndeVai', () => ({ default: () => <p>Página para onde vai</p> }));
vi.mock('../src/paginas/Financas', () => ({
  default: ({ ano }: { ano: number }) => <p>Página finanças {ano}</p>,
}));
vi.mock('../src/paginas/Receitas', () => ({ default: ({ ano }: { ano: number }) => <p>Página receitas {ano}</p> }));
vi.mock('../src/paginas/Despesas', () => ({ default: () => <p>Página despesas</p> }));
vi.mock('../src/paginas/Discrepancias', () => ({ default: () => <p>Página discrepâncias</p> }));
vi.mock('../src/paginas/Metodologia', () => ({ default: () => <p>Página metodologia</p> }));

const ANOS = {
  anos: [2026, 2025],
  exemplo: false,
  atualizadoEm: { 2026: '2026-03-10T06:00:00.000Z', 2025: '2025-03-01T12:00:00.000Z' },
  entidades: [{ codigo: '728', nome: 'Prefeitura Municipal', sigla: 'Prefeitura' }],
};

const linksDa = (navegacao: string) =>
  within(screen.getByRole('navigation', { name: navegacao }))
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);

beforeEach(() => {
  window.location.hash = '';
  vi.stubGlobal('scrollTo', () => {});
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('abre na capa', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();

    render(<App />);

    expect(await screen.findByText('Página capa')).toBeInTheDocument();
    expect(document.title).toBe('Orleans em Dados');
  });

  it('`#visao-geral` abre a capa', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = '#visao-geral';

    render(<App />);

    expect(await screen.findByText('Página capa')).toBeInTheDocument();
  });

  it('`#financas` abre o conteúdo financeiro, no exercício mais recente publicado', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = '#financas';

    render(<App />);

    expect(await screen.findByText('Página finanças 2026')).toBeInTheDocument();
    expect(document.title).toBe('Finanças · Orleans em Dados');
  });

  it.each([
    ['#conheca-orleans', 'Página conheça Orleans'],
    ['#para-onde-vai', 'Página para onde vai'],
  ])('%s abre mesmo sem exercício publicado', async (hash, texto) => {
    new FetchFake().responder('/api/anos', { ...ANOS, anos: [], atualizadoEm: {} }).instalar();
    window.location.hash = hash;

    render(<App />);

    expect(await screen.findByText(texto)).toBeInTheDocument();
  });

  it('a capa e as páginas sem exercício não dizem um exercício no cabeçalho', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = '#conheca-orleans';

    render(<App />);
    await screen.findByText('Página conheça Orleans');

    expect(screen.queryByText(/Exercício de 2026/)).not.toBeInTheDocument();
  });

  it('a capa cita as quatro fontes, e o rodapé também', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();

    render(<App />);
    await screen.findByText('Página capa');

    expect(screen.getByText(/Fontes: IBGE, SICONFI, Portal da Transparência e TCE-SC/)).toBeInTheDocument();
    expect(screen.getByText(/despesa por função do SICONFI e\s+indicadores do IBGE/)).toBeInTheDocument();
  });

  it('o cabeçalho das páginas financeiras diz o exercício e quando foi atualizado', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = '#financas';

    render(<App />);

    expect(await screen.findByText(/Exercício de 2026 · Atualizado em 10 de março de 2026/)).toBeInTheDocument();
  });

  it('o hash da URL escolhe a aba, e o título da janela acompanha', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = '#receitas';

    render(<App />);

    expect(await screen.findByText('Página receitas 2026')).toBeInTheDocument();
    expect(document.title).toBe('Receitas · Orleans em Dados');
  });

  it.each(['#discrepancias', '#conferencia'])('%s abre a aba de discrepâncias, marcada na navegação', async (hash) => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = hash;

    render(<App />);

    expect(await screen.findByText('Página discrepâncias')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Discrepâncias' })).toHaveAttribute('aria-current', 'page');
  });

  it('hash desconhecido cai na capa', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = '#inexistente';

    render(<App />);

    expect(await screen.findByText('Página capa')).toBeInTheDocument();
  });

  it('clicar na navegação troca a aba e marca a atual', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    render(<App />);
    await screen.findByText('Página capa');

    await userEvent.click(screen.getByRole('link', { name: 'Discrepâncias' }));

    await waitFor(() => expect(screen.getByText('Página discrepâncias')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Discrepâncias' })).toHaveAttribute('aria-current', 'page');
  });

  it('o primeiro nível da navegação traz as cinco áreas, nesta ordem', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();

    render(<App />);
    await screen.findByText('Página capa');

    expect(linksDa('Principal')).toEqual([
      ['Início', '#visao-geral'],
      ['Conheça Orleans', '#conheca-orleans'],
      ['Finanças', '#financas'],
      ['Discrepâncias', '#discrepancias'],
      ['Sobre os dados', '#metodologia'],
    ]);
  });

  it.each([
    ['#financas', 'Resumo', 'Página finanças 2026'],
    ['#receitas', 'Receitas', 'Página receitas 2026'],
    ['#despesas', 'Despesas', 'Página despesas'],
    ['#para-onde-vai', 'Para onde vai', 'Página para onde vai'],
  ])('%s mostra o segundo nível, com %s como página atual e Finanças como área', async (hash, atual, texto) => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = hash;

    render(<App />);
    await screen.findByText(texto);

    expect(linksDa('Páginas de Finanças')).toEqual([
      ['Resumo', '#financas'],
      ['Receitas', '#receitas'],
      ['Despesas', '#despesas'],
      ['Para onde vai', '#para-onde-vai'],
    ]);
    const segundoNivel = within(screen.getByRole('navigation', { name: 'Páginas de Finanças' }));
    expect(segundoNivel.getByRole('link', { name: atual })).toHaveAttribute('aria-current', 'page');
    expect(segundoNivel.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
    const primeiroNivel = within(screen.getByRole('navigation', { name: 'Principal' }));
    expect(primeiroNivel.getByRole('link', { name: 'Finanças' })).toHaveAttribute('aria-current', 'true');
  });

  it.each([
    ['#visao-geral', 'Início', 'Página capa'],
    ['#conheca-orleans', 'Conheça Orleans', 'Página conheça Orleans'],
    ['#discrepancias', 'Discrepâncias', 'Página discrepâncias'],
    ['#metodologia', 'Sobre os dados', 'Página metodologia'],
  ])('%s não mostra o segundo nível, e só %s fica marcada', async (hash, atual, texto) => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = hash;

    render(<App />);
    await screen.findByText(texto);

    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    const primeiroNivel = within(screen.getByRole('navigation', { name: 'Principal' }));
    expect(primeiroNivel.getByRole('link', { name: atual })).toHaveAttribute('aria-current', 'page');
    expect(primeiroNivel.getByRole('link', { name: 'Finanças' })).not.toHaveAttribute('aria-current');
  });

  it('entrar em Finanças abre o segundo nível, e sair da área o fecha', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    render(<App />);
    await screen.findByText('Página capa');

    await userEvent.click(screen.getByRole('link', { name: 'Finanças' }));
    await screen.findByText('Página finanças 2026');
    await userEvent.click(screen.getByRole('link', { name: 'Despesas' }));
    await screen.findByText('Página despesas');
    await userEvent.click(screen.getByRole('link', { name: 'Discrepâncias' }));
    await screen.findByText('Página discrepâncias');

    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it.each([
    ['#visao-geral', 'Página capa'],
    ['#receitas', 'Página receitas 2026'],
    ['#metodologia', 'Página metodologia'],
  ])('em %s, o botão de tema vem antes de tudo, uma vez só', async (hash, texto) => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = hash;

    const { container } = render(<App />);
    await screen.findByText(texto);

    expect(screen.getByRole('button', { name: /^Usar tema/ })).toBeInTheDocument();
    expect(container.textContent).toMatch(/^\S+ Tema (claro|escuro)/);
  });

  it('sem nenhum ano publicado, avisa e não abre página que depende do exercício', async () => {
    new FetchFake().responder('/api/anos', { ...ANOS, anos: [], atualizadoEm: {} }).instalar();
    window.location.hash = '#financas';

    render(<App />);

    expect(await screen.findByText('Nenhum snapshot disponível.')).toBeInTheDocument();
    expect(screen.queryByText(/Página finanças/)).not.toBeInTheDocument();
  });

  it('a metodologia abre mesmo sem ano publicado', async () => {
    new FetchFake().responder('/api/anos', { ...ANOS, anos: [], atualizadoEm: {} }).instalar();
    window.location.hash = '#metodologia';

    render(<App />);

    expect(await screen.findByText('Página metodologia')).toBeInTheDocument();
  });

  it('dados de exemplo são avisados como fictícios, com o comando atual para baixar os reais', async () => {
    new FetchFake().responder('/api/anos', { ...ANOS, exemplo: true }).instalar();

    render(<App />);

    expect(await screen.findByText('dados fictícios')).toBeInTheDocument();
    expect(screen.getByText('pnpm importar betha --ano 2025')).toBeInTheDocument();
  });

  it('erro ao carregar os anos aparece, sem abrir página', async () => {
    new FetchFake().responder('/api/anos', { erro: 'fora do ar' }, 500).instalar();

    render(<App />);

    expect(await screen.findByText('Não foi possível carregar: fora do ar')).toBeInTheDocument();
  });

  it('o rodapé oferece os CSV do exercício atual', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();

    render(<App />);

    expect(await screen.findByRole('link', { name: 'Receitas 2026 (CSV)' })).toHaveAttribute(
      'href',
      '/api/receitas.csv?ano=2026',
    );
  });
});
