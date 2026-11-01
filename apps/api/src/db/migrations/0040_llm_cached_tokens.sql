ALTER TABLE "llm_call_log" ADD COLUMN IF NOT EXISTS "cached_input_tokens" integer DEFAULT 0 NOT NULL;
