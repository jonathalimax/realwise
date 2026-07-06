ALTER TABLE "pricing_config"
ADD COLUMN "compare_at_price_cents" integer DEFAULT 47988 NOT NULL;
--> statement-breakpoint
ALTER TABLE "pricing_config"
ADD COLUMN "stripe_wallet_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "pricing_config"
ADD COLUMN "mercadopago_enabled" boolean DEFAULT true NOT NULL;
