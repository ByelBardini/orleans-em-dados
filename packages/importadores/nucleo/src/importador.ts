// O contrato de um importador. `coletar` só faz I/O, `normalizar` é pura e `validar`
// decide se o lote pode ser publicado; gravar e publicar são do executor.
import type { PgTable } from 'drizzle-orm/pg-core';

/** Registro como a fonte o entregou, com o id que o identifica na coleta. */
export type RegistroBruto = { id: string } & Record<string, unknown>;

export type Coleta = {
  filtro: unknown;
  /** Quantos registros a fonte disse que existem. */
  totalHits: number;
  registros: RegistroBruto[];
  /** Campos somados que vieram vazios: ausência é contada, nunca somada como zero. */
  camposAusentes?: Record<string, number>;
  /** O que a própria coleta já sabe que deu errado (totalHits mudou, app recarregado). */
  erros?: string[];
  /** O que `validar` precisa da fonte além dos registros, como os totalizadores. */
  extras?: unknown;
};

/** Totalizador da fonte × soma calculada de um campo. */
export type ItemDeConferencia = {
  campo: string;
  titulo?: string | null;
  descricao?: string | null;
  fonte: string | null;
  calculado: string;
  diferenca: string | null;
};

export type Validacao = {
  conferencia: ItemDeConferencia[];
  erros: string[];
};

export type ContextoDaColeta = { ano: number };

export type ConsultaImportada<Linha extends Record<string, unknown> = Record<string, unknown>> = {
  /** Id em `consultas.id`. */
  id: number;
  /** Como a CLI se refere à consulta (`receitas`, `empenhos`). */
  chave: string;
  /** Tabela normalizada que recebe as linhas. */
  tabela: PgTable;
  coletar(contexto: ContextoDaColeta): Promise<Coleta>;
  /** Registro bruto → linha da tabela, sem `coletaId` nem `ano`. Lança se o registro não servir. */
  normalizar(registro: RegistroBruto): Linha;
  validar(coleta: Coleta, linhas: readonly Linha[]): Validacao;
};

export type Importador = {
  id: string;
  fonte: string;
  /** Expressão cron, no fuso de São Paulo. Sem agenda, o importador não entra nas filas: a carga é por arquivo. */
  agenda?: string;
  /** Exercícios que a rodada agendada atualiza. */
  anosDaRodada(agora: Date): number[];
  // Cada consulta tem a própria Linha; o executor só as repassa da normalizar para a tabela.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  consultas: ConsultaImportada<any>[];
};

export type Origem = 'api' | 'arquivo' | 'exemplo';
export type StatusDoLote = 'totalizador_conciliado' | 'rejeitado' | 'exemplo';

export type Lote = {
  consultaId: number;
  tabela: PgTable;
  ano: number;
  filtro: unknown;
  iniciadoEm: Date;
  coletadoEm: Date;
  origem: Origem;
  status: StatusDoLote;
  totalHits: number;
  capturados: number;
  idsUnicos: number;
  camposAusentes: Record<string, number>;
  conferencia: ItemDeConferencia[];
  erros: string[];
  hash: string;
  registros: RegistroBruto[];
  /** Vazio quando a normalização recusou algum registro. */
  linhas: Record<string, unknown>[];
};

/** Onde os lotes moram. A publicação é um passo separado da gravação. */
export interface RepositorioDeLotes {
  abrirExecucao(importador: string, ano: number, inicio: Date): Promise<number>;
  fecharExecucao(id: number, resultado: ResultadoDaExecucao, fim: Date): Promise<void>;
  /** Hash da coleta publicada da consulta no ano e o id dela, se houver. */
  publicada(consultaId: number, ano: number): Promise<{ coletaId: number; hash: string } | null>;
  /** A fonte devolveu o mesmo conteúdo: só atualiza a data de extração da coleta publicada. */
  reconfirmar(coletaId: number, coletadoEm: Date): Promise<void>;
  gravar(lote: Lote): Promise<number>;
  publicar(lote: Lote, coletaId: number): Promise<boolean>;
}

export type StatusDaExecucao = 'sucesso' | 'rejeitada' | 'falhou';

export type ResultadoDaConsulta = {
  consultaId: number;
  chave: string;
  status: 'publicada' | 'sem_mudanca' | 'nao_publicada' | 'rejeitada' | 'falhou';
  coletaId?: number;
  linhasLidas: number;
  linhasGravadas: number;
  erros: string[];
};

export type ResultadoDaExecucao = {
  execucaoId: number;
  importador: string;
  ano: number;
  status: StatusDaExecucao;
  consultas: ResultadoDaConsulta[];
};
