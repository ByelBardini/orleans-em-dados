import { useEffect, useState } from 'react';
import type { z } from 'zod';

// Sem schema, a resposta passa sem conferência. Some quando todas as páginas tiverem contrato.
export async function getJSON<T = never>(caminho: string, schema?: z.ZodType<T>): Promise<T> {
  const r = await fetch(caminho);
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.erro ?? `HTTP ${r.status}`);
  const corpo = await r.json();
  if (!schema) return corpo;
  const resultado = schema.safeParse(corpo);
  if (!resultado.success) {
    const [problema] = resultado.error.issues;
    throw new Error(`Resposta inesperada de ${caminho}: ${problema?.path.join('.')} (${problema?.code})`);
  }
  return resultado.data;
}

type Estado<T> = { dados: T | null; erro: string | null; carregando: boolean };

// Carrega `caminho` sempre que ele muda; `null` não carrega nada. Enquanto carrega,
// mantém os dados anteriores: a tela não pisca ao trocar de ano ou de entidade.
export function useApi<T = never>(caminho: string | null, schema?: z.ZodType<T>): Estado<T> {
  const [resposta, setResposta] = useState<{ caminho: string; dados: T | null; erro: string | null } | null>(null);

  useEffect(() => {
    if (!caminho) return;
    let ativo = true;
    getJSON(caminho, schema)
      .then((dados) => ativo && setResposta({ caminho, dados, erro: null }))
      .catch((erro: Error) => ativo && setResposta({ caminho, dados: null, erro: erro.message }));
    return () => {
      ativo = false;
    };
    // O schema é uma constante do módulo de contratos: não muda entre renderizações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminho]);

  const chegou = resposta?.caminho === caminho;
  return {
    dados: resposta?.dados ?? null,
    erro: chegou ? (resposta?.erro ?? null) : null,
    carregando: Boolean(caminho) && !chegou,
  };
}
