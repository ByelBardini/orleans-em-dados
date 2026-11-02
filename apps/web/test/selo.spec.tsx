import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Selo } from '../src/selo';
import { seloAguardando, SELO_FONTE_UNICA, type DadosDoSelo } from '../src/selos';

const iconeDe = (estado: DadosDoSelo['estado']) => {
  const { container } = render(<Selo selo={{ estado, titulo: 'Título' }} />);
  return container.querySelector('.selo-icone')?.textContent;
};

describe('Selo', () => {
  it.each([
    ['confere', '✓'],
    ['diverge', '!'],
    ['explicada', 'i'],
    ['pendente', '…'],
    ['fonte-unica', '–'],
  ] as const)('estado %s renderiza o ícone %s', (estado, icone) => {
    expect(iconeDe(estado)).toBe(icone);
  });

  it('estado explicada leva a própria classe, que deixa o selo em cinza', () => {
    const { container } = render(<Selo selo={{ estado: 'explicada', titulo: 'Título' }} />);
    expect(container.firstChild).toHaveClass('selo', 'explicada');
  });

  it('explicada mostra título, motivo e o link para a conferência', () => {
    render(<Selo selo={{ estado: 'explicada', titulo: 'Difere do TCE-SC', motivo: 'Nenhuma diferença nova.' }} />);
    expect(screen.getByText('Difere do TCE-SC')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma diferença nova.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver conferência →' })).toHaveAttribute('href', '#conferencia');
  });

  it.each([
    ['fonte única', SELO_FONTE_UNICA],
    ['aguardando', seloAguardando()],
  ])('%s não tem o que levar à seção: sai sem link', (_nome, selo) => {
    render(<Selo selo={selo} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
