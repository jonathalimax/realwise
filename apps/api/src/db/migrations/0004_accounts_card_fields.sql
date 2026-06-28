ALTER TABLE "accounts"
ADD COLUMN "bank_id" varchar,
ADD COLUMN "card_name" varchar,
ADD COLUMN "custom_bank_name" varchar,
ADD COLUMN "has_credit" boolean DEFAULT false,
ADD COLUMN "closing_day" integer,
ADD COLUMN "payment_day" integer;
