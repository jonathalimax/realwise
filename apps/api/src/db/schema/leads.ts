import { pgTable, uuid, varchar, jsonb, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  email: varchar('email').notNull(),
  name: varchar('name'),
  plan: varchar('plan'),
  phone: varchar('phone'),
  /** Where it came from: 'landing' form, or the utm_source of the visit. */
  source: varchar('source'),
  /** The visitor ticked the box to receive promotions and news (LGPD). */
  marketingConsent: boolean('marketing_consent').default(false).notNull(),
  status: varchar('status').default('new'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Anonymous landing-page funnel events: one 'view' per visit and one 'cta_click' per tap on a call to action. */
export const landingEvents = pgTable(
  'landing_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    visitorId: varchar('visitor_id', { length: 64 }).notNull(),
    event: varchar('event', { length: 20 }).notNull(),
    cta: varchar('cta', { length: 80 }),
    source: varchar('source', { length: 80 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('landing_events_created_idx').on(t.createdAt), index('landing_events_visitor_idx').on(t.visitorId)],
);
