ALTER TABLE "forms" DROP CONSTRAINT "forms_slug_unique";--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "forms_active_slug_unique" ON "forms" USING btree ("slug") WHERE deleted_at IS NULL;