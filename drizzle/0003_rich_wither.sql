CREATE TABLE "portfolio_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"label" text NOT NULL,
	"message" text,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "portfolio_links_token_idx" ON "portfolio_links" USING btree ("token");