CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"segment" text,
	"channel" text DEFAULT 'email' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lead_id" uuid,
	"organisation_id" uuid,
	"campaign_id" uuid,
	"direction" text NOT NULL,
	"channel" text NOT NULL,
	"purpose" text DEFAULT 'outreach' NOT NULL,
	"status" text NOT NULL,
	"to_name" text,
	"to_address" text,
	"subject" text,
	"body" text NOT NULL,
	"rationale" text,
	"classification" text,
	"classification_reason" text,
	"next_action" text,
	"approval_id" uuid,
	"created_by_id" uuid,
	"sent_by_id" uuid,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"source" text,
	"lead_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "consent_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "opted_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "decision_makers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "research" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "brief" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "recommended_package" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "attribution" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communications_lead_idx" ON "communications" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "communications_status_idx" ON "communications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressions_identifier_uq" ON "suppressions" USING btree ("kind","identifier");