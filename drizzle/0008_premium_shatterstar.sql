CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'subscribed' NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"consent_text" text NOT NULL,
	"source" text,
	"unsubscribe_token" text NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "newsletter_subscribers_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE INDEX "newsletter_status_idx" ON "newsletter_subscribers" USING btree ("status");