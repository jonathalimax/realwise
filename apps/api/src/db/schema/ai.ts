import { pgTable, uuid, varchar, integer, bigint, timestamp, jsonb, text, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';

/** One row per LLM request: usage, cost estimate and failures. Drives the per-user monthly budget. */
export const llmCallLog = pgTable(
  'llm_call_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    purpose: varchar('purpose').notNull(),
    provider: varchar('provider').notNull(),
    model: varchar('model').notNull(),
    inputTokens: integer('input_tokens').default(0).notNull(),
    outputTokens: integer('output_tokens').default(0).notNull(),
    latencyMs: integer('latency_ms').default(0).notNull(),
    costMicroCents: bigint('cost_micro_cents', { mode: 'number' }).default(0).notNull(),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ byUserMonth: index('llm_call_log_user_created_idx').on(t.userId, t.createdAt) }),
);

/** The user's single running conversation with the assistant. `content` is what the user sees. */
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    role: varchar('role').notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    // Display metadata: attached file names and a summary of what was saved (drives the "undo" card).
    attachments: jsonb('attachments'),
    saved: jsonb('saved'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ byUser: index('chat_messages_user_created_idx').on(t.userId, t.createdAt) }),
);

/** Insight cards for the home screen, generated at most once per user+month (unless refreshed). */
export const aiInsights = pgTable(
  'ai_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    month: varchar('month').notNull(), // YYYY-MM
    items: jsonb('items').notNull(),
    // Snapshot of the totals the insights were built from; a change invalidates the cache.
    sourceHash: varchar('source_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ uniqUserMonth: uniqueIndex('ai_insights_user_month_uq').on(t.userId, t.month) }),
);

/**
 * Uploaded documents kept only until the assistant has saved them (so a follow-up answer like
 * "it's my Nubank card" still has the statement in context). Purged on save and after 24h.
 */
export const chatFiles = pgTable(
  'chat_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    name: varchar('name').notNull(),
    mime: varchar('mime').notNull(),
    kind: varchar('kind').notNull(), // 'pdf' | 'image' | 'text'
    data: text('data').notNull(), // base64 for pdf/image, extracted text for text
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ byUser: index('chat_files_user_created_idx').on(t.userId, t.createdAt) }),
);
