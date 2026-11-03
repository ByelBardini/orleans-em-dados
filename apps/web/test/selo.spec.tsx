import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Selo } from '../src/selo';
import { seloAguardando, seloConferidoComTce, SELO_EXEMPLO, SELO_FONTE_UNICA, type DadosDoSelo } from '../src/selos';

const iconeDe = (estado: DadosDoSelo['estado']) => {
  const { container } = render(<Selo selo={{ estado, titulo: 'Título' }} />);
  return container.querySelector('.selo-icone')?.textContent;
};

describe('Selo', () => {
  it.each([
    ['confere', '✓'],
    ['pendente', '…'],
    ['fonte-unica', '–'],
  ] as const)('estado %s renderiza o ícone %s', (estado, icone) => {
    expect(iconeDe(estado)).toBe(icone);
  });

  it('conferido mostra título, motivo e o link para as discrepâncias', () => {
    render(<Selo selo={{ estado: 'confere', titulo: 'conferido com o TCE-SC', motivo: 'Valores do TCE-SC.' }} />);
    expect(screen.getByText('conferido com o TCE-SC')).toBeInTheDocument();
    expect(screen.getByText('Valores do TCE-SC.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver discrepâncias →' })).toHaveAttribute('href', '#discrepancias');
  });

  it.each([
    ['fonte única', SELO_FONTE_UNICA],
    ['aguardando', seloAguardando()],
  ])('%s não tem o que levar à seção: sai sem link', (_nome, selo) => {
    render(<Selo selo={selo} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('Selo como símbolo', () => {
  const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome });
  const estaAberto = (el: HTMLElement) => el.getAttribute('aria-expanded') === 'true';

  it.each([
    ['fonte única', SELO_FONTE_UNICA, 'fonte única, sem conferência'],
    ['conferido', seloConferidoComTce(), 'conferido com o TCE-SC'],
  ])('%s vira um símbolo, com o texto como nome do botão', (_nome, selo, nome) => {
    render(<Selo selo={selo} />);

    expect(estaAberto(botao(nome))).toBe(false);
  });

  it('o motivo também entra no nome do botão', () => {
    render(<Selo selo={{ estado: 'confere', titulo: 'conferido com a Betha', motivo: 'Valores do TCE-SC.' }} />);

    expect(botao('conferido com a Betha. Valores do TCE-SC.')).toBeInTheDocument();
  });

  it('passar o mouse abre o texto, e tirar o mouse fecha', () => {
    render(<Selo selo={SELO_FONTE_UNICA} />);
    const simbolo = botao(/fonte única/);

    fireEvent.mouseEnter(simbolo);
    expect(estaAberto(simbolo)).toBe(true);

    fireEvent.mouseLeave(simbolo);
    expect(estaAberto(simbolo)).toBe(false);
  });

  it('o toque abre o texto, e o segundo toque não fecha', () => {
    render(<Selo selo={SELO_FONTE_UNICA} />);
    const simbolo = botao(/fonte única/);

    fireEvent.click(simbolo);
    fireEvent.click(simbolo);

    expect(estaAberto(simbolo)).toBe(true);
  });

  it('tocar fora fecha o texto', () => {
    render(<Selo selo={SELO_FONTE_UNICA} />);
    const simbolo = botao(/fonte única/);
    fireEvent.click(simbolo);

    fireEvent.pointerDown(document.body);

    expect(estaAberto(simbolo)).toBe(false);
  });

  it('o foco do teclado abre o texto, e Esc fecha', () => {
    render(<Selo selo={SELO_FONTE_UNICA} />);
    const simbolo = botao(/fonte única/);

    fireEvent.focus(simbolo);
    expect(estaAberto(simbolo)).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(estaAberto(simbolo)).toBe(false);
  });

  it('o foco que passa do símbolo para o link do texto mantém o texto aberto', () => {
    render(<Selo selo={seloConferidoComTce()} />);
    const simbolo = botao(/conferido/);
    fireEvent.focus(simbolo);

    fireEvent.blur(simbolo, { relatedTarget: screen.getByRole('link', { name: 'Ver discrepâncias →' }) });

    expect(estaAberto(simbolo)).toBe(true);
  });

  it('o foco que sai do selo fecha o texto', () => {
    render(
      <>
        <Selo selo={SELO_FONTE_UNICA} />
        <a href="#outro">outro</a>
      </>,
    );
    const simbolo = botao(/fonte única/);
    fireEvent.focus(simbolo);

    fireEvent.blur(simbolo, { relatedTarget: screen.getByRole('link', { name: 'outro' }) });

    expect(estaAberto(simbolo)).toBe(false);
  });

  it('pendência continua escrita, porque muda como o número é lido', () => {
    render(<Selo selo={SELO_EXEMPLO} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('dados fictícios, sem conferência')).toBeInTheDocument();
  });

  it('com texto, o selo conferido fica escrito, sem botão', () => {
    render(<Selo comTexto selo={seloConferidoComTce()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('conferido com o TCE-SC')).toBeInTheDocument();
  });
});
