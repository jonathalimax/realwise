CREATE TABLE IF NOT EXISTS "pricing_config" (
  "config_key" varchar PRIMARY KEY DEFAULT 'landing-pricing' NOT NULL,
  "base_price_cents" integer DEFAULT 23880 NOT NULL,
  "installments" integer DEFAULT 12 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
