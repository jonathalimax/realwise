CREATE TABLE "user_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id"),
	"content" varchar(240) NOT NULL,
	"kind" varchar DEFAULT 'context' NOT NULL,
	"source" varchar DEFAULT 'chat' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "user_memories_user_idx" ON "user_memories" USING btree ("user_id");
