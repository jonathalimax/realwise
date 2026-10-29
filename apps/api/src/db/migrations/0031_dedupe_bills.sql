-- Exact duplicate bills (same user, name, amount, due date, recurrence) that are still unpaid: keep the oldest, hide the rest.
-- Soft delete only (deleted_at), so nothing is destroyed and reminders keep resolving to "not found".
UPDATE "bills" SET "deleted_at" = now(), "updated_at" = now()
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (
      PARTITION BY "client_id", "user_id", lower(btrim("name")), "amount", "due_date", coalesce("recurrence"::text, '')
      ORDER BY "created_at", "id"
    ) AS rn
    FROM "bills"
    WHERE "deleted_at" IS NULL AND "status" = 'pending' AND "paid_at" IS NULL
  ) d WHERE d.rn > 1
);
