import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePopulacao } from '../src/usePopulacao';
import { FetchFake } from './support/fetch-fake';
import { municipio, municipioIndisponivel } from './support/municipio';

afterEach(() => vi.unstubAllGlobals());

const populacaoDe = async (ano: number) => {
  const { result } = renderHook(() => usePopulacao(ano));
  await waitFor(() => expect(result.current).not.toBeNull());
  return result.current;
};

describe('usePopulacao', () => {
  it('2024 divide por 24.474 e cita a estimativa do ano', async () => {
    new FetchFake().responder('/api/municipio', municipio()).instalar();

    expect(await populacaoDe(2024)).toEqual({ pessoas: 24474, fonte: 'IBGE, estimativa 2024' });
  });

  it('2023 usa o Censo 2022 e diz isso', async () => {
    new FetchFake().responder('/api/municipio', municipio()).instalar();

    expect(await populacaoDe(2023)).toEqual({ pessoas: 23661, fonte: 'IBGE, Censo 2022' });
  });

  it('2026 divide por 24.901', async () => {
    new FetchFake().responder('/api/municipio', municipio()).instalar();

    expect(await populacaoDe(2026)).toEqual({ pessoas: 24901, fonte: 'IBGE, estimativa 2026' });
  });

  it('`disponivel: false` não tem população', async () => {
    const fake = new FetchFake().responder('/api/municipio', municipioIndisponivel()).instalar();

    const { result } = renderHook(() => usePopulacao(2025));

    await waitFor(() => expect(fake.pedidos).toEqual(['/api/municipio']));
    expect(result.current).toBeNull();
  });

  it('erro da rota não tem população, e não lança', async () => {
    const fake = new FetchFake().responderTexto('/api/municipio', 'fora', 500).instalar();

    const { result } = renderHook(() => usePopulacao(2025));

    await waitFor(() => expect(fake.pedidos).toEqual(['/api/municipio']));
    expect(result.current).toBeNull();
  });

  it('ano anterior à série não tem população', async () => {
    new FetchFake().responder('/api/municipio', municipio()).instalar();

    const { result } = renderHook(() => usePopulacao(1999));

    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });
});
