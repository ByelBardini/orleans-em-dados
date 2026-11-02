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
