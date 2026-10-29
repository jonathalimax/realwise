ALTER TABLE "leads" ADD COLUMN "phone" varchar;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source" varchar;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "landing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" varchar(64) NOT NULL,
	"event" varchar(20) NOT NULL,
	"cta" varchar(80),
	"source" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "landing_events_created_idx" ON "landing_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "landing_events_visitor_idx" ON "landing_events" USING btree ("visitor_id");
