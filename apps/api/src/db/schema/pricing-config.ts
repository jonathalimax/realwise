import { pgTable, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const pricingConfig = pgTable('pricing_config', {
  configKey: varchar('config_key').primaryKey().default('landing-pricing'),
  basePriceCents: integer('base_price_cents').default(23880).notNull(),
  installments: integer('installments').default(12).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
