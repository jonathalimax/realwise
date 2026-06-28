ALTER TABLE "goals"
  ADD COLUMN "icon" varchar,
  ADD COLUMN "color" varchar,
  ADD COLUMN "description" varchar,
  ADD COLUMN "completed" boolean DEFAULT false NOT NULL;
