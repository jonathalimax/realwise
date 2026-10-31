CREATE TABLE IF NOT EXISTS "fiscal_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "stripe_invoice_id" varchar NOT NULL,
  "stripe_customer_id" varchar,
  "stripe_payment_intent_id" varchar,
  "stripe_invoice_number" varchar,
  "hosted_invoice_url" varchar,
  "customer_name" varchar,
  "customer_email" varchar,
  "customer_doc" varchar,
  "customer_address" jsonb,
  "amount_cents" integer NOT NULL,
  "currency" varchar DEFAULT 'brl' NOT NULL,
  "plan_label" varchar,
  "paid_at" timestamp with time zone NOT NULL,
  "status" varchar DEFAULT 'review' NOT NULL,
  "skip_reason" varchar,
  "environment" varchar,
  "provider" varchar DEFAULT 'focusnfe' NOT NULL,
  "provider_ref" varchar,
  "nfse_number" varchar,
  "verification_code" varchar,
  "nfse_url" varchar,
  "pdf_url" varchar,
  "xml_path" varchar,
  "issued_at" timestamp with time zone,
  "error_message" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "next_attempt_at" timestamp with time zone,
  "refunded_cents" integer DEFAULT 0 NOT NULL,
  "refunded_at" timestamp with time zone,
  "canceled_at" timestamp with time zone,
  "cancel_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_invoices_stripe_invoice_idx" ON "fiscal_invoices" ("stripe_invoice_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_invoices_provider_ref_idx" ON "fiscal_invoices" ("provider_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fiscal_invoices_status_idx" ON "fiscal_invoices" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fiscal_invoices_user_idx" ON "fiscal_invoices" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fiscal_invoices_payment_intent_idx" ON "fiscal_invoices" ("stripe_payment_intent_id");
