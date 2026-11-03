import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ateOMes, ContaDaDespesa, ContaDaReceita, SemConferencia } from '../src/conferido';
import { despesasParciais, receitasParciais } from './support/conferidos';

describe('ateOMes', () => {
  it('no parcial, diz o mês por extenso e o ano', () => {
    expect(ateOMes(true, 9, 2026)).toBe('até setembro de 2026');
  });

  it.each([
    ['encerrado', false, 12],
    ['sem conferência', null, null],
    ['parcial sem mês', true, null],
  ])('%s não tem período', (_nome, parcial, mes) => {
    expect(ateOMes(parcial, mes, 2026)).toBe('');
  });
});

describe('ContaDaDespesa', () => {
  it('sem total da fonte, como no ano em curso, não há conta', () => {
    const { container } = render(<ContaDaDespesa conferido={100} conferencia={despesasParciais().conferencia} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ContaDaReceita', () => {
  const conferencia = receitasParciais().conferencia;

  it('sem explicada, a conta compacta não traz as explicações', () => {
    const { container } = render(<ContaDaReceita conferencia={conferencia} />);
    expect(container.querySelector('.conta-explica')).toBeNull();
    expect(container.querySelector('.conta-explicada')).toBeNull();
  });

  it('com explicada, cada parcela e o total dizem o que são', () => {
    const { container } = render(<ContaDaReceita explicada conferencia={conferencia} />);
    expect(container.querySelectorAll('.conta-explica')).toHaveLength(4);
  });

  it('sem o mês limite, a parcela que aguarda não cita mês', () => {
    render(<ContaDaReceita explicada conferencia={{ ...conferencia, limites: null }} />);
    expect(screen.getByText(/^Ainda não chegou ao TCE-SC/)).toBeInTheDocument();
  });

  it.each([
    ['zero', 0],
    ['nulo', null],
  ])('aguardando %s não vira parcela', (_nome, aguardandoTce) => {
    render(<ContaDaReceita explicada conferencia={{ ...conferencia, aguardandoTce }} />);
    expect(screen.queryByText('+ aguardando TCE')).not.toBeInTheDocument();
  });
});

describe('SemConferencia', () => {
  it('coleta sem nome conhecido sai como veio, sem sumir', () => {
    render(<SemConferencia ano={2026} faltando={['nova_coleta']} />);
    expect(screen.getByText(/Falta publicar: nova_coleta\./)).toBeInTheDocument();
  });

  it('sem a lista do que falta, explica do mesmo jeito', () => {
    render(<SemConferencia ano={2026} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ainda não dá para conferir 2026.');
    expect(screen.queryByText(/Falta publicar/)).not.toBeInTheDocument();
  });
});
