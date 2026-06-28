ALTER TABLE "settings" ADD COLUMN "tutorial_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "gemini_api_key" varchar;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "expense_categories" jsonb;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "income_categories" jsonb;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "category_rule_mapping" jsonb;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "rule_percentages" jsonb;
