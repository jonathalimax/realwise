ALTER TABLE "users" ADD COLUMN "marketing_emails_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_note" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "llm_budget_override_usd" numeric(10, 4);--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid REFERENCES "users"("id"),
	"name" varchar,
	"email" varchar NOT NULL,
	"subject" varchar,
	"message" text NOT NULL,
	"source" varchar DEFAULT 'app' NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"admin_reply" text,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "support_messages_status_idx" ON "support_messages" USING btree ("status","created_at");--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"admin_email" varchar,
	"action" varchar NOT NULL,
	"target_user_id" uuid,
	"target_label" varchar,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"body" text NOT NULL,
	"cta_label" varchar,
	"cta_url" varchar,
	"segment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "email_campaign_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL REFERENCES "email_campaigns"("id"),
	"user_id" uuid NOT NULL REFERENCES "users"("id"),
	"email" varchar NOT NULL,
	"status" varchar NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "email_campaign_sends_unique_idx" ON "email_campaign_sends" USING btree ("campaign_id","user_id");
