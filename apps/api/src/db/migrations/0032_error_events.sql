CREATE TABLE "error_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fingerprint" varchar(40) NOT NULL,
  "source" varchar(16) NOT NULL,
  "level" varchar(8) DEFAULT 'error' NOT NULL,
  "status_code" integer,
  "method" varchar(10),
  "route" varchar(300),
  "message" text NOT NULL,
  "stack" text,
  "user_id" uuid,
  "user_email" varchar(320),
  "app_version" varchar(40),
  "user_agent" varchar(400),
  "context" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "error_events_fingerprint_idx" ON "error_events" USING btree ("fingerprint","created_at");--> statement-breakpoint
CREATE INDEX "error_events_created_idx" ON "error_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "error_events_user_idx" ON "error_events" USING btree ("user_id");--> statement-breakpoint
CREATE TABLE "error_groups" (
  "fingerprint" varchar(40) PRIMARY KEY NOT NULL,
  "status" varchar(12) DEFAULT 'open' NOT NULL,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
