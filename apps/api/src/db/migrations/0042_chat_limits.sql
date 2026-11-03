ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "chat_limits_disabled" boolean DEFAULT false NOT NULL;
CREATE TABLE IF NOT EXISTS "chat_limit_hits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" varchar NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "window" varchar NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "chat_limit_hits_created_idx" ON "chat_limit_hits" ("created_at");
CREATE INDEX IF NOT EXISTS "chat_limit_hits_user_idx" ON "chat_limit_hits" ("user_id", "created_at");
