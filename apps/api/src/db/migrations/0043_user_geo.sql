ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "geo_country" varchar(2);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "geo_region" varchar(80);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "geo_city" varchar(120);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "geo_at" timestamp with time zone;
