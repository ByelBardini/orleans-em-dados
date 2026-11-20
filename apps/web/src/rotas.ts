// As páginas do painel têm caminho próprio (`/financas/receitas`), pela History API, sem biblioteca:
// cada uma vira um resultado de busca, e o link antigo com `#` continua abrindo.
import { caminhoDoHashAntigo, paginaDoCaminho } from '@orleans-em-dados/contracts';
import { useEffect, useSyncExternalStore } from 'react';

const NAVEGOU = 'orleans:navegou';

/** Põe o caminho no histórico, avisa quem ouve e volta ao topo, como um link comum faria. */
export function navegar(caminho: string) {
  history.pushState(null, '', caminho);
  window.dispatchEvent(new Event(NAVEGOU));
  window.scrollTo(0, 0);
}

/** Troca o endereço sem entrada nova no histórico (link antigo, barra no fim). */
export function substituir(caminho: string) {
  history.replaceState(null, '', caminho);
  window.dispatchEvent(new Event(NAVEGOU));
}

function assinar(avisar: () => void) {
  window.addEventListener('popstate', avisar);
  window.addEventListener(NAVEGOU, avisar);
  return () => {
    window.removeEventListener('popstate', avisar);
    window.removeEventListener(NAVEGOU, avisar);
  };
}

/** O caminho atual, que muda com `navegar` e com voltar e avançar do navegador. */
export const useCaminho = () => useSyncExternalStore(assinar, () => location.pathname);

/**
 * O caminho para onde o clique leva, se é para o painel tratar; nulo se o navegador trata.
 * Fica com o navegador: modificador (Ctrl, Cmd, Shift, Alt) ou outro botão, `target`, `download`,
 * outro domínio, âncora na própria página e tudo que não é página do catálogo (a API, o CSV, arquivos).
 */
export function destinoInterno(evento: MouseEvent): string | null {
  if (evento.defaultPrevented || evento.button !== 0) return null;
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return null;
  const link = evento.target instanceof Element ? evento.target.closest('a') : null;
  if (!link?.hasAttribute('href') || link.hasAttribute('download')) return null;
  if (link.target && link.target !== '_self') return null;
  const destino = new URL(link.href, location.href);
  if (destino.origin !== location.origin) return null;
  if (destino.hash && destino.pathname === location.pathname && destino.search === location.search) return null;
  if (!paginaDoCaminho(destino.pathname)) return null;
  return destino.pathname + destino.search;
}

/** `/#receitas`, o endereço de antes das rotas por caminho, vira `/financas/receitas`. */
export function redirecionarHashAntigo() {
  if (location.pathname !== '/') return;
  const caminho = caminhoDoHashAntigo(location.hash);
  if (caminho) substituir(caminho);
}

/** Liga os links internos ao histórico, e o hash antigo ao caminho novo, enquanto o painel está aberto. */
export function useRotas() {
  useEffect(() => {
    redirecionarHashAntigo();
    const clicar = (evento: MouseEvent) => {
      const destino = destinoInterno(evento);
      if (!destino) return;
      evento.preventDefault();
      if (destino !== location.pathname + location.search) navegar(destino);
    };
    document.addEventListener('click', clicar);
    window.addEventListener('hashchange', redirecionarHashAntigo);
    return () => {
      document.removeEventListener('click', clicar);
      window.removeEventListener('hashchange', redirecionarHashAntigo);
    };
  }, []);
}
