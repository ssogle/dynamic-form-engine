ALTER TABLE "analysis_views" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;