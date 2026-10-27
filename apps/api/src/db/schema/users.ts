import { pgTable, uuid, varchar, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { premiumStatusEnum, userRoleEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    email: varchar('email').notNull(),
    name: varchar('name'),
    profileImageUrl: varchar('profile_image_url'),
    firebaseUid: varchar('firebase_uid').unique(),
    appleId: varchar('apple_id').unique(),
    role: userRoleEnum('role').default('user').notNull(),
    refreshTokenHash: varchar('refresh_token_hash'),
    premiumAccessStartedAt: timestamp('premium_access_started_at', { withTimezone: true }),
    premiumAccessEndsAt: timestamp('premium_access_ends_at', { withTimezone: true }),
    premiumPurchasedAt: timestamp('premium_purchased_at', { withTimezone: true }),
    premiumStatus: premiumStatusEnum('premium_status').default('trialing'),
    premiumPaymentProvider: varchar('premium_payment_provider'),
    premiumProviderPaymentId: varchar('premium_provider_payment_id'),
    stripeCustomerId: varchar('stripe_customer_id'),
    stripeSubscriptionId: varchar('stripe_subscription_id'),
    subscriptionStatus: varchar('subscription_status'),
    subscriptionPlan: varchar('subscription_plan'),
    subscriptionCurrentPeriodEnd: timestamp('subscription_current_period_end', { withTimezone: true }),
    subscriptionCancelAtPeriodEnd: boolean('subscription_cancel_at_period_end').default(false).notNull(),
    reminderEmailsOptOut: boolean('reminder_emails_opt_out').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_client_email_idx').on(table.clientId, table.email),
    uniqueIndex('users_stripe_customer_id_idx').on(table.stripeCustomerId),
  ],
);
