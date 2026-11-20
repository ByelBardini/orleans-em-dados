// O código de cada página chega à parte: se a rede falha no meio, a tela diz e oferece recarregar.
// Em arquivo próprio porque o mock que falha valeria para todos os testes do App.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { FetchFake } from './support/fetch-fake';

vi.mock('../src/paginas/Capa', () => ({ default: () => <p>Página capa</p> }));
vi.mock('../src/paginas/educacao/Resumo', () => ({ default: () => <p>Página educação resumo</p> }));
vi.mock('../src/paginas/educacao/Acesso', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

const ANOS = { anos: [2025], exemplo: false, atualizadoEm: {}, entidades: [] };

beforeEach(() => {
  history.replaceState(null, '', '/');
  vi.stubGlobal('scrollTo', () => {});
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  // O React avisa no console do erro que a fronteira pegou; aqui, ele é o cenário.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('App: o código da página não chega', () => {
  it('a tela diz que não carregou e oferece recarregar, em vez de ficar em branco', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    history.replaceState(null, '', '/educacao/acesso');

    render(<App />);

    expect(await screen.findByText(/Não foi possível carregar esta página/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
  });

  it('ir para outra página depois da falha abre a outra normalmente', async () => {
    new FetchFake().responder('/api/anos', ANOS).instalar();
    history.replaceState(null, '', '/educacao/acesso');
    render(<App />);
    await screen.findByText(/Não foi possível carregar esta página/);

    await userEvent.click(screen.getByRole('link', { name: 'Resumo' }));

    expect(await screen.findByText('Página educação resumo')).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível carregar esta página/)).not.toBeInTheDocument();
  });
});
