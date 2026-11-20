import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destinoInterno, navegar, redirecionarHashAntigo } from '../src/rotas';

// Um link de verdade no documento, e o clique sobre ele (ou sobre o que está dentro dele).
function link(href: string, atributos: Record<string, string> = {}) {
  const a = document.createElement('a');
  a.href = href;
  for (const [nome, valor] of Object.entries(atributos)) a.setAttribute(nome, valor);
  a.innerHTML = '<span>texto</span>';
  document.body.append(a);
  return a;
}

function clique(alvo: Element, opcoes: MouseEventInit = {}) {
  const evento = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...opcoes });
  Object.defineProperty(evento, 'target', { value: alvo });
  return evento;
}

beforeEach(() => {
  history.replaceState(null, '', '/');
  vi.stubGlobal('scrollTo', () => {});
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('destinoInterno', () => {
  it('clique simples num link para uma página do painel dá o caminho dela', () => {
    expect(destinoInterno(clique(link('/financas/receitas')))).toBe('/financas/receitas');
  });

  it('clique no texto dentro do link também conta', () => {
    expect(destinoInterno(clique(link('/educacao/dinheiro').firstElementChild!))).toBe('/educacao/dinheiro');
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
    ['botão do meio', { button: 1 }],
  ])('com %s, o navegador abre o link do jeito dele', (_nome, opcoes) => {
    expect(destinoInterno(clique(link('/financas'), opcoes))).toBeNull();
  });

  it.each([
    ['target="_blank"', '/financas', { target: '_blank' }],
    ['download', '/financas', { download: '' }],
    ['outro domínio', 'https://github.com/ByelBardini/orleans-em-dados', {}],
    ['o CSV da API', '/api/receitas.csv?ano=2026', {}],
    ['um arquivo do site', '/og.png', {}],
    ['caminho fora do catálogo', '/financas/x', {}],
    ['âncora na própria página', '#secao', {}],
  ])('link com %s não é interceptado', (_nome, href, atributos) => {
    expect(destinoInterno(clique(link(href, atributos)))).toBeNull();
  });

  it('clique já tratado por outro ouvinte não é interceptado', () => {
    const evento = clique(link('/financas'));
    evento.preventDefault();

    expect(destinoInterno(evento)).toBeNull();
  });

  it('clique fora de link não é navegação', () => {
    const div = document.createElement('div');
    document.body.append(div);

    expect(destinoInterno(clique(div))).toBeNull();
  });
});

describe('redirecionarHashAntigo', () => {
  it('o link antigo com hash vira o caminho novo, sem entrada nova no histórico', () => {
    history.replaceState(null, '', '/#receitas');
    const entradas = history.length;

    redirecionarHashAntigo();

    expect(location.pathname).toBe('/financas/receitas');
    expect(location.hash).toBe('');
    expect(history.length).toBe(entradas);
  });

  it('o endereço antigo da seção de conferência vai para Discrepâncias', () => {
    history.replaceState(null, '', '/#conferencia');

    redirecionarHashAntigo();

    expect(location.pathname).toBe('/discrepancias');
  });

  it('hash que não é de página antiga fica como está', () => {
    history.replaceState(null, '', '/#nada');

    redirecionarHashAntigo();

    expect(location.pathname).toBe('/');
    expect(location.hash).toBe('#nada');
  });
});

describe('navegar', () => {
  it('põe o caminho no histórico e avisa quem ouve', () => {
    const avisos: string[] = [];
    const ouvir = () => avisos.push(location.pathname);
    window.addEventListener('orleans:navegou', ouvir);
    const entradas = history.length;

    navegar('/educacao/acesso');

    window.removeEventListener('orleans:navegou', ouvir);
    expect(location.pathname).toBe('/educacao/acesso');
    expect(history.length).toBe(entradas + 1);
    expect(avisos).toEqual(['/educacao/acesso']);
  });
});
