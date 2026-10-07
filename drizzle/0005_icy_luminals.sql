CREATE TABLE "client_prospects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organisation_id" uuid NOT NULL,
	"week_of" date NOT NULL,
	"company" text NOT NULL,
	"website" text,
	"industry" text,
	"location" text,
	"contact_name" text,
	"contact_role" text,
	"email" text,
	"phone" text,
	"linkedin_url" text,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"client_note" text,
	"released_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_programmes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organisation_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"weekly_quota" integer DEFAULT 10 NOT NULL,
	"criteria" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_prospects" ADD CONSTRAINT "client_prospects_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_prospects" ADD CONSTRAINT "client_prospects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_programmes" ADD CONSTRAINT "prospect_programmes_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_prospects_org_week_idx" ON "client_prospects" USING btree ("organisation_id","week_of");--> statement-breakpoint
CREATE UNIQUE INDEX "prospect_programmes_org_idx" ON "prospect_programmes" USING btree ("organisation_id");