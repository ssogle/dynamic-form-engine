CREATE TABLE "relations" (
	"source_id" uuid NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"target_id" uuid NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"relation_type" varchar(50) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relations_source_id_target_id_relation_type_pk" PRIMARY KEY("source_id","target_id","relation_type")
);
--> statement-breakpoint
CREATE INDEX "idx_relations_source" ON "relations" USING btree ("source_id","relation_type");--> statement-breakpoint
CREATE INDEX "idx_relations_target" ON "relations" USING btree ("target_id","relation_type");