import { useEffect, useState } from 'react';

export async function getJSON(caminho) {
  const r = await fetch(caminho);
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.erro ?? `HTTP ${r.status}`);
  return r.json();
}

// Carrega `caminho` sempre que ele muda; `null` não carrega nada.
export function useApi(caminho) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: Boolean(caminho) });

  useEffect(() => {
    if (!caminho) return;
    let ativo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    getJSON(caminho)
      .then((dados) => ativo && setEstado({ dados, erro: null, carregando: false }))
      .catch((erro) => ativo && setEstado({ dados: null, erro: erro.message, carregando: false }));
    return () => {
      ativo = false;
    };
  }, [caminho]);

  return estado;
}
