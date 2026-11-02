-- Baseline: as migrações SQL originais do projeto (migrations/001 e 002), com o catálogo.
-- drizzle/meta/0000_snapshot.json é o snapshot de src/schema.ts; um teste compara os dois.

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

-- Betha 57170 (despesa orçamentária atualizada) e Farol TCE-SC (Qlik).
-- Os dados do TCE ficam em tabelas próprias: agregados e empenhos do TCE não
-- se misturam às tabelas Betha; a conferência entre fontes é feita por consulta.

-- Identificador na fonte quando ele não é o próprio consultas.id (apps Qlik têm UUID).
ALTER TABLE consultas ADD COLUMN identificador_externo JSONB;

-- 57170: uma linha por natureza × ação × entidade. Valores já líquidos de anulações.
CREATE TABLE despesas (
  coleta_id     BIGINT NOT NULL REFERENCES coletas(id) ON DELETE CASCADE,
  id_externo    TEXT NOT NULL,
  ano           SMALLINT NOT NULL,
  entidade_codigo TEXT NOT NULL,
  natureza      TEXT NOT NULL,                -- idNatureza, 14 dígitos (nível de elemento)
  acao_numero   TEXT,
  acao          TEXT,
  valor_orcado  NUMERIC(18,2),
  valor_orcado_atualizado NUMERIC(18,2),
  valor_empenhado NUMERIC(18,2),              -- empenhos menos anulações
  valor_liquidado NUMERIC(18,2),
  valor_pago    NUMERIC(18,2),
  PRIMARY KEY (coleta_id, id_externo)
);
CREATE INDEX ON despesas (coleta_id, entidade_codigo);

CREATE VIEW despesas_publicadas AS
  SELECT d.* FROM despesas d
  JOIN publicacoes p ON p.coleta_id = d.coleta_id;

-- Unidades gestoras do TCE-SC. A Câmara não tem entidade Betha: entidade_betha fica NULL.
-- O app de receitas só expõe o nome da unidade; o vínculo com ele é pelo nome exato.
CREATE TABLE unidades_tce (
  codigo_ug     TEXT PRIMARY KEY,             -- identificadorUG no app de despesas
  nome          TEXT NOT NULL UNIQUE,         -- nomeUG / nomeunidade, grafia do TCE
  sigla         TEXT NOT NULL,
  poder         TEXT NOT NULL,
  entidade_betha TEXT REFERENCES entidades(codigo_betha),
  status_mapeamento TEXT NOT NULL CHECK (status_mapeamento IN ('inferido', 'confirmado')),
  nota          TEXT
);

-- Receita arrecadada líquida: uma linha por unidade × natureza × mês × tipo de dedução.
CREATE TABLE tcesc_receitas (
  coleta_id     BIGINT NOT NULL REFERENCES coletas(id) ON DELETE CASCADE,
  id_externo    TEXT NOT NULL,                -- derivado das dimensões; não é ID de lançamento do TCE
  ano           SMALLINT NOT NULL,
  unidade       TEXT NOT NULL,
  codigo        TEXT NOT NULL,                -- codigoreceita, com pontos (ex.: 1.7.1.3.50.1.1)
  natureza      TEXT,
  tipo_deducao  TEXT,                         -- NULL = receita bruta
  mes           SMALLINT NOT NULL,
  valor_arrecadado NUMERIC(18,2) NOT NULL,
  PRIMARY KEY (coleta_id, id_externo)
);
CREATE INDEX ON tcesc_receitas (coleta_id, unidade);

-- Uma linha por empenho do exercício (ID Empenho do e-Sfinge), já com reforços,
-- estornos e execução vinculada. Não é a tabela `empenhos` da Betha.
CREATE TABLE tcesc_empenhos (
  coleta_id     BIGINT NOT NULL REFERENCES coletas(id) ON DELETE CASCADE,
  id_externo    TEXT NOT NULL,                -- ID Empenho
  ano           SMALLINT NOT NULL,
  codigo_ug     TEXT NOT NULL,
  numero        INTEGER,
  data_empenho  DATE,
  credor        TEXT,                         -- pode ser pessoa física
  historico     TEXT,
  valor_original NUMERIC(18,2),               -- Valor Empenho
  valor_reforco NUMERIC(18,2),
  valor_estorno NUMERIC(18,2),                -- negativo
  valor_empenhado NUMERIC(18,2),              -- LiquidoEmpenho
  valor_liquidado NUMERIC(18,2),              -- LiquidoLiquidacao
  valor_pago    NUMERIC(18,2),                -- LiquidoPagamento
  PRIMARY KEY (coleta_id, id_externo)
);
CREATE INDEX ON tcesc_empenhos (coleta_id, codigo_ug, numero);

INSERT INTO fontes (id, nome, url) VALUES
  ('tcesc', 'Farol TCE-SC — painéis municipais (e-Sfinge)', 'https://servicos.tcesc.tc.br/farol_externo/');

INSERT INTO consultas (id, fonte_id, chave, nome, url_origem, campo_filtro_ano, identificador_externo) VALUES
  (57170, 'betha', 'despesas', 'Despesas Orçamentárias',
   'https://transparencia.betha.cloud/#/mJRAZlfGu2RI9KNBWj49aw==/consulta/57170', 'ano', NULL),
  -- IDs internos do projeto, fora da faixa das consultas Betha; o ID real está em identificador_externo.
  (900001, 'tcesc', 'tcesc_receitas', 'Receitas Municipais — arrecadação por natureza e mês',
   'https://paineistransparencia.tce.sc.gov.br/extensions/appReceitasMunicipaisExterno/index.html', 'ano_competencia',
   '{"appId": "c97cd52c-9dd8-4c8c-83c4-733d037539f9", "filtroEnte": "nome_ente"}'),
  (900002, 'tcesc', 'tcesc_empenhos', 'Despesas Municipais — empenhos do exercício',
   'https://paineistransparencia.tce.sc.gov.br/extensions/appDespesasMunicipaisExternoNovo/index.html', 'Ano_Empenho',
   '{"appId": "74a8ae0b-233d-44e6-b341-1f718d19802f", "filtroEnte": "Ente"}');

-- Códigos de UG lidos em identificadorUG (Ente = ORLEANS). Vínculo com a Betha confirmado em 2025
-- pela igualdade exata, por entidade, do empenhado/liquidado/pago com a 57170.
INSERT INTO unidades_tce (codigo_ug, nome, sigla, poder, entidade_betha, status_mapeamento, nota) VALUES
  ('204', 'Prefeitura Municipal de Orleans', 'Prefeitura', 'Executivo', '728', 'confirmado', 'Despesa 2025 idêntica à 57170'),
  ('486', 'Fundo Municipal de Saúde de Orleans', 'FMS', 'Executivo', '319', 'confirmado', 'Despesa 2025 idêntica à 57170'),
  ('524', 'Serviço Autônomo Municipal de Água e Esgoto de Orleans', 'SAMAE', 'Executivo', '2473', 'confirmado', 'Despesa 2025 idêntica à 57170'),
  ('1839078', 'Fundação Ambiental Municipal de Orleans', 'Fundação Ambiental', 'Executivo', '320', 'confirmado', 'Despesa 2025 idêntica à 57170'),
  ('1864', 'Câmara Municipal de Orleans', 'Câmara', 'Legislativo', NULL, 'confirmado', 'Ausente no portal Betha da Prefeitura');

UPDATE entidades e SET codigo_tce = u.codigo_ug FROM unidades_tce u WHERE u.entidade_betha = e.codigo_betha;
