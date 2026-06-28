ALTER TABLE "bills"
ADD COLUMN "description" varchar,
ADD COLUMN "category" varchar,
ADD COLUMN "recurrence_end_date" timestamp with time zone,
ADD COLUMN "notification_enabled" boolean DEFAULT true,
ADD COLUMN "notification_days_before" integer DEFAULT 3,
ADD COLUMN "linked_bank_id" varchar,
ADD COLUMN "paid_date" timestamp with time zone,
ADD COLUMN "postpone_count" integer DEFAULT 0,
ADD COLUMN "next_reminder_at" timestamp with time zone;
