ALTER TABLE "users" ADD COLUMN "reminder_emails_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "reminder_emails_sent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id"),
	"kind" varchar NOT NULL,
	"period_key" varchar NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_emails_sent_unique_idx" ON "reminder_emails_sent" USING btree ("user_id","kind","period_key");
