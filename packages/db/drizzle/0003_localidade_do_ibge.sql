ALTER TABLE "ibge_valores" ADD COLUMN "localidade" text NOT NULL DEFAULT '4211702';--> statement-breakpoint
ALTER TABLE "ibge_valores" ALTER COLUMN "localidade" DROP DEFAULT;--> statement-breakpoint
-- O SELECT * da view foi expandido na criação: sem recriar, ela não enxerga a coluna nova.
DROP VIEW ibge_valores_publicados;--> statement-breakpoint
CREATE VIEW ibge_valores_publicados AS
  SELECT v.* FROM ibge_valores v
  JOIN publicacoes p ON p.coleta_id = v.coleta_id;
--> statement-breakpoint
INSERT INTO consultas (id, fonte_id, chave, nome, url_origem, campo_filtro_ano, identificador_externo) VALUES
  (900104, 'ibge', 'ibge_comparacao', 'Brasil e Santa Catarina: população, Censo 2022 e PIB',
   'https://servicodados.ibge.gov.br/api/docs/agregados?versao=3', 'periodos', '{"tabelas": ["6579", "200", "4709", "4714", "9923", "9514", "10295", "5938"]}');
