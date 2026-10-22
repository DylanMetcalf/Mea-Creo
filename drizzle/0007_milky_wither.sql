CREATE TABLE "fixes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organisation_id" uuid NOT NULL,
	"rule_key" text NOT NULL,
	"page_url" text NOT NULL,
	"area" text NOT NULL,
	"classification" text NOT NULL,
	"priority" text NOT NULL,
	"title" text NOT NULL,
	"issue" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deliverable" jsonb NOT NULL,
	"location" text NOT NULL,
	"instructions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"benefit" text NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uncertainty" text,
	"check" jsonb NOT NULL,
	"verification_method" text NOT NULL,
	"rollback" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_verification" jsonb,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "cms" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "fixes" ADD CONSTRAINT "fixes_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixes" ADD CONSTRAINT "fixes_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixes" ADD CONSTRAINT "fixes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixes_org_status_idx" ON "fixes" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE INDEX "fixes_rule_idx" ON "fixes" USING btree ("organisation_id","rule_key","page_url");