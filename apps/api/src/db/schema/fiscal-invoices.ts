import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * One row per paid Stripe invoice that needs a nota fiscal de serviço (NFS-e).
 * Deliberately no foreign key to `users`: fiscal records must outlive an account deletion (legal retention).
 * Status: review | queued | processing | issued | error | canceled | skipped.
 */
export const fiscalInvoices = pgTable(
  'fiscal_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id'),
    stripeInvoiceId: varchar('stripe_invoice_id').notNull(),
    stripeCustomerId: varchar('stripe_customer_id'),
    stripePaymentIntentId: varchar('stripe_payment_intent_id'),
    stripeInvoiceNumber: varchar('stripe_invoice_number'),
    hostedInvoiceUrl: varchar('hosted_invoice_url'),
    customerName: varchar('customer_name'),
    customerEmail: varchar('customer_email'),
    /** Digits only: 11 (CPF) or 14 (CNPJ). Null = customer not identified on the nota. */
    customerDoc: varchar('customer_doc'),
    /** { cep, street, number, complement, neighborhood, cityIbge, uf } (all optional). */
    customerAddress: jsonb('customer_address'),
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency').notNull().default('brl'),
    planLabel: varchar('plan_label'),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    status: varchar('status').notNull().default('review'),
    skipReason: varchar('skip_reason'),
    /** 'homologacao' | 'producao': the emitter environment the last attempt used. */
    environment: varchar('environment'),
    provider: varchar('provider').notNull().default('focusnfe'),
    providerRef: varchar('provider_ref'),
    nfseNumber: varchar('nfse_number'),
    verificationCode: varchar('verification_code'),
    nfseUrl: varchar('nfse_url'),
    pdfUrl: varchar('pdf_url'),
    xmlPath: varchar('xml_path'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    attempts: integer('attempts').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    refundedCents: integer('refunded_cents').notNull().default(0),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('fiscal_invoices_stripe_invoice_idx').on(t.stripeInvoiceId),
    uniqueIndex('fiscal_invoices_provider_ref_idx').on(t.providerRef),
    index('fiscal_invoices_status_idx').on(t.status, t.createdAt),
    index('fiscal_invoices_user_idx').on(t.userId),
    index('fiscal_invoices_payment_intent_idx').on(t.stripePaymentIntentId),
  ],
);
