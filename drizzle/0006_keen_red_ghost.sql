DROP INDEX "idx_relations_source";--> statement-breakpoint
DROP INDEX "idx_relations_target";--> statement-breakpoint
ALTER TABLE "relations" DROP CONSTRAINT "relations_source_id_target_id_relation_type_pk";--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_id_target_id_field_id_pk" PRIMARY KEY("source_id","target_id","field_id");--> statement-breakpoint
ALTER TABLE "relations" ADD COLUMN "field_id" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_id_form_submissions_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_id_form_submissions_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_relations_source" ON "relations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_relations_target" ON "relations" USING btree ("target_id");--> statement-breakpoint
ALTER TABLE "relations" DROP COLUMN "source_type";--> statement-breakpoint
ALTER TABLE "relations" DROP COLUMN "target_type";--> statement-breakpoint
ALTER TABLE "relations" DROP COLUMN "relation_type";--> statement-breakpoint
ALTER TABLE "relations" DROP COLUMN "metadata";