CREATE TABLE "educacao_financas" (
	"coleta_id" bigint NOT NULL,
	"id_externo" text NOT NULL,
	"ano" smallint NOT NULL,
	"periodo" text NOT NULL,
	"indicador" text NOT NULL,
	"lugar" text NOT NULL,
	"rede" text NOT NULL,
	"recorte" text NOT NULL,
	"valor" numeric(18, 2),
	"percentual" numeric(7, 2),
	CONSTRAINT "educacao_financas_pkey" PRIMARY KEY("coleta_id","id_externo"),
	CONSTRAINT "educacao_financas_rede_check" CHECK ("educacao_financas"."rede" IN ('publica', 'municipal', 'estadual', 'federal', 'privada', 'todas'))
);
--> statement-breakpoint
CREATE TABLE "educacao_valores" (
	"coleta_id" bigint NOT NULL,
	"id_externo" text NOT NULL,
	"ano" smallint NOT NULL,
	"periodo" text NOT NULL,
	"indicador" text NOT NULL,
	"lugar" text NOT NULL,
	"rede" text NOT NULL,
	"etapa" text NOT NULL,
	"recorte" text NOT NULL,
	"valor" numeric(18, 4),
	"texto" text,
	"unidade" text NOT NULL,
	CONSTRAINT "educacao_valores_pkey" PRIMARY KEY("coleta_id","id_externo"),
	CONSTRAINT "educacao_valores_rede_check" CHECK ("educacao_valores"."rede" IN ('publica', 'municipal', 'estadual', 'federal', 'privada', 'todas'))
);
--> statement-breakpoint
ALTER TABLE "educacao_financas" ADD CONSTRAINT "educacao_financas_coleta_id_fkey" FOREIGN KEY ("coleta_id") REFERENCES "public"."coletas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educacao_valores" ADD CONSTRAINT "educacao_valores_coleta_id_fkey" FOREIGN KEY ("coleta_id") REFERENCES "public"."coletas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE VIEW educacao_valores_publicados AS
  SELECT v.* FROM educacao_valores v
  JOIN publicacoes p ON p.coleta_id = v.coleta_id;
--> statement-breakpoint
CREATE VIEW educacao_financas_publicadas AS
  SELECT f.* FROM educacao_financas f
  JOIN publicacoes p ON p.coleta_id = f.coleta_id;
--> statement-breakpoint
INSERT INTO fontes (id, nome, url) VALUES
  ('inep', 'INEP — indicadores e microdados', 'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos'),
  ('siope', 'SIOPE — FNDE', 'https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope'),
  ('mec', 'MEC — Retrato da Educação Infantil', 'https://www.gov.br/mec/pt-br/pnei/retrato-da-educacao-infantil-no-brasil');
--> statement-breakpoint
-- IDs internos: 90010x IBGE, 900202 SICONFI, 9003xx INEP, 9004xx SIOPE, 900501 MEC.
INSERT INTO consultas (id, fonte_id, chave, nome, url_origem, campo_filtro_ano, identificador_externo) VALUES
  (900105, 'ibge', 'ibge_educacao_censo', 'Censo: alfabetização, frequência, instrução e local da escola',
   'https://servicodados.ibge.gov.br/api/docs/agregados?versao=3', 'periodos', '{"tabelas": ["10091", "10092", "10056", "10057", "10058", "10059", "10061", "10062", "10324", "1549"]}'),
  (900106, 'ibge', 'ibge_educacao_comparacao', 'Brasil e Santa Catarina: Censo de educação',
   'https://servicodados.ibge.gov.br/api/docs/agregados?versao=3', 'periodos', '{"tabelas": ["10091", "10092", "10056", "10057", "10058", "10059", "10061", "10062", "10324", "1549"]}'),
  (900107, 'ibge', 'ibge_rede_escolar', 'IDEB, matrículas, docentes e escolas (pesquisas 40 e 13)',
   'https://servicodados.ibge.gov.br/api/docs/pesquisas?versao=1', 'periodos', '{"pesquisas": ["40", "13"]}'),
  (900202, 'siconfi', 'siconfi_indices', 'RREO Anexo 14 — índices de educação',
   'https://apidatalake.tesouro.gov.br/docs/siconfi/', 'an_exercicio', '{"anexo": "RREO-Anexo 14"}'),
  (900301, 'inep', 'inep_rendimento', 'Taxas de rendimento: aprovação, reprovação e abandono',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/taxas-de-rendimento-escolar', 'ano', NULL),
  (900302, 'inep', 'inep_transicao', 'Taxas de transição: promoção, repetência e evasão',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/taxas-de-transicao', 'ano', NULL),
  (900303, 'inep', 'inep_distorcao', 'Distorção idade-série',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/taxas-de-distorcao-idade-serie', 'ano', NULL),
  (900304, 'inep', 'inep_turmas', 'Média de alunos por turma',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/media-de-alunos-por-turma', 'ano', NULL),
  (900305, 'inep', 'inep_horas', 'Média de horas-aula diária',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/media-de-horas-aula-diaria', 'ano', NULL),
  (900306, 'inep', 'inep_docentes_superior', 'Docentes com curso superior',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/percentual-de-docentes-com-curso-superior', 'ano', NULL),
  (900307, 'inep', 'inep_adequacao', 'Adequação da formação docente',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/adequacao-da-formacao-docente', 'ano', NULL),
  (900308, 'inep', 'inep_regularidade', 'Regularidade do corpo docente',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/regularidade-do-corpo-docente', 'ano', NULL),
  (900309, 'inep', 'inep_esforco', 'Esforço docente',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/esforco-docente', 'ano', NULL),
  (900310, 'inep', 'inep_remuneracao', 'Remuneração média dos docentes (RAIS)',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/remuneracao-media-dos-docentes', 'ano', NULL),
  (900311, 'inep', 'inep_inse', 'Nível socioeconômico',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/nivel-socioeconomico', 'ano', NULL),
  (900312, 'inep', 'inep_alfabetizacao', 'Alfabetização no 2º ano',
   'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/avaliacao-da-alfabetizacao/resultados', 'ano', NULL),
  (900313, 'inep', 'inep_ideb', 'IDEB: notas, rendimento e comparação',
   'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados', 'ano', NULL),
  (900314, 'inep', 'inep_enem', 'ENEM: agregados das escolas de Orleans',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enem', 'ano', NULL),
  (900315, 'inep', 'inep_superior', 'Censo da Educação Superior, IGC, CPC e Enade',
   'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-da-educacao-superior', 'ano', NULL),
  (900401, 'siope', 'siope_indicadores', 'Relatório de Indicadores',
   'https://www.fnde.gov.br/siope/indicadoresFinanceirosEEducacionais.do', 'ano', NULL),
  (900402, 'siope', 'siope_anexo8', 'RREO Anexo 8 no SIOPE',
   'https://www.fnde.gov.br/siope/relatorioRREOMunicipal2006.do', 'ano', NULL),
  (900403, 'siope', 'siope_remuneracao', 'Remuneração dos profissionais: só agregados',
   'https://www.fnde.gov.br/siope/consultarRemuneracaoMunicipal.do', 'ano', NULL),
  (900501, 'mec', 'mec_retrato', 'Retrato da Educação Infantil: resposta do município',
   'https://www.gov.br/mec/pt-br/pnei/retrato-da-educacao-infantil-no-brasil', 'ano', NULL);
