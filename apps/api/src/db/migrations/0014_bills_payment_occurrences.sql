ALTER TABLE "bills"
ADD COLUMN "paid_at" timestamp with time zone,
ADD COLUMN "paid_amount" numeric(12, 2),
ADD COLUMN "series_id" varchar;
