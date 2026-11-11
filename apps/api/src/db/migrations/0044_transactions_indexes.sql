CREATE INDEX IF NOT EXISTS "transactions_user_date_idx" ON "transactions" USING btree ("user_id","date");
CREATE INDEX IF NOT EXISTS "transactions_installment_group_idx" ON "transactions" USING btree ("installment_group_id");
