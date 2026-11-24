-- Natureza da receita no formato de 14 dígitos e o sinal de dedução, gerados da rubrica como a Betha publica
-- (até 2019, 15 dígitos com a classe na frente: 4 receita, 9 dedução). Vale para as coletas já gravadas.
ALTER TABLE "receitas" ADD COLUMN "natureza" text GENERATED ALWAYS AS (CASE WHEN length(rubrica) = 15 AND left(rubrica, 1) IN ('4', '9') THEN substr(rubrica, 2) ELSE rubrica END) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "receitas" ADD COLUMN "deducao" boolean GENERATED ALWAYS AS ((length(rubrica) = 15 AND left(rubrica, 1) = '9')) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX "receitas_coleta_id_natureza_idx" ON "receitas" USING btree ("coleta_id","natureza");