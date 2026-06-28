ALTER TABLE "categorization_rules"
  ADD COLUMN "category" varchar,
  ADD COLUMN "type" varchar,
  ADD COLUMN "original_description" varchar,
  ADD COLUMN "used_count" integer DEFAULT 1 NOT NULL,
  ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
