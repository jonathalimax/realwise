CREATE TABLE "financial_summaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "client_id" varchar NOT NULL,
  "kind" varchar(16) NOT NULL,
  "period" varchar(16) NOT NULL,
  "token" varchar(64) NOT NULL,
  "tone" varchar(12) NOT NULL,
  "score" integer,
  "payload" jsonb NOT NULL,
  "sent_at" timestamp with time zone,
  "opened_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "financial_summaries_token_idx" ON "financial_summaries" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_summaries_user_period_idx" ON "financial_summaries" USING btree ("user_id","kind","period");
