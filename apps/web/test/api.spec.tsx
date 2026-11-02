import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { getJSON, useApi } from '../src/api';
import { FetchFake } from './support/fetch-fake';

const SCHEMA = z.strictObject({ total: z.number() });

afterEach(() => vi.unstubAllGlobals());

describe('getJSON', () => {
  it('resposta que obedece ao schema volta como dados', async () => {
    new FetchFake().responder('/api/x', { total: 3 }).instalar();

    expect(await getJSON('/api/x', SCHEMA)).toEqual({ total: 3 });
  });

  it('erro da API vira a mensagem que ela mandou', async () => {
    new FetchFake().responder('/api/x', { erro: 'Sem dados de receitas para 2019' }, 404).instalar();

    await expect(getJSON('/api/x', SCHEMA)).rejects.toThrow('Sem dados de receitas para 2019');
  });

  it('erro sem corpo JSON cita o status', async () => {
    new FetchFake().responderTexto('/api/x', '<html>Bad Gateway</html>', 502).instalar();

    await expect(getJSON('/api/x', SCHEMA)).rejects.toThrow('HTTP 502');
  });

  it('resposta fora do contrato é recusada citando a rota e o campo', async () => {
    new FetchFake().responder('/api/x', { total: 'três' }).instalar();

    await expect(getJSON('/api/x', SCHEMA)).rejects.toThrow('Resposta inesperada de /api/x: total');
  });

  it('campo a mais também está fora do contrato', async () => {
    new FetchFake().responder('/api/x', { total: 1, novo: true }).instalar();

    await expect(getJSON('/api/x', SCHEMA)).rejects.toThrow('Resposta inesperada de /api/x');
  });

  it('falha de rede sobe com a mensagem dela', async () => {
    new FetchFake().instalar();

    await expect(getJSON('/api/x', SCHEMA)).rejects.toThrow('rede fora do ar');
  });
});

describe('useApi', () => {
  it('começa carregando e entrega os dados', async () => {
    new FetchFake().responder('/api/x', { total: 3 }).instalar();

    const { result } = renderHook(() => useApi('/api/x', SCHEMA));

    expect(result.current).toEqual({ dados: null, erro: null, carregando: true });
    await waitFor(() => expect(result.current).toEqual({ dados: { total: 3 }, erro: null, carregando: false }));
  });

  it('caminho nulo não pede nada e não fica carregando', () => {
    const fake = new FetchFake().instalar();

    const { result } = renderHook(() => useApi(null, SCHEMA));

    expect(result.current).toEqual({ dados: null, erro: null, carregando: false });
    expect(fake.pedidos).toEqual([]);
  });

  it('erro chega como mensagem, sem dados', async () => {
    new FetchFake().responder('/api/x', { erro: 'falhou' }, 500).instalar();

    const { result } = renderHook(() => useApi('/api/x', SCHEMA));

    await waitFor(() => expect(result.current).toEqual({ dados: null, erro: 'falhou', carregando: false }));
  });

  it('ao trocar de caminho, mantém os dados anteriores enquanto carrega, sem o erro anterior', async () => {
    const fake = new FetchFake().responder('/api/a', { total: 1 }).responder('/api/b', { total: 2 }).instalar();
    const { result, rerender } = renderHook(({ caminho }) => useApi(caminho, SCHEMA), {
      initialProps: { caminho: '/api/a' },
    });
    await waitFor(() => expect(result.current.dados).toEqual({ total: 1 }));

    fake.segurar = true;
    rerender({ caminho: '/api/b' });

    expect(result.current).toEqual({ dados: { total: 1 }, erro: null, carregando: true });
    await act(async () => fake.liberar('/api/b'));
    await waitFor(() => expect(result.current).toEqual({ dados: { total: 2 }, erro: null, carregando: false }));
  });

  it('resposta antiga que chega depois da nova é descartada', async () => {
    const fake = new FetchFake()
      .responder('/api/lenta', { total: 1 })
      .responder('/api/rapida', { total: 2 })
      .instalar();
    fake.segurar = true;
    const { result, rerender } = renderHook(({ caminho }) => useApi(caminho, SCHEMA), {
      initialProps: { caminho: '/api/lenta' },
    });
    rerender({ caminho: '/api/rapida' });

    await act(async () => fake.liberar('/api/rapida'));
    await waitFor(() => expect(result.current.dados).toEqual({ total: 2 }));
    await act(async () => fake.liberar('/api/lenta'));

    expect(result.current.dados).toEqual({ total: 2 });
  });

  it('o mesmo caminho não é pedido de novo a cada renderização', async () => {
    const fake = new FetchFake().responder('/api/x', { total: 3 }).instalar();
    const { result, rerender } = renderHook(() => useApi('/api/x', SCHEMA));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    rerender();

    expect(fake.pedidos).toEqual(['/api/x']);
  });
});
