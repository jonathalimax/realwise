ALTER TABLE "budgets"
  ALTER COLUMN "name" DROP NOT NULL,
  ALTER COLUMN "amount" DROP NOT NULL,
  ADD COLUMN "month" varchar,
  ADD COLUMN "total_budget" numeric(12, 2),
  ADD COLUMN "category_budgets" jsonb;
