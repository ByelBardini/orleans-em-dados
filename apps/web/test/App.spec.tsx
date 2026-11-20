import { act, render, screen, waitFor, within } from '@testing-library/react';
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
vi.mock('../src/paginas/educacao/Resumo', () => ({ default: () => <p>Página educação resumo</p> }));
vi.mock('../src/paginas/educacao/Aprendizado', () => ({ default: () => <p>Página educação aprendizado</p> }));
vi.mock('../src/paginas/educacao/Acesso', () => ({ default: () => <p>Página educação acesso</p> }));
vi.mock('../src/paginas/educacao/Permanencia', () => ({ default: () => <p>Página educação permanência</p> }));
vi.mock('../src/paginas/educacao/Professores', () => ({ default: () => <p>Página educação professores</p> }));
vi.mock('../src/paginas/educacao/Dinheiro', () => ({ default: () => <p>Página educação dinheiro</p> }));
vi.mock('../src/paginas/educacao/Cidade', () => ({ default: () => <p>Página educação cidade</p> }));

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

/** O endereço com que o navegador abre o painel. */
const abrir = (endereco: string) => history.replaceState(null, '', endereco);
const meta = (nome: string) => document.querySelector<HTMLMetaElement>(`meta[name="${nome}"]`)?.content;

beforeEach(() => {
  abrir('/');
  vi.stubGlobal('scrollTo', () => {});
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('App', () => {
  it('abre na capa', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();

    render(<App />);

    expect(await screen.findByText('Página capa')).toBeInTheDocument();
    expect(document.title).toBe('Orleans em Dados · Dados públicos de Orleans/SC');
  });

  it('`/financas` abre o conteúdo financeiro, no exercício mais recente publicado', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/financas');

    render(<App />);

    expect(await screen.findByText('Página finanças 2026')).toBeInTheDocument();
  });

  it.each([
    ['/conheca-orleans', 'Página conheça Orleans'],
    ['/financas/para-onde-vai', 'Página para onde vai'],
  ])('%s abre mesmo sem exercício publicado', async (caminho, texto) => {
    new FetchFake().responder('/api/anos', { ...ANOS, anos: [], atualizadoEm: {} }).instalar();
    abrir(caminho);

    render(<App />);

    expect(await screen.findByText(texto)).toBeInTheDocument();
  });

  it('a capa e as páginas sem exercício não dizem um exercício no cabeçalho', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/conheca-orleans');

    render(<App />);
    await screen.findByText('Página conheça Orleans');

    expect(screen.queryByText(/Exercício de 2026/)).not.toBeInTheDocument();
  });

  it('a capa cita as fontes, com as de educação, e o rodapé também', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();

    render(<App />);
    await screen.findByText('Página capa');

    expect(
      screen.getByText(/Fontes: IBGE, INEP, MEC, SIOPE, SICONFI, Portal da Transparência e TCE-SC/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/despesa por função do SICONFI,\s+indicadores do IBGE e, na educação, INEP, SIOPE e MEC/),
    ).toBeInTheDocument();
  });

  it('o cabeçalho das páginas financeiras diz o exercício e quando foi atualizado', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/financas');

    render(<App />);

    expect(await screen.findByText(/Exercício de 2026 · Atualizado em 10 de março de 2026/)).toBeInTheDocument();
  });

  it('o caminho escolhe a página, e o título e a descrição são os do catálogo', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/financas/receitas');

    render(<App />);

    expect(await screen.findByText('Página receitas 2026')).toBeInTheDocument();
    expect(document.title).toBe('Receitas do município de Orleans/SC · Orleans em Dados');
    expect(meta('description')).toBe(
      'Receitas do município de Orleans/SC por mês, origem e rubrica, do Portal da Transparência conferidas com o TCE-SC, com a previsão e a arrecadação.',
    );
    expect(meta('robots')).toBeUndefined();
  });

  it('`/discrepancias` abre a aba de discrepâncias, marcada na navegação', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/discrepancias');

    render(<App />);

    expect(await screen.findByText('Página discrepâncias')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Discrepâncias' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['/#receitas', '/financas/receitas', 'Página receitas 2026'],
    ['/#conferencia', '/discrepancias', 'Página discrepâncias'],
    ['/#educacao-dinheiro', '/educacao/dinheiro', 'Página educação dinheiro'],
    ['/#visao-geral', '/', 'Página capa'],
  ])('o link antigo %s cai em %s, sem entrada nova no histórico', async (antigo, caminho, texto) => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir(antigo);
    const entradas = history.length;

    render(<App />);

    expect(await screen.findByText(texto)).toBeInTheDocument();
    expect(location.pathname).toBe(caminho);
    expect(location.hash).toBe('');
    expect(history.length).toBe(entradas);
  });

  it('caminho com barra no fim abre a página e fica sem a barra', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/educacao/acesso/');

    render(<App />);

    expect(await screen.findByText('Página educação acesso')).toBeInTheDocument();
    expect(location.pathname).toBe('/educacao/acesso');
  });

  it.each(['/financas/nao-existe', '/Financas', '/educacao-'])(
    'caminho desconhecido %s mostra "Página não encontrada", fora dos buscadores',
    async (caminho) => {
      new FetchFake().responder('/api/anos', ANOS).instalar();
      abrir(caminho);

      render(<App />);

      expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
      expect(meta('robots')).toBe('noindex');
      expect(screen.queryByText('Página capa')).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: /Páginas de/ })).not.toBeInTheDocument();
    },
  );

  it('sair da página não encontrada para uma página do painel tira o noindex', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/nada');
    render(<App />);
    await screen.findByRole('heading', { name: 'Página não encontrada' });

    await userEvent.click(screen.getByRole('link', { name: 'Voltar ao início' }));

    expect(await screen.findByText('Página capa')).toBeInTheDocument();
    expect(meta('robots')).toBeUndefined();
  });

  it('clicar na navegação troca a página pelo histórico, sem recarregar nem buscar os anos de novo', async () => {
    const fetch = new FetchFake().responder('/api/anos', ANOS).instalar();
    render(<App />);
    await screen.findByText('Página capa');
    const entradas = history.length;

    await userEvent.click(screen.getByRole('link', { name: 'Discrepâncias' }));

    expect(await screen.findByText('Página discrepâncias')).toBeInTheDocument();
    expect(location.pathname).toBe('/discrepancias');
    expect(history.length).toBe(entradas + 1);
    expect(screen.getByRole('link', { name: 'Discrepâncias' })).toHaveAttribute('aria-current', 'page');
    expect(fetch.pedidos.filter((p) => p === '/api/anos')).toHaveLength(1);
  });

  it('voltar no navegador mostra a página anterior', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    render(<App />);
    await screen.findByText('Página capa');
    await userEvent.click(screen.getByRole('link', { name: 'Finanças' }));
    await screen.findByText('Página finanças 2026');
    await userEvent.click(screen.getByRole('link', { name: 'Receitas' }));
    await screen.findByText('Página receitas 2026');

    act(() => {
      history.replaceState(null, '', '/financas');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(await screen.findByText('Página finanças 2026')).toBeInTheDocument();
    expect(document.title).toBe('Finanças públicas de Orleans/SC · Orleans em Dados');
  });

  it('clique com Ctrl numa aba fica com o navegador, que abre outra guia', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    render(<App />);
    await screen.findByText('Página capa');
    // No navegador, o Ctrl abriria outra guia; no jsdom, o ouvinte da janela só segura o link.
    const segurar = (evento: MouseEvent) => evento.preventDefault();
    window.addEventListener('click', segurar);
    const usuario = userEvent.setup();

    await usuario.keyboard('{Control>}');
    await usuario.click(screen.getByRole('link', { name: 'Discrepâncias' }));
    await usuario.keyboard('{/Control}');

    window.removeEventListener('click', segurar);
    expect(location.pathname).toBe('/');
    expect(screen.getByText('Página capa')).toBeInTheDocument();
  });

  const ABAS_DA_EDUCACAO = [
    ['Resumo', '/educacao'],
    ['Aprendizado', '/educacao/aprendizado'],
    ['Acesso', '/educacao/acesso'],
    ['Permanência', '/educacao/permanencia'],
    ['Professores e turmas', '/educacao/professores-e-turmas'],
    ['Dinheiro', '/educacao/dinheiro'],
    ['Cidade e ensino superior', '/educacao/cidade-e-ensino-superior'],
  ];

  it.each([
    ['/educacao', 'Resumo', 'Página educação resumo', 'Educação pública em Orleans/SC · Orleans em Dados'],
    [
      '/educacao/aprendizado',
      'Aprendizado',
      'Página educação aprendizado',
      'IDEB e aprendizado em Orleans/SC · Orleans em Dados',
    ],
    [
      '/educacao/acesso',
      'Acesso',
      'Página educação acesso',
      'Creche, pré-escola e escola em Orleans/SC · Orleans em Dados',
    ],
    [
      '/educacao/permanencia',
      'Permanência',
      'Página educação permanência',
      'Abandono e evasão escolar em Orleans/SC · Orleans em Dados',
    ],
    [
      '/educacao/professores-e-turmas',
      'Professores e turmas',
      'Página educação professores',
      'Professores e turmas em Orleans/SC · Orleans em Dados',
    ],
    [
      '/educacao/dinheiro',
      'Dinheiro',
      'Página educação dinheiro',
      'Gasto com educação em Orleans/SC · Orleans em Dados',
    ],
    [
      '/educacao/cidade-e-ensino-superior',
      'Cidade e ensino superior',
      'Página educação cidade',
      'Ensino superior em Orleans/SC · Orleans em Dados',
    ],
  ])('%s abre %s no segundo nível de Educação, com o título do catálogo', async (caminho, atual, texto, titulo) => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir(caminho);

    render(<App />);
    await screen.findByText(texto);

    expect(linksDa('Páginas de Educação')).toEqual(ABAS_DA_EDUCACAO);
    const segundoNivel = within(screen.getByRole('navigation', { name: 'Páginas de Educação' }));
    expect(segundoNivel.getByRole('link', { name: atual })).toHaveAttribute('aria-current', 'page');
    expect(segundoNivel.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
    const primeiroNivel = within(screen.getByRole('navigation', { name: 'Principal' }));
    expect(primeiroNivel.getByRole('link', { name: 'Educação' })).toHaveAttribute('aria-current', 'true');
    expect(primeiroNivel.getByRole('link', { name: 'Finanças' })).not.toHaveAttribute('aria-current');
    expect(document.title).toBe(titulo);
  });

  it('Educação abre sem exercício publicado, e o cabeçalho diz o caderno', async () => {
    new FetchFake().responder('/api/anos', { ...ANOS, anos: [], atualizadoEm: {} }).instalar();
    abrir('/educacao/acesso');

    render(<App />);

    expect(await screen.findByText('Página educação acesso')).toBeInTheDocument();
    expect(screen.getByText('Caderno de Educação')).toBeInTheDocument();
  });

  it('Educação, com exercício publicado, não diz um exercício no cabeçalho', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/educacao');

    render(<App />);
    await screen.findByText('Página educação resumo');

    expect(screen.queryByText(/Exercício de 2026/)).not.toBeInTheDocument();
  });

  it('o primeiro nível da navegação traz as seis áreas, nesta ordem, com caminhos', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();

    render(<App />);
    await screen.findByText('Página capa');

    expect(linksDa('Principal')).toEqual([
      ['Início', '/'],
      ['Conheça Orleans', '/conheca-orleans'],
      ['Finanças', '/financas'],
      ['Educação', '/educacao'],
      ['Discrepâncias', '/discrepancias'],
      ['Sobre os dados', '/sobre-os-dados'],
    ]);
  });

  it.each([
    ['/financas', 'Resumo', 'Página finanças 2026'],
    ['/financas/receitas', 'Receitas', 'Página receitas 2026'],
    ['/financas/despesas', 'Despesas', 'Página despesas'],
    ['/financas/para-onde-vai', 'Para onde vai', 'Página para onde vai'],
  ])('%s mostra o segundo nível, com %s como página atual e Finanças como área', async (caminho, atual, texto) => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir(caminho);

    render(<App />);
    await screen.findByText(texto);

    expect(linksDa('Páginas de Finanças')).toEqual([
      ['Resumo', '/financas'],
      ['Receitas', '/financas/receitas'],
      ['Despesas', '/financas/despesas'],
      ['Para onde vai', '/financas/para-onde-vai'],
    ]);
    const segundoNivel = within(screen.getByRole('navigation', { name: 'Páginas de Finanças' }));
    expect(segundoNivel.getByRole('link', { name: atual })).toHaveAttribute('aria-current', 'page');
    expect(segundoNivel.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
    const primeiroNivel = within(screen.getByRole('navigation', { name: 'Principal' }));
    expect(primeiroNivel.getByRole('link', { name: 'Finanças' })).toHaveAttribute('aria-current', 'true');
  });

  it.each([
    ['/', 'Início', 'Página capa'],
    ['/conheca-orleans', 'Conheça Orleans', 'Página conheça Orleans'],
    ['/discrepancias', 'Discrepâncias', 'Página discrepâncias'],
    ['/sobre-os-dados', 'Sobre os dados', 'Página metodologia'],
  ])('%s não mostra o segundo nível, e só %s fica marcada', async (caminho, atual, texto) => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir(caminho);

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

  it('a marca do cabeçalho leva ao início', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/financas');
    render(<App />);
    await screen.findByText('Página finanças 2026');

    await userEvent.click(screen.getByRole('link', { name: /Orleans em Dados/ }));

    await waitFor(() => expect(screen.getByText('Página capa')).toBeInTheDocument());
    expect(location.pathname).toBe('/');
  });

  it.each([
    ['/', 'Página capa'],
    ['/financas/receitas', 'Página receitas 2026'],
    ['/sobre-os-dados', 'Página metodologia'],
  ])('em %s, o botão de tema vem antes de tudo, uma vez só', async (caminho, texto) => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir(caminho);

    const { container } = render(<App />);
    await screen.findByText(texto);

    expect(screen.getByRole('button', { name: /^Usar tema/ })).toBeInTheDocument();
    expect(container.textContent).toMatch(/^\S+ Tema (claro|escuro)/);
  });

  it('sem nenhum ano publicado, avisa e não abre página que depende do exercício', async () => {
    new FetchFake().responder('/api/anos', { ...ANOS, anos: [], atualizadoEm: {} }).instalar();
    abrir('/financas');

    render(<App />);

    expect(await screen.findByText('Nenhum snapshot disponível.')).toBeInTheDocument();
    expect(screen.queryByText(/Página finanças/)).not.toBeInTheDocument();
  });

  it('a metodologia abre mesmo sem ano publicado', async () => {
    new FetchFake().responder('/api/anos', { ...ANOS, anos: [], atualizadoEm: {} }).instalar();
    abrir('/sobre-os-dados');

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

  it('a página abre com o aviso de carregamento enquanto o código dela chega', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/educacao/acesso');
    // Um App recém-importado: nos testes anteriores, o código da página já chegou.
    vi.resetModules();
    const { default: AppNovo } = await import('../src/App');

    render(<AppNovo />);

    expect(screen.getByText('Carregando a página…')).toBeInTheDocument();
    expect(await screen.findByText('Página educação acesso')).toBeInTheDocument();
    expect(screen.queryByText('Carregando a página…')).not.toBeInTheDocument();
  });

  it('voltar a uma página já aberta não mostra o carregamento de novo', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    abrir('/educacao/acesso');
    render(<App />);
    await screen.findByText('Página educação acesso');
    await userEvent.click(screen.getByRole('link', { name: 'Aprendizado' }));
    await screen.findByText('Página educação aprendizado');

    await userEvent.click(screen.getByRole('link', { name: 'Acesso' }));

    expect(screen.getByText('Página educação acesso')).toBeInTheDocument();
    expect(screen.queryByText('Carregando a página…')).not.toBeInTheDocument();
  });

  it('o rodapé oferece os CSV do exercício atual e aponta as páginas por caminho', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();

    render(<App />);

    expect(await screen.findByRole('link', { name: 'Receitas 2026 (CSV)' })).toHaveAttribute(
      'href',
      '/api/receitas.csv?ano=2026',
    );
    expect(screen.getByRole('link', { name: 'Onde as fontes divergem' })).toHaveAttribute('href', '/discrepancias');
    expect(screen.getByRole('link', { name: 'Como os números são conferidos' })).toHaveAttribute(
      'href',
      '/sobre-os-dados',
    );
  });
});
