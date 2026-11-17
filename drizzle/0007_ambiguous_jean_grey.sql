CREATE TABLE "analysis_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_analysis_views_active" ON "analysis_views" USING btree ("created_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_analysis_views_published" ON "analysis_views" USING btree ("published_at") WHERE deleted_at IS NULL AND published_at IS NOT NULL;