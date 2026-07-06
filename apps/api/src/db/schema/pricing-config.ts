import { pgTable, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const pricingConfig = pgTable('pricing_config', {
  configKey: varchar('config_key').primaryKey().default('landing-pricing'),
  basePriceCents: integer('base_price_cents').default(23880).notNull(),
  compareAtPriceCents: integer('compare_at_price_cents').default(47988).notNull(),
  installments: integer('installments').default(12).notNull(),
  stripeWalletEnabled: boolean('stripe_wallet_enabled').default(true).notNull(),
  mercadopagoEnabled: boolean('mercadopago_enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
