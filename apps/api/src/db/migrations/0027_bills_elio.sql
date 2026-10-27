ALTER TABLE "chat_messages" ADD COLUMN "bills_panel" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bill_detection_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "bill_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id"),
	"merchant_key" varchar NOT NULL,
	"name" varchar NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"day_of_month" integer NOT NULL,
	"months_seen" integer NOT NULL,
	"category" varchar,
	"category_id" uuid,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"emailed_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "bill_suggestions_user_merchant_idx" ON "bill_suggestions" USING btree ("user_id","merchant_key");
