CREATE TABLE "execucoes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"importador" text NOT NULL,
	"ano" smallint NOT NULL,
	"iniciado_em" timestamp with time zone NOT NULL,
	"finalizado_em" timestamp with time zone,
	"status" text DEFAULT 'em_andamento' NOT NULL,
	"linhas_lidas" integer DEFAULT 0 NOT NULL,
	"linhas_gravadas" integer DEFAULT 0 NOT NULL,
	"erro" text,
	"detalhes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "execucoes_status_check" CHECK ("execucoes"."status" IN ('em_andamento', 'sucesso', 'rejeitada', 'falhou'))
);
--> statement-breakpoint
CREATE INDEX "execucoes_importador_ano_iniciado_em_idx" ON "execucoes" USING btree ("importador","ano","iniciado_em" DESC NULLS FIRST);