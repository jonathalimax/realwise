CREATE TYPE "public"."premium_status" AS ENUM('trialing', 'active', 'expired');
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "premium_access_started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "premium_access_ends_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "premium_purchased_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "premium_status" "premium_status" DEFAULT 'trialing';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "premium_payment_provider" varchar;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "premium_provider_payment_id" varchar;
