import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

/** A message sent through the in-app/login contact form. Visible and answerable in the admin inbox. */
export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    name: varchar('name'),
    email: varchar('email').notNull(),
    subject: varchar('subject'),
    message: text('message').notNull(),
    /** 'app' (logged in) | 'login' (anonymous visitor) */
    source: varchar('source').notNull().default('app'),
    /** 'open' | 'answered' | 'closed' */
    status: varchar('status').notNull().default('open'),
    adminReply: text('admin_reply'),
    repliedAt: timestamp('replied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('support_messages_status_idx').on(t.status, t.createdAt)],
);

/** Runtime-editable settings (AI budgets/models, email schedule, announcement banner). Env vars stay the fallback. */
export const appSettings = pgTable('app_settings', {
  key: varchar('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: varchar('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Every mutating admin action. */
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id'),
    adminEmail: varchar('admin_email'),
    action: varchar('action').notNull(),
    targetUserId: uuid('target_user_id'),
    targetLabel: varchar('target_label'),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('admin_audit_log_created_idx').on(t.createdAt)],
);

export const emailCampaigns = pgTable('email_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  subject: varchar('subject').notNull(),
  /** Plain text / light markdown-ish paragraphs separated by blank lines; the sender wraps it in the brand template. */
  body: text('body').notNull(),
  ctaLabel: varchar('cta_label'),
  ctaUrl: varchar('cta_url'),
  /** { states?: ('trial'|'subscribed'|'blocked'|'lifetime')[], signedUpAfter?, signedUpBefore?, hasImported?: boolean, inactiveDays?: number } */
  segment: jsonb('segment').notNull().default({}),
  /** 'draft' | 'scheduled' | 'sending' | 'sent' */
  status: varchar('status').notNull().default('draft'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const emailCampaignSends = pgTable(
  'email_campaign_sends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id').notNull().references(() => emailCampaigns.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    email: varchar('email').notNull(),
    /** 'sent' | 'failed' */
    status: varchar('status').notNull(),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('email_campaign_sends_unique_idx').on(t.campaignId, t.userId)],
);
