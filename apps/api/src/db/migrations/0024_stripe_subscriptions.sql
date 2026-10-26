ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_plan" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_stripe_customer_id_idx" ON "users" USING btree ("stripe_customer_id");--> statement-breakpoint
-- Data step: users who paid the legacy one-time price ('active') keep lifetime access.
-- Everyone else (trialing, expired or unset) gets a fresh 3-day trial starting at deploy time.
UPDATE "users" SET "premium_status" = 'trialing', "premium_access_started_at" = now(), "premium_access_ends_at" = now() + interval '3 days', "updated_at" = now() WHERE "premium_status" IS DISTINCT FROM 'active';
