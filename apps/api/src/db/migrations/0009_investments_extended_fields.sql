ALTER TYPE "public"."investment_type" ADD VALUE IF NOT EXISTS 'fixed_income';
ALTER TYPE "public"."investment_type" ADD VALUE IF NOT EXISTS 'stocks';
ALTER TYPE "public"."investment_type" ADD VALUE IF NOT EXISTS 'funds';
ALTER TYPE "public"."investment_type" ADD VALUE IF NOT EXISTS 'real_estate';

ALTER TABLE "investments"
  ADD COLUMN "bank" varchar,
  ADD COLUMN "initial_amount" numeric(12, 2),
  ADD COLUMN "current_amount" numeric(12, 2),
  ADD COLUMN "expected_return" numeric(12, 6),
  ADD COLUMN "return_type" varchar,
  ADD COLUMN "purchase_date" date,
  ADD COLUMN "maturity_date" date,
  ADD COLUMN "goal_id" varchar,
  ADD COLUMN "planner_goal_id" varchar,
  ADD COLUMN "platform" varchar,
  ADD COLUMN "coin_name" varchar,
  ADD COLUMN "fund_name" varchar,
  ADD COLUMN "property_description" varchar,
  ADD COLUMN "transaction_id" varchar,
  ADD COLUMN "notes" varchar,
  ADD COLUMN "total_withdrawn" numeric(12, 2),
  ADD COLUMN "last_withdraw_date" timestamp with time zone,
  ADD COLUMN "status" varchar,
  ADD COLUMN "source" varchar;
