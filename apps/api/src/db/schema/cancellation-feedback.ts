import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * One row each time a subscriber starts the in-app cancel flow: why they want to leave, what we offered and what
 * they decided. `outcome`: pending | accepted (took the offer, stayed) | declined (saw an offer, cancelled anyway) |
 * cancelled (cancelled, no offer for that reason). Deleted with the account (it has a user_id column).
 */
export const cancellationFeedback = pgTable(
  'cancellation_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    stripeSubscriptionId: varchar('stripe_subscription_id'),
    reason: varchar('reason').notNull(),
    comment: text('comment'),
    /** 'discount' | 'free_month' | null (no offer for this reason or not eligible) */
    offerKind: varchar('offer_kind'),
    outcome: varchar('outcome').notNull().default('pending'),
    planLabel: varchar('plan_label'),
    /** What they paid per period (centavos, list price after any coupon) when they started the flow. */
    amountCents: integer('amount_cents'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [index('cancellation_feedback_created_idx').on(t.createdAt), index('cancellation_feedback_user_idx').on(t.userId)],
);
