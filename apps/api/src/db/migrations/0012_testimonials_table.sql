CREATE TABLE IF NOT EXISTS "testimonials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "firebase_doc_id" varchar,
  "name" varchar NOT NULL,
  "role" varchar,
  "text" text NOT NULL,
  "avatar" varchar DEFAULT '👤' NOT NULL,
  "rating" integer DEFAULT 5 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "testimonials_firebase_doc_id_unique" ON "testimonials" USING btree ("firebase_doc_id");
