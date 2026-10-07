CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"organisation_id" text,
	"requested_from" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"quote" text,
	"name" text,
	"role" text,
	"company" text,
	"industry" text,
	"attribution" text,
	"consent_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "testimonials_token_idx" ON "testimonials" USING btree ("token");--> statement-breakpoint
CREATE INDEX "testimonials_status_idx" ON "testimonials" USING btree ("status");