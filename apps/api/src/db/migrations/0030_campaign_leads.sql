ALTER TABLE "email_campaign_sends" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_campaign_sends" ADD COLUMN "lead_id" uuid REFERENCES "leads"("id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_campaign_sends_lead_unique_idx" ON "email_campaign_sends" USING btree ("campaign_id","lead_id");
