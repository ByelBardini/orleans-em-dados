-- Esquema inicial. Separa o bruto imutável por coleta (registros_brutos) do
-- normalizado (receitas, empenhos); o dashboard lê apenas a coleta publicada.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE fontes (
  id    TEXT PRIMARY KEY,
  nome  TEXT NOT NULL,
  url   TEXT NOT NULL
);

CREATE TABLE consultas (
  id            INTEGER PRIMARY KEY,          -- ID da consulta na fonte (ex.: 57153)
  fonte_id      TEXT NOT NULL REFERENCES fontes(id),
  chave         TEXT NOT NULL UNIQUE,         -- 'receitas', 'empenhos'
  nome          TEXT NOT NULL,
  url_origem    TEXT NOT NULL,
  campo_filtro_ano TEXT NOT NULL              -- 'ano' em 57153, 'anoExercicio' em 57140
);

CREATE TABLE entidades (
  codigo_betha  TEXT PRIMARY KEY,             -- segmento intermediário do ID Betha
  nome          TEXT NOT NULL,
  sigla         TEXT NOT NULL,
  codigo_tce    TEXT,
  poder         TEXT NOT NULL DEFAULT 'executivo',
  status_mapeamento TEXT NOT NULL CHECK (status_mapeamento IN ('inferido', 'confirmado')),
  nota          TEXT
);

CREATE TABLE coletas (
  id            BIGSERIAL PRIMARY KEY,
  consulta_id   INTEGER NOT NULL REFERENCES consultas(id),
  ano           SMALLINT NOT NULL,
  filtro        JSONB NOT NULL,
  iniciado_em   TIMESTAMPTZ NOT NULL,
  finalizado_em TIMESTAMPTZ NOT NULL,
  origem        TEXT NOT NULL CHECK (origem IN ('api', 'arquivo', 'exemplo')),
  status        TEXT NOT NULL CHECK (status IN ('totalizador_conciliado', 'rejeitado', 'exemplo')),
  total_hits    INTEGER NOT NULL,
  capturados    INTEGER NOT NULL,
  ids_unicos    INTEGER NOT NULL,
  campos_ausentes JSONB NOT NULL DEFAULT '{}',
  erros         JSONB NOT NULL DEFAULT '[]',
  hash_payload  TEXT NOT NULL                 -- sha256 dos registros brutos, para detectar mudanças entre coletas
);
CREATE INDEX ON coletas (consulta_id, ano, finalizado_em DESC);

-- Totalizador informado pela fonte versus soma calculada na coleta.
CREATE TABLE totais_fonte (
  coleta_id     BIGINT NOT NULL REFERENCES coletas(id) ON DELETE CASCADE,
  campo         TEXT NOT NULL,
  titulo        TEXT,
  descricao     TEXT,
  valor_fonte   NUMERIC(18,2),
  valor_calculado NUMERIC(18,2) NOT NULL,
  diferenca     NUMERIC(18,2),
  PRIMARY KEY (coleta_id, campo)
);

-- Resposta original de cada registro (sourceAsMap), sem perdas, para reprocessamento.
CREATE TABLE registros_brutos (
  coleta_id     BIGINT NOT NULL REFERENCES coletas(id) ON DELETE CASCADE,
  id_externo    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  PRIMARY KEY (coleta_id, id_externo)
);

-- Coleta aprovada que o dashboard exibe para cada consulta e exercício.
-- Só aponta para coletas conciliadas; trocar o ponteiro é a "publicação".
CREATE TABLE publicacoes (
  consulta_id   INTEGER NOT NULL REFERENCES consultas(id),
  ano           SMALLINT NOT NULL,
  coleta_id     BIGINT NOT NULL REFERENCES coletas(id),
  publicado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consulta_id, ano)
);

-- 57153: uma linha por rubrica × entidade × mês.
CREATE TABLE receitas (
  coleta_id     BIGINT NOT NULL REFERENCES coletas(id) ON DELETE CASCADE,
  id_externo    TEXT NOT NULL,
  ano           SMALLINT NOT NULL,
  entidade_codigo TEXT NOT NULL,
  id_rubrica_betha TEXT NOT NULL,             -- ID sem o sufixo de mês (ex.: 211:728:697340)
  mes           SMALLINT,                     -- inferido do sufixo _N; semântica a confirmar
  rubrica       TEXT NOT NULL,                -- código da natureza, sempre texto
  descricao     TEXT NOT NULL,
  valor_orcado  NUMERIC(18,2),
  valor_orcado_deducoes NUMERIC(18,2),
  valor_orcado_atualizado NUMERIC(18,2),
  valor_lancado_mes NUMERIC(18,2),
  valor_arrecadado_mes NUMERIC(18,2),
  valor_arrecadado_ate_mes NUMERIC(18,2),     -- acumulado: nunca somar entre meses
  percentual_realizado NUMERIC(10,2),
  PRIMARY KEY (coleta_id, id_externo)
);
CREATE INDEX ON receitas (coleta_id, entidade_codigo);
CREATE INDEX ON receitas (coleta_id, rubrica);

-- 57140: uma linha por empenho. Valores originais; não é a despesa líquida de anulações.
CREATE TABLE empenhos (
  coleta_id     BIGINT NOT NULL REFERENCES coletas(id) ON DELETE CASCADE,
  id_externo    TEXT NOT NULL,
  ano           SMALLINT NOT NULL,
  entidade_codigo TEXT NOT NULL,
  numero        INTEGER NOT NULL,             -- não é único: repete entre entidades e, em 2025, dentro do SAMAE
  data_empenho  DATE,
  orgao         TEXT,
  credor        TEXT,                         -- pode ser pessoa física
  historico     TEXT,
  valor_empenho NUMERIC(18,2),
  valor_liquidado NUMERIC(18,2),              -- NULL = não informado pela fonte (diferente de zero)
  valor_pago    NUMERIC(18,2),
  saldo_a_pagar NUMERIC(18,2),
  PRIMARY KEY (coleta_id, id_externo)
);
CREATE INDEX ON empenhos (coleta_id, entidade_codigo);
CREATE INDEX ON empenhos (coleta_id, data_empenho DESC, numero DESC);

-- Atalhos para o conjunto publicado.
CREATE VIEW receitas_publicadas AS
  SELECT r.* FROM receitas r
  JOIN publicacoes p ON p.coleta_id = r.coleta_id;

CREATE VIEW empenhos_publicados AS
  SELECT e.* FROM empenhos e
  JOIN publicacoes p ON p.coleta_id = e.coleta_id;

-- Catálogo inicial
INSERT INTO fontes (id, nome, url) VALUES
  ('betha', 'Portal da Transparência Betha — Orleans/SC', 'https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==');

INSERT INTO consultas (id, fonte_id, chave, nome, url_origem, campo_filtro_ano) VALUES
  (57153, 'betha', 'receitas', 'Receitas Orçamentárias',
   'https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==/consulta/57153', 'ano'),
  (57140, 'betha', 'empenhos', 'Execução Detalhada de Despesas',
   'https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==/consulta/57140', 'anoExercicio');

INSERT INTO entidades (codigo_betha, nome, sigla, status_mapeamento, nota) VALUES
  ('728',  'Prefeitura Municipal', 'Prefeitura', 'inferido', 'Totais por código = totais por filtro de entidade (2025)'),
  ('319',  'Fundo Municipal de Saúde', 'FMS', 'inferido', 'Totais por código = totais por filtro de entidade (2025)'),
  ('2473', 'SAMAE — Serviço Autônomo Municipal de Água e Esgoto', 'SAMAE', 'inferido', 'Totais por código = totais por filtro de entidade (2025)'),
  ('320',  'Fundação Ambiental Municipal de Orleans', 'Fundação Ambiental', 'inferido', 'Totais por código = totais por filtro de entidade (2025)');
