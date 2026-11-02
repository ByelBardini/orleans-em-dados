// O que a CLI faz, sem a parte de argumentos e console.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  executar,
  gravarSnapshot,
  type ConsultaImportada,
  type Dependencias,
  type Importador,
  type Lote,
  type RepositorioDeLotes,
  type ResultadoDaExecucao,
  type Snapshot,
} from '@orleans-em-dados/importador-nucleo';

export type ResultadoDoArquivo = {
  arquivo: string;
  coletaId?: number;
  publicada?: boolean;
  linhas?: number;
  erro?: string;
};

export async function importarDaFonte(
  importadores: readonly Importador[],
  id: string,
  ano: number,
  chaves: readonly string[] | undefined,
  dependencias: Dependencias,
): Promise<ResultadoDaExecucao> {
  const importador = importadores.find((i) => i.id === id);
  if (!importador) {
    throw new Error(`Importador desconhecido: ${id}; opções: ${importadores.map((i) => i.id).join(', ')}`);
  }
  const validas = importador.consultas.map((c) => c.chave);
  const invalida = chaves?.find((chave) => !validas.includes(chave));
  if (invalida) throw new Error(`Consulta desconhecida em ${id}: ${invalida}; opções: ${validas.join(', ')}`);
  return executar(importador, ano, dependencias, chaves);
}

function consultaDoId(importadores: readonly Importador[], id: number): ConsultaImportada {
  const consulta = importadores.flatMap((i) => i.consultas).find((c) => c.id === id);
  if (!consulta) throw new Error(`Nenhum importador conhece a consulta ${id}`);
  return consulta;
}

// Um arquivo ruim não impede os outros.
export async function importarArquivos(
  arquivos: readonly string[],
  importadores: readonly Importador[],
  repositorio: RepositorioDeLotes,
): Promise<ResultadoDoArquivo[]> {
  const resultados: ResultadoDoArquivo[] = [];
  for (const arquivo of arquivos) {
    try {
      const snapshot = JSON.parse(await readFile(arquivo, 'utf8')) as Snapshot;
      const consulta = consultaDoId(importadores, snapshot.meta.consultaId);
      const origem = snapshot.meta.status === 'exemplo' ? 'exemplo' : 'arquivo';
      resultados.push({ arquivo, ...(await gravarSnapshot(consulta, snapshot, origem, repositorio)) });
    } catch (erro) {
      resultados.push({ arquivo, erro: (erro as Error).message });
    }
  }
  return resultados;
}

/** Grava o snapshot de um lote em JSON (--json). Lote rejeitado vai para um arquivo à parte. */
export async function salvarSnapshot(pasta: string, fonte: string, chave: string, lote: Lote): Promise<string> {
  const diretorio = path.join(pasta, fonte);
  await mkdir(diretorio, { recursive: true });
  const base = path.join(diretorio, `${chave}-${lote.ano}`);
  const destino = lote.status === 'rejeitado' ? `${base}.rejeitado.json` : `${base}.json`;
  const snapshot: Snapshot = {
    meta: {
      consultaId: lote.consultaId,
      ano: lote.ano,
      filtro: lote.filtro,
      iniciadoEm: lote.iniciadoEm.toISOString(),
      coletadoEm: lote.coletadoEm.toISOString(),
      totalHits: lote.totalHits,
      capturados: lote.capturados,
      idsUnicos: lote.idsUnicos,
      camposAusentes: lote.camposAusentes,
      conferencia: lote.conferencia,
      status: lote.status,
      erros: lote.erros,
    },
    registros: lote.registros,
  };
  await writeFile(`${destino}.tmp`, JSON.stringify(snapshot));
  await rename(`${destino}.tmp`, destino);
  return destino;
}
