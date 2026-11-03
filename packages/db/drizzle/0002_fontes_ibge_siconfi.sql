CREATE TABLE "ibge_valores" (
	"coleta_id" bigint NOT NULL,
	"id_externo" text NOT NULL,
	"ano" smallint NOT NULL,
	"tabela" text NOT NULL,
	"variavel" text NOT NULL,
	"periodo" text NOT NULL,
	"categoria" text NOT NULL,
	"valor" numeric(18, 3),
	"unidade" text NOT NULL,
	"simbolo" text,
	CONSTRAINT "ibge_valores_pkey" PRIMARY KEY("coleta_id","id_externo")
);
--> statement-breakpoint
CREATE TABLE "siconfi_funcoes" (
	"coleta_id" bigint NOT NULL,
	"id_externo" text NOT NULL,
	"ano" smallint NOT NULL,
	"etapa" text NOT NULL,
	"tipo" text NOT NULL,
	"funcao_codigo" text,
	"subfuncao_codigo" text,
	"conta" text NOT NULL,
	"valor" numeric(18, 2) NOT NULL,
	CONSTRAINT "siconfi_funcoes_pkey" PRIMARY KEY("coleta_id","id_externo"),
	CONSTRAINT "siconfi_funcoes_etapa_check" CHECK ("siconfi_funcoes"."etapa" IN ('empenhado', 'liquidado', 'pago', 'rp_nao_processados', 'rp_processados')),
	CONSTRAINT "siconfi_funcoes_tipo_check" CHECK ("siconfi_funcoes"."tipo" IN ('total', 'funcao', 'subfuncao'))
);
--> statement-breakpoint
ALTER TABLE "ibge_valores" ADD CONSTRAINT "ibge_valores_coleta_id_fkey" FOREIGN KEY ("coleta_id") REFERENCES "public"."coletas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "siconfi_funcoes" ADD CONSTRAINT "siconfi_funcoes_coleta_id_fkey" FOREIGN KEY ("coleta_id") REFERENCES "public"."coletas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE VIEW ibge_valores_publicados AS
  SELECT v.* FROM ibge_valores v
  JOIN publicacoes p ON p.coleta_id = v.coleta_id;
--> statement-breakpoint
CREATE VIEW siconfi_funcoes_publicadas AS
  SELECT f.* FROM siconfi_funcoes f
  JOIN publicacoes p ON p.coleta_id = f.coleta_id;
--> statement-breakpoint
INSERT INTO fontes (id, nome, url) VALUES
  ('ibge', 'IBGE — agregados do SIDRA', 'https://servicodados.ibge.gov.br/api/docs/agregados?versao=3'),
  ('siconfi', 'SICONFI — Tesouro Nacional', 'https://siconfi.tesouro.gov.br/');
--> statement-breakpoint
-- IDs internos do projeto: 9001xx para o IBGE e 9002xx para o SICONFI.
INSERT INTO consultas (id, fonte_id, chave, nome, url_origem, campo_filtro_ano, identificador_externo) VALUES
  (900101, 'ibge', 'ibge_populacao', 'População: estimativas e censos',
   'https://servicodados.ibge.gov.br/api/docs/agregados?versao=3', 'periodos', '{"tabelas": ["6579", "200", "4709"]}'),
  (900102, 'ibge', 'ibge_censo', 'Censo 2022: território, situação do domicílio, pirâmide etária e rendimento',
   'https://servicodados.ibge.gov.br/api/docs/agregados?versao=3', 'periodos', '{"tabelas": ["4714", "9923", "9514", "10295"]}'),
  (900103, 'ibge', 'ibge_pib', 'Produto Interno Bruto dos Municípios',
   'https://servicodados.ibge.gov.br/api/docs/agregados?versao=3', 'periodos', '{"tabelas": ["5938"]}'),
  (900201, 'siconfi', 'siconfi_funcoes', 'DCA Anexo I-E — Despesas por Função',
   'https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra/finbra_list.jsf', 'an_exercicio', '{"anexo": "DCA-Anexo I-E"}');
