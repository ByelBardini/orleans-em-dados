import { render, screen, waitFor } from '@testing-library/react';
import type { Importacoes } from '@orleans-em-dados/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvisoDeAtraso } from '../src/selo';
import { seloDeAtraso } from '../src/selos';
import { FetchFake } from './support/fetch-fake';

const AGORA = new Date('2026-03-10T06:00:00.000Z');

const importacoes = (id: string, ano: number, atualizadoEm: string): Importacoes => ({
  importadores: [{ id, ultimaExecucao: null, exercicios: [{ ano, atualizadoEm }] }],
});

afterEach(() => vi.unstubAllGlobals());

describe('seloDeAtraso', () => {
  it('dado atrasado diz desde quando, sem falar em erro', () => {
    const dados = importacoes('betha', 2026, '2026-03-01T03:00:00.000Z');

    expect(seloDeAtraso(dados, 'receita-arrecadada', 2026, AGORA)).toEqual({
      estado: 'pendente',
      titulo: 'Dado atrasado',
      motivo: 'Última atualização em 01 de março de 2026.',
    });
  });

  it('dado em dia não tem selo', () => {
    const dados = importacoes('betha', 2026, '2026-03-10T03:00:00.000Z');

    expect(seloDeAtraso(dados, 'receita-arrecadada', 2026, AGORA)).toBeNull();
  });

  it('exercício antigo, sem rodada agendada, não tem selo', () => {
    const dados = importacoes('betha', 2023, '2024-01-01T03:00:00.000Z');

    expect(seloDeAtraso(dados, 'receita-arrecadada', 2023, AGORA)).toBeNull();
  });

  it('exercício sem nada publicado não é atraso', () => {
    const dados = importacoes('betha', 2025, '2020-01-01T03:00:00.000Z');

    expect(seloDeAtraso(dados, 'receita-arrecadada', 2026, AGORA)).toBeNull();
  });

  it('o indicador olha o importador da própria fonte', () => {
    const dados = importacoes('tcesc', 2026, '2026-03-01T03:00:00.000Z');

    expect(seloDeAtraso(dados, 'receita-arrecadada', 2026, AGORA)).toBeNull();
    expect(seloDeAtraso(dados, 'despesa-camara', 2026, AGORA)?.titulo).toBe('Dado atrasado');
  });

  it('sem a resposta de importações, não há aviso', () => {
    expect(seloDeAtraso(null, 'receita-arrecadada', 2026, AGORA)).toBeNull();
  });

  it('indicador que não está no registro não tem selo', () => {
    const dados = importacoes('betha', 2026, '2026-03-01T03:00:00.000Z');

    expect(seloDeAtraso(dados, 'inexistente', 2026, AGORA)).toBeNull();
  });
});

describe('AvisoDeAtraso', () => {
  const anoAtual = new Date().getUTCFullYear();

  it('mostra o aviso quando a API diz que o dado é antigo, sem link para a conferência', async () => {
    new FetchFake()
      .responder('/api/importacoes', importacoes('betha', anoAtual, '2000-01-01T03:00:00.000Z'))
      .instalar();

    render(<AvisoDeAtraso indicador="receita-arrecadada" ano={anoAtual} />);

    expect(await screen.findByText('Dado atrasado')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('com dado recente, não mostra nada', async () => {
    const fake = new FetchFake()
      .responder('/api/importacoes', importacoes('betha', anoAtual, new Date().toISOString()))
      .instalar();

    const { container } = render(<AvisoDeAtraso indicador="receita-arrecadada" ano={anoAtual} />);

    await waitFor(() => expect(fake.pedidos).toEqual(['/api/importacoes']));
    expect(container).toBeEmptyDOMElement();
  });

  it('rota de importações fora do ar não gera aviso falso nem erro na tela', async () => {
    const fake = new FetchFake().responder('/api/importacoes', { erro: 'fora do ar' }, 500).instalar();

    const { container } = render(<AvisoDeAtraso indicador="receita-arrecadada" ano={anoAtual} />);

    await waitFor(() => expect(fake.pedidos).toEqual(['/api/importacoes']));
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
