// Completar o histórico: os pares consulta × exercício da janela de cada importador que o banco ainda não tem.
// Na subida do worker, tenta tudo que não está publicado, inclusive o rejeitado (deploy traz código novo).
// Todo dia, só o que nunca foi gravado (fonte fora do ar na véspera), para não bater de novo num lote que a
// fonte devolve igual. Um par por vez, com pausa, sem relançar: a fila não repete a carga inteira.
import { pool } from '@orleans-em-dados/db';
import {
  executar,
  type Dependencias,
  type Importador,
  type ResultadoDaExecucao,
} from '@orleans-em-dados/importador-nucleo';

export type ModoDoHistorico = 'subida' | 'diario';

/** Pares `<consultaId>:<ano>` já publicados, e já gravados (publicados ou rejeitados). Exemplo não entra. */
export type EstadoDoHistorico = { publicados: ReadonlySet<string>; gravados: ReadonlySet<string> };

export type PedidoDoHistorico = { importador: Importador; ano: number; chaves: string[] };

const par = (consultaId: number, ano: number) => `${consultaId}:${ano}`;

/** Do mais recente ao mais antigo: o painel ganha primeiro os anos que mais se olham. */
export function planejarHistorico(
  importadores: readonly Importador[],
  agora: Date,
  janela: number,
  { publicados, gravados }: EstadoDoHistorico,
  modo: ModoDoHistorico,
): PedidoDoHistorico[] {
  const feito = (chave: string) => (modo === 'subida' ? publicados.has(chave) : gravados.has(chave));
  const pedidos: PedidoDoHistorico[] = [];
  for (const importador of importadores) {
    if (!importador.anosDaCarga) continue;
    const porAno = new Map<number, string[]>();
    // A ordem das chaves é a das consultas do importador, não a da janela.
    const janelaDe = new Map(importador.anosDaCarga(agora, janela).map((j) => [j.chave, j.anos]));
    for (const consulta of importador.consultas) {
      for (const ano of janelaDe.get(consulta.chave) ?? []) {
        if (feito(par(consulta.id, ano))) continue;
        porAno.set(ano, [...(porAno.get(ano) ?? []), consulta.chave]);
      }
    }
    for (const [ano, chaves] of [...porAno].sort(([a], [b]) => b - a)) pedidos.push({ importador, ano, chaves });
  }
  return pedidos;
}

export type DependenciasDoHistorico = Dependencias & {
  esperar(ms: number): Promise<void>;
  lerEstado(): Promise<EstadoDoHistorico>;
};

export async function completarHistorico(
  importadores: readonly Importador[],
  { esperar, lerEstado, ...dependencias }: DependenciasDoHistorico,
  { modo, janela, pausaMs }: { modo: ModoDoHistorico; janela: number; pausaMs: number },
): Promise<ResultadoDaExecucao[]> {
  const pedidos = planejarHistorico(importadores, dependencias.relogio(), janela, await lerEstado(), modo);
  const resultados: ResultadoDaExecucao[] = [];
  for (const [i, { importador, ano, chaves }] of pedidos.entries()) {
    if (i > 0) await esperar(pausaMs);
    resultados.push(await executar(importador, ano, dependencias, chaves));
  }
  return resultados;
}

export async function lerEstadoDoHistorico(): Promise<EstadoDoHistorico> {
  const [publicados, gravados] = await Promise.all([
    pool.query<{ consulta_id: number; ano: number }>(
      `SELECT p.consulta_id, p.ano FROM publicacoes p JOIN coletas c ON c.id = p.coleta_id
       WHERE c.origem <> 'exemplo'`,
    ),
    pool.query<{ consulta_id: number; ano: number }>(
      `SELECT DISTINCT consulta_id, ano FROM coletas WHERE origem <> 'exemplo'`,
    ),
  ]);
  const pares = (linhas: { consulta_id: number; ano: number }[]) =>
    new Set(linhas.map((l) => par(l.consulta_id, l.ano)));
  return { publicados: pares(publicados.rows), gravados: pares(gravados.rows) };
}
