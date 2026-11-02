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
