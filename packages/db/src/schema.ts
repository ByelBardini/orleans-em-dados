// Esquema do banco. Fonte das migrações novas (pnpm --filter @orleans-em-dados/db gerar).
// Bruto imutável por coleta (registros_brutos) separado do normalizado; o dashboard
// lê só a coleta apontada por `publicacoes`. Os nomes de restrição e índice são os
// que o Postgres deu às migrações originais: um teste compara o catálogo.
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

const dinheiro = (nome: string) => numeric(nome, { precision: 18, scale: 2 });
const coletaId = () => bigint('coleta_id', { mode: 'number' }).notNull();

export const fontes = pgTable('fontes', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  url: text('url').notNull(),
});

export const consultas = pgTable(
  'consultas',
  {
    id: integer('id').primaryKey(), // ID da consulta na fonte; ≥ 900001 para os apps do TCE-SC
    fonteId: text('fonte_id').notNull(),
    chave: text('chave').notNull(),
    nome: text('nome').notNull(),
    urlOrigem: text('url_origem').notNull(),
    campoFiltroAno: text('campo_filtro_ano').notNull(),
    identificadorExterno: jsonb('identificador_externo'),
  },
  (t) => [
    unique('consultas_chave_key').on(t.chave),
    foreignKey({ name: 'consultas_fonte_id_fkey', columns: [t.fonteId], foreignColumns: [fontes.id] }),
  ],
);

export const entidades = pgTable(
  'entidades',
  {
    codigoBetha: text('codigo_betha').primaryKey(), // segmento intermediário do ID Betha
    nome: text('nome').notNull(),
    sigla: text('sigla').notNull(),
    codigoTce: text('codigo_tce'),
    poder: text('poder').notNull().default('executivo'),
    statusMapeamento: text('status_mapeamento').notNull(),
    nota: text('nota'),
  },
  (t) => [check('entidades_status_mapeamento_check', sql`${t.statusMapeamento} IN ('inferido', 'confirmado')`)],
);

export const coletas = pgTable(
  'coletas',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    consultaId: integer('consulta_id').notNull(),
    ano: smallint('ano').notNull(),
    filtro: jsonb('filtro').notNull(),
    iniciadoEm: timestamp('iniciado_em', { withTimezone: true }).notNull(),
    finalizadoEm: timestamp('finalizado_em', { withTimezone: true }).notNull(),
    origem: text('origem').notNull(),
    status: text('status').notNull(),
    totalHits: integer('total_hits').notNull(),
    capturados: integer('capturados').notNull(),
    idsUnicos: integer('ids_unicos').notNull(),
    camposAusentes: jsonb('campos_ausentes').notNull().default({}),
    erros: jsonb('erros').notNull().default([]),
    hashPayload: text('hash_payload').notNull(), // sha256 dos registros brutos
  },
  (t) => [
    foreignKey({ name: 'coletas_consulta_id_fkey', columns: [t.consultaId], foreignColumns: [consultas.id] }),
    check('coletas_origem_check', sql`${t.origem} IN ('api', 'arquivo', 'exemplo')`),
    check('coletas_status_check', sql`${t.status} IN ('totalizador_conciliado', 'rejeitado', 'exemplo')`),
    index('coletas_consulta_id_ano_finalizado_em_idx').on(t.consultaId, t.ano, t.finalizadoEm.desc().nullsFirst()),
  ],
);

const fkColeta = (tabela: string, coluna: Parameters<typeof foreignKey>[0]['columns'][0]) =>
  foreignKey({ name: `${tabela}_coleta_id_fkey`, columns: [coluna], foreignColumns: [coletas.id] }).onDelete('cascade');

// Totalizador informado pela fonte versus soma calculada na coleta.
export const totaisFonte = pgTable(
  'totais_fonte',
  {
    coletaId: coletaId(),
    campo: text('campo').notNull(),
    titulo: text('titulo'),
    descricao: text('descricao'),
    valorFonte: dinheiro('valor_fonte'),
    valorCalculado: dinheiro('valor_calculado').notNull(),
    diferenca: dinheiro('diferenca'),
  },
  (t) => [
    primaryKey({ name: 'totais_fonte_pkey', columns: [t.coletaId, t.campo] }),
    fkColeta('totais_fonte', t.coletaId),
  ],
);

// Resposta original de cada registro, sem perdas, para reprocessamento.
export const registrosBrutos = pgTable(
  'registros_brutos',
  {
    coletaId: coletaId(),
    idExterno: text('id_externo').notNull(),
    payload: jsonb('payload').notNull(),
  },
  (t) => [
    primaryKey({ name: 'registros_brutos_pkey', columns: [t.coletaId, t.idExterno] }),
    fkColeta('registros_brutos', t.coletaId),
  ],
);

// Coleta aprovada que o dashboard exibe para cada consulta e exercício.
export const publicacoes = pgTable(
  'publicacoes',
  {
    consultaId: integer('consulta_id').notNull(),
    ano: smallint('ano').notNull(),
    coletaId: bigint('coleta_id', { mode: 'number' }).notNull(),
    publicadoEm: timestamp('publicado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'publicacoes_pkey', columns: [t.consultaId, t.ano] }),
    foreignKey({ name: 'publicacoes_consulta_id_fkey', columns: [t.consultaId], foreignColumns: [consultas.id] }),
    foreignKey({ name: 'publicacoes_coleta_id_fkey', columns: [t.coletaId], foreignColumns: [coletas.id] }),
  ],
);

// 57153: uma linha por rubrica × entidade × mês. valor_arrecadado_ate_mes é acumulado: nunca somar entre meses.
export const receitas = pgTable(
  'receitas',
  {
    coletaId: coletaId(),
    idExterno: text('id_externo').notNull(),
    ano: smallint('ano').notNull(),
    entidadeCodigo: text('entidade_codigo').notNull(),
    idRubricaBetha: text('id_rubrica_betha').notNull(),
    mes: smallint('mes'), // inferido do sufixo _N; semântica a confirmar
    rubrica: text('rubrica').notNull(),
    descricao: text('descricao').notNull(),
    valorOrcado: dinheiro('valor_orcado'),
    valorOrcadoDeducoes: dinheiro('valor_orcado_deducoes'),
    valorOrcadoAtualizado: dinheiro('valor_orcado_atualizado'),
    valorLancadoMes: dinheiro('valor_lancado_mes'),
    valorArrecadadoMes: dinheiro('valor_arrecadado_mes'),
    valorArrecadadoAteMes: dinheiro('valor_arrecadado_ate_mes'),
    percentualRealizado: numeric('percentual_realizado', { precision: 10, scale: 2 }),
  },
  (t) => [
    primaryKey({ name: 'receitas_pkey', columns: [t.coletaId, t.idExterno] }),
    fkColeta('receitas', t.coletaId),
    index('receitas_coleta_id_entidade_codigo_idx').on(t.coletaId, t.entidadeCodigo),
    index('receitas_coleta_id_rubrica_idx').on(t.coletaId, t.rubrica),
  ],
);

// 57140: uma linha por empenho. Valores originais; não é a despesa líquida de anulações.
export const empenhos = pgTable(
  'empenhos',
  {
    coletaId: coletaId(),
    idExterno: text('id_externo').notNull(),
    ano: smallint('ano').notNull(),
    entidadeCodigo: text('entidade_codigo').notNull(),
    numero: integer('numero').notNull(), // não é único: repete entre entidades e dentro do SAMAE
    dataEmpenho: date('data_empenho'),
    orgao: text('orgao'),
    credor: text('credor'), // pode ser pessoa física
    historico: text('historico'),
    valorEmpenho: dinheiro('valor_empenho'),
    valorLiquidado: dinheiro('valor_liquidado'), // NULL = não informado pela fonte, diferente de zero
    valorPago: dinheiro('valor_pago'),
    saldoAPagar: dinheiro('saldo_a_pagar'),
  },
  (t) => [
    primaryKey({ name: 'empenhos_pkey', columns: [t.coletaId, t.idExterno] }),
    fkColeta('empenhos', t.coletaId),
    index('empenhos_coleta_id_entidade_codigo_idx').on(t.coletaId, t.entidadeCodigo),
    index('empenhos_coleta_id_data_empenho_numero_idx').on(
      t.coletaId,
      t.dataEmpenho.desc().nullsFirst(),
      t.numero.desc().nullsFirst(),
    ),
  ],
);

// 57170: uma linha por natureza × ação × entidade. Valores já líquidos de anulações.
export const despesas = pgTable(
  'despesas',
  {
    coletaId: coletaId(),
    idExterno: text('id_externo').notNull(),
    ano: smallint('ano').notNull(),
    entidadeCodigo: text('entidade_codigo').notNull(),
    natureza: text('natureza').notNull(),
    acaoNumero: text('acao_numero'),
    acao: text('acao'),
    valorOrcado: dinheiro('valor_orcado'),
    valorOrcadoAtualizado: dinheiro('valor_orcado_atualizado'),
    valorEmpenhado: dinheiro('valor_empenhado'),
    valorLiquidado: dinheiro('valor_liquidado'),
    valorPago: dinheiro('valor_pago'),
  },
  (t) => [
    primaryKey({ name: 'despesas_pkey', columns: [t.coletaId, t.idExterno] }),
    fkColeta('despesas', t.coletaId),
    index('despesas_coleta_id_entidade_codigo_idx').on(t.coletaId, t.entidadeCodigo),
  ],
);

// Unidades gestoras do TCE-SC. A Câmara não tem entidade Betha: entidade_betha fica NULL.
export const unidadesTce = pgTable(
  'unidades_tce',
  {
    codigoUg: text('codigo_ug').primaryKey(),
    nome: text('nome').notNull(),
    sigla: text('sigla').notNull(),
    poder: text('poder').notNull(),
    entidadeBetha: text('entidade_betha'),
    statusMapeamento: text('status_mapeamento').notNull(),
    nota: text('nota'),
  },
  (t) => [
    unique('unidades_tce_nome_key').on(t.nome),
    foreignKey({
      name: 'unidades_tce_entidade_betha_fkey',
      columns: [t.entidadeBetha],
      foreignColumns: [entidades.codigoBetha],
    }),
    check('unidades_tce_status_mapeamento_check', sql`${t.statusMapeamento} IN ('inferido', 'confirmado')`),
  ],
);

// Receita arrecadada líquida: uma linha por unidade × natureza × mês × tipo de dedução.
export const tcescReceitas = pgTable(
  'tcesc_receitas',
  {
    coletaId: coletaId(),
    idExterno: text('id_externo').notNull(),
    ano: smallint('ano').notNull(),
    unidade: text('unidade').notNull(),
    codigo: text('codigo').notNull(),
    natureza: text('natureza'),
    tipoDeducao: text('tipo_deducao'), // NULL = receita bruta
    mes: smallint('mes').notNull(),
    valorArrecadado: dinheiro('valor_arrecadado').notNull(),
  },
  (t) => [
    primaryKey({ name: 'tcesc_receitas_pkey', columns: [t.coletaId, t.idExterno] }),
    fkColeta('tcesc_receitas', t.coletaId),
    index('tcesc_receitas_coleta_id_unidade_idx').on(t.coletaId, t.unidade),
  ],
);

// Uma linha por empenho do exercício (ID Empenho do e-Sfinge). Não é a tabela `empenhos` da Betha.
export const tcescEmpenhos = pgTable(
  'tcesc_empenhos',
  {
    coletaId: coletaId(),
    idExterno: text('id_externo').notNull(),
    ano: smallint('ano').notNull(),
    codigoUg: text('codigo_ug').notNull(),
    numero: integer('numero'),
    dataEmpenho: date('data_empenho'),
    credor: text('credor'), // pode ser pessoa física
    historico: text('historico'),
    valorOriginal: dinheiro('valor_original'),
    valorReforco: dinheiro('valor_reforco'),
    valorEstorno: dinheiro('valor_estorno'),
    valorEmpenhado: dinheiro('valor_empenhado'),
    valorLiquidado: dinheiro('valor_liquidado'),
    valorPago: dinheiro('valor_pago'),
  },
  (t) => [
    primaryKey({ name: 'tcesc_empenhos_pkey', columns: [t.coletaId, t.idExterno] }),
    fkColeta('tcesc_empenhos', t.coletaId),
    index('tcesc_empenhos_coleta_id_codigo_ug_numero_idx').on(t.coletaId, t.codigoUg, t.numero),
  ],
);
