import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { FetchFake } from './support/fetch-fake';

// As páginas têm spec próprio: aqui, só o que o App decide.
vi.mock('../src/paginas/VisaoGeral', () => ({
  default: ({ ano }: { ano: number }) => <p>Página visão geral {ano}</p>,
}));
vi.mock('../src/paginas/Receitas', () => ({ default: ({ ano }: { ano: number }) => <p>Página receitas {ano}</p> }));
vi.mock('../src/paginas/Despesas', () => ({ default: () => <p>Página despesas</p> }));
vi.mock('../src/paginas/Conferencia', () => ({ default: () => <p>Página conferência</p> }));
vi.mock('../src/paginas/Metodologia', () => ({ default: () => <p>Página metodologia</p> }));

const ANOS = {
  anos: [2026, 2025],
  exemplo: false,
  atualizadoEm: { 2026: '2026-03-10T06:00:00.000Z', 2025: '2025-03-01T12:00:00.000Z' },
  entidades: [{ codigo: '728', nome: 'Prefeitura Municipal', sigla: 'Prefeitura' }],
};

beforeEach(() => {
  window.location.hash = '';
  vi.stubGlobal('scrollTo', () => {});
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('abre na visão geral, no exercício mais recente publicado', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();

    render(<App />);

    expect(await screen.findByText('Página visão geral 2026')).toBeInTheDocument();
  });

  it('o cabeçalho diz o exercício e quando foi atualizado', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();

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

  it('hash desconhecido cai na visão geral', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    window.location.hash = '#inexistente';

    render(<App />);

    expect(await screen.findByText('Página visão geral 2026')).toBeInTheDocument();
  });

  it('clicar na navegação troca a aba e marca a atual', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    render(<App />);
    await screen.findByText('Página visão geral 2026');

    await userEvent.click(screen.getByRole('link', { name: 'Conferência' }));

    await waitFor(() => expect(screen.getByText('Página conferência')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Conferência' })).toHaveAttribute('aria-current', 'page');
  });

  it('sem nenhum ano publicado, avisa e não abre página de dados', async () => {
    new FetchFake().responder('/api/anos', { ...ANOS, anos: [], atualizadoEm: {} }).instalar();

    render(<App />);

    expect(await screen.findByText('Nenhum snapshot disponível.')).toBeInTheDocument();
    expect(screen.queryByText(/Página visão geral/)).not.toBeInTheDocument();
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
