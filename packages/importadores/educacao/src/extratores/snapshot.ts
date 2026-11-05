// Registro de educação → snapshot { meta, registros } pronto para `pnpm importar --arquivo`. Passa pelo
// mesmo normalizar e validar da consulta: o que sairia rejeitado na carga falha aqui, sem gerar arquivo.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  normalizarTudo,
  type ConsultaImportada,
  type ItemDeConferencia,
  type RegistroBruto,
  type Snapshot,
} from '@orleans-em-dados/importador-nucleo';
import { criarImportadoresDeEducacao } from '../importador';
import type { Contagem } from '../validacoes';
import type { Rede } from '../vocabulario';

type BaseDoRegistro = { indicador: string; lugar: string; rede: Rede; recorte?: string; periodo: string };

export type Valor = BaseDoRegistro & {
  etapa?: string;
  valor?: string | null;
  texto?: string | null;
  unidade: string;
};

export type Financa = BaseDoRegistro & { valor: string | null; percentual?: string | null };

export function registroDeValor({
  indicador,
  lugar,
  rede,
  etapa = '',
  recorte = '',
  periodo,
  valor,
  texto,
  unidade,
}: Valor) {
  return {
    id: [lugar, rede, etapa, recorte, indicador, periodo].join(':'),
    indicador,
    lugar,
    rede,
    etapa,
    recorte,
    periodo,
    valor: valor ?? null,
    texto: texto ?? null,
    unidade,
  };
}

export function registroDeFinanca({ indicador, lugar, rede, recorte = '', periodo, valor, percentual }: Financa) {
  return {
    id: [lugar, rede, recorte, indicador, periodo].join(':'),
    indicador,
    lugar,
    rede,
    recorte,
    periodo,
    valor,
    percentual: percentual ?? null,
  };
}

/** Contagem de pessoas: de 1 a 4 sai como "menos de 5". */
export const pessoas = (base: Omit<Valor, 'unidade' | 'valor' | 'texto'>, contagem: Contagem) =>
  registroDeValor({ ...base, ...contagem, unidade: 'pessoas' });

export type Lote = {
  chave: string;
  ano: number;
  registros: RegistroBruto[];
  /** Arquivos, filtro e de onde veio cada lugar; o extrato, quando é o caso, aparece aqui. */
  filtro: Record<string, unknown>;
  conferencia?: ItemDeConferencia[];
};

const consultaDe = (chave: string): ConsultaImportada => {
  const consulta = criarImportadoresDeEducacao()
    .flatMap((i) => i.consultas)
    .find((c) => c.chave === chave);
  if (!consulta) throw new Error(`Consulta desconhecida: ${chave}`);
  return consulta;
};

export function montarSnapshot({ chave, ano, registros, filtro, conferencia = [] }: Lote, agora: Date): Snapshot {
  const consulta = consultaDe(chave);
  const ids = new Set(registros.map((r) => r.id));
  if (ids.size !== registros.length) throw new Error(`${chave} ${ano}: ${registros.length - ids.size} ids repetidos`);
  const { linhas, erros } = normalizarTudo(consulta, registros);
  if (erros.length) throw new Error(`${chave} ${ano}: ${erros.join('; ')}`);
  const validacao = consulta.validar({ filtro, totalHits: registros.length, registros }, linhas);
  if (validacao.erros.length) throw new Error(`${chave} ${ano}: ${validacao.erros.join('; ')}`);
  const quando = agora.toISOString();
  return {
    meta: {
      consultaId: consulta.id,
      ano,
      filtro,
      iniciadoEm: quando,
      coletadoEm: quando,
      totalHits: registros.length,
      capturados: registros.length,
      idsUnicos: ids.size,
      camposAusentes: {},
      conferencia: [...conferencia, ...validacao.conferencia],
      status: 'totalizador_conciliado',
      erros: [],
    },
    registros,
  };
}

/** Um registro por linha, para o diff do snapshot dizer o que mudou. */
export function serializar({ meta, registros }: Snapshot): string {
  const linhas = registros.map((r) => `    ${JSON.stringify(r)}`).join(',\n');
  return `{\n  "meta": ${JSON.stringify(meta)},\n  "registros": [\n${linhas}\n  ]\n}\n`;
}

export async function gravarLotes(lotes: readonly Lote[], pasta: string, agora: Date): Promise<string[]> {
  const snapshots = lotes.map((lote) => ({ lote, snapshot: montarSnapshot(lote, agora) }));
  await mkdir(pasta, { recursive: true });
  const destinos: string[] = [];
  for (const { lote, snapshot } of snapshots) {
    const destino = path.join(pasta, `${lote.chave}-${lote.ano}.json`);
    await writeFile(destino, serializar(snapshot));
    destinos.push(destino);
  }
  return destinos;
}
