CREATE TABLE IF NOT EXISTS "cancellation_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "stripe_subscription_id" varchar,
  "reason" varchar NOT NULL,
  "comment" text,
  "offer_kind" varchar,
  "outcome" varchar DEFAULT 'pending' NOT NULL,
  "plan_label" varchar,
  "amount_cents" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cancellation_feedback_created_idx" ON "cancellation_feedback" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cancellation_feedback_user_idx" ON "cancellation_feedback" ("user_id");
