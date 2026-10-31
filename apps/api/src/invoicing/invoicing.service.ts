import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import Stripe from 'stripe';
import { StripeClient } from '../billing/stripe-client';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { fiscalInvoices, users } from '../db/schema';
import { digits, validDoc } from './br-documents';
import { FocusNfeProvider, TransientProviderError } from './focusnfe.provider';
import { InvoicingSettingsService } from './invoicing-settings.service';
import { CustomerAddress, EmitRequest, InvoiceStatus, ProviderResult } from './invoicing.types';
import { buildNfsePayload, competenciaLabel, missingConfig, renderDescription } from './nfse-payload';

type Row = typeof fiscalInvoices.$inferSelect;

const MAX_ATTEMPTS = 6;
const PLAN_LABELS: Record<string, string> = { monthly: 'mensal', annual: 'anual' };
/** Statuses an admin (or the queue) may send to the emitter. */
const ISSUABLE: InvoiceStatus[] = ['review', 'queued', 'error', 'skipped'];

const idOf = (v: string | { id: string } | null | undefined): string | null => (!v ? null : typeof v === 'string' ? v : v.id);
const backoffMs = (attempt: number) => Math.min(60, 2 ** attempt) * 60_000;

@Injectable()
export class InvoicingService {
  private readonly logger = new Logger(InvoicingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly stripe: StripeClient,
    private readonly settings: InvoicingSettingsService,
  ) {}

  // ---------------------------------------------------------------- intake (Stripe → fiscal_invoices)

  /**
   * Registers a paid Stripe invoice exactly once (unique on the Stripe invoice id) and decides what happens next:
   * skipped, queued for automatic issue, or waiting in "review" for the admin. Never throws into the webhook.
   */
  async recordPaidInvoice(invoice: Stripe.Invoice): Promise<Row | null> {
    try {
      return await this.record(invoice);
    } catch (e) {
      this.logger.error(`could not register invoice ${invoice.id} for nota fiscal: ${(e as Error).message}`);
      return null;
    }
  }

  private async record(invoice: Stripe.Invoice): Promise<Row | null> {
    const s = await this.settings.get();
    const customerId = idOf(invoice.customer);
    const [user] = customerId ? await this.db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1) : [];
    const taxId = (invoice.customer_tax_ids ?? []).find((t) => t.type === 'br_cpf' || t.type === 'br_cnpj');
    const paidAtSec = invoice.status_transitions?.paid_at ?? invoice.created;
    const paidAt = new Date(paidAtSec * 1000);

    let status: InvoiceStatus = 'review';
    let skipReason: string | null = null;
    if (invoice.amount_paid <= 0) {
      status = 'skipped';
      skipReason = 'Fatura sem valor pago (teste grátis ou cupom de 100%).';
    } else if ((invoice.currency ?? 'brl').toLowerCase() !== 'brl') {
      status = 'skipped';
      skipReason = 'Moeda diferente de BRL.';
    } else if (s.startFrom && paidAt < new Date(`${s.startFrom}T00:00:00-03:00`)) {
      status = 'skipped';
      skipReason = 'Pagamento anterior à data de início das notas.';
    } else if (s.enabled && s.autoIssue && s.environment === 'producao') {
      status = 'queued';
    }

    let paymentIntentId: string | null = null;
    try {
      const payments = await this.stripe.get().invoicePayments.list({ invoice: invoice.id!, limit: 1 });
      paymentIntentId = idOf(payments.data[0]?.payment?.payment_intent as string | { id: string } | undefined);
    } catch {
      /* only needed to match refunds later */
    }

    const [created] = await this.db
      .insert(fiscalInvoices)
      .values({
        userId: user?.id ?? null,
        stripeInvoiceId: invoice.id!,
        stripeCustomerId: customerId,
        stripePaymentIntentId: paymentIntentId,
        stripeInvoiceNumber: invoice.number ?? null,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        customerName: invoice.customer_name ?? user?.name ?? null,
        customerEmail: invoice.customer_email ?? user?.email ?? null,
        customerDoc: taxId ? validDoc(taxId.value) : null,
        amountCents: invoice.amount_paid,
        currency: (invoice.currency ?? 'brl').toLowerCase(),
        planLabel: user?.subscriptionPlan ? (PLAN_LABELS[user.subscriptionPlan] ?? user.subscriptionPlan) : null,
        paidAt,
        status,
        skipReason,
      })
      .onConflictDoNothing({ target: fiscalInvoices.stripeInvoiceId })
      .returning();
    return created ?? null;
  }

  /** A Stripe refund does not cancel the nota by itself (the Prefeitura has its own rules): it flags it for the admin. */
  async onChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const pi = idOf(charge.payment_intent as string | { id: string } | null);
    if (!pi) return;
    await this.db
      .update(fiscalInvoices)
      .set({ refundedCents: charge.amount_refunded, refundedAt: new Date(), updatedAt: new Date() })
      .where(eq(fiscalInvoices.stripePaymentIntentId, pi));
  }

  /** Imports every paid Stripe invoice since `startFrom` that we do not know yet (initial load / missed webhooks). */
  async backfillFromStripe(): Promise<{ scanned: number; created: number }> {
    const s = await this.settings.get();
    if (!s.startFrom) throw new BadRequestException('Defina a "Emitir notas a partir de" antes de importar.');
    const since = Math.floor(new Date(`${s.startFrom}T00:00:00-03:00`).getTime() / 1000);
    let scanned = 0;
    let created = 0;
    for await (const invoice of this.stripe.get().invoices.list({ status: 'paid', created: { gte: since }, limit: 100 })) {
      scanned += 1;
      if (await this.recordPaidInvoice(invoice)) created += 1;
    }
    return { scanned, created };
  }

  // ---------------------------------------------------------------- emission

  private async get(id: string): Promise<Row> {
    const [row] = await this.db.select().from(fiscalInvoices).where(eq(fiscalInvoices.id, id)).limit(1);
    if (!row) throw new NotFoundException('Nota não encontrada.');
    return row;
  }

  /**
   * Sends one nota to the emitter. The row is claimed atomically (status → processing) so the scheduler and an admin
   * click can never emit the same nota twice; the deterministic `ref` backs that up on the emitter side.
   */
  async issue(id: string): Promise<Row> {
    const s = await this.settings.get();
    const provider = await this.settings.provider(s);
    const missing = missingConfig(s, Boolean(provider));
    if (!provider || missing.length > 0) throw new BadRequestException(`Configuração incompleta: ${missing.join(', ')}.`);

    const ref = `rw-${s.environment === 'producao' ? 'p' : 'h'}-${id}`;
    const reissueTest = and(eq(fiscalInvoices.status, 'issued'), eq(fiscalInvoices.environment, 'homologacao'));
    const [claimed] = await this.db
      .update(fiscalInvoices)
      .set({
        status: 'processing',
        providerRef: ref,
        environment: s.environment,
        attempts: sql`${fiscalInvoices.attempts} + 1`,
        lastAttemptAt: new Date(),
        nextAttemptAt: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fiscalInvoices.id, id),
          or(inArray(fiscalInvoices.status, ISSUABLE), s.environment === 'producao' ? reissueTest : sql`false`),
        ),
      )
      .returning();
    if (!claimed) throw new BadRequestException('Esta nota não pode ser emitida no estado atual.');

    const request: EmitRequest = {
      ref,
      amountCents: claimed.amountCents,
      issuedAt: new Date(),
      description: renderDescription(s.description, {
        plano: claimed.planLabel ?? 'assinatura',
        competencia: competenciaLabel(claimed.paidAt),
        fatura: claimed.stripeInvoiceNumber ?? claimed.stripeInvoiceId,
      }),
      customer: {
        name: claimed.customerName,
        email: claimed.customerEmail,
        doc: claimed.customerDoc,
        address: (claimed.customerAddress as CustomerAddress | null) ?? null,
      },
    };

    try {
      const result = await provider.emit(ref, buildNfsePayload(request, s, s.environment));
      return await this.apply(claimed, result);
    } catch (e) {
      if (e instanceof TransientProviderError) return this.retryLater(claimed, e.message);
      return this.fail(claimed, (e as Error).message);
    }
  }

  private async apply(row: Row, r: ProviderResult): Promise<Row> {
    const patch: Partial<Row> = { updatedAt: new Date() };
    if (r.state === 'processing') patch.status = 'processing';
    else if (r.state === 'issued') {
      Object.assign(patch, {
        status: 'issued',
        nfseNumber: r.number ?? null,
        verificationCode: r.verificationCode ?? null,
        nfseUrl: r.url ?? null,
        pdfUrl: r.pdfUrl ?? null,
        xmlPath: r.xmlPath ?? null,
        issuedAt: r.issuedAt ?? new Date(),
        errorMessage: null,
      });
    } else if (r.state === 'canceled') {
      Object.assign(patch, { status: 'canceled', canceledAt: row.canceledAt ?? new Date() });
    } else {
      Object.assign(patch, { status: 'error', errorMessage: r.error ?? 'Erro desconhecido do emissor.' });
    }
    const [next] = await this.db.update(fiscalInvoices).set(patch).where(eq(fiscalInvoices.id, row.id)).returning();
    return next;
  }

  private async fail(row: Row, message: string): Promise<Row> {
    const [next] = await this.db
      .update(fiscalInvoices)
      .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
      .where(eq(fiscalInvoices.id, row.id))
      .returning();
    return next;
  }

  /** Emitter unreachable: back to the queue with exponential backoff, then give up and ask for a human. */
  private async retryLater(row: Row, message: string): Promise<Row> {
    if (row.attempts >= MAX_ATTEMPTS) return this.fail(row, `${message} (desisti após ${MAX_ATTEMPTS} tentativas)`);
    const [next] = await this.db
      .update(fiscalInvoices)
      .set({ status: 'queued', errorMessage: message, nextAttemptAt: new Date(Date.now() + backoffMs(row.attempts)), updatedAt: new Date() })
      .where(eq(fiscalInvoices.id, row.id))
      .returning();
    return next;
  }

  /** Asks the emitter where a nota stands (the Prefeitura authorizes asynchronously). */
  async refresh(id: string): Promise<Row> {
    const row = await this.get(id);
    if (!row.providerRef) throw new BadRequestException('Esta nota ainda não foi enviada ao emissor.');
    const provider = await this.settings.provider();
    if (!provider) throw new BadRequestException('Token do emissor não configurado.');
    // A nota is checked in the environment it was sent to, which may differ from the current setting.
    const token = await this.settings.token();
    const p = row.environment && row.environment !== provider.environment && token ? new FocusNfeProvider(token, row.environment as 'homologacao' | 'producao') : provider;
    try {
      const result = await p.consult(row.providerRef);
      if (!result) {
        const stale = row.lastAttemptAt && Date.now() - row.lastAttemptAt.getTime() > 10 * 60_000;
        if (row.status === 'processing' && stale) {
          const [next] = await this.db.update(fiscalInvoices).set({ status: 'queued', updatedAt: new Date() }).where(eq(fiscalInvoices.id, id)).returning();
          return next;
        }
        return row;
      }
      return await this.apply(row, result);
    } catch (e) {
      if (e instanceof TransientProviderError) return row;
      throw e;
    }
  }

  async cancel(id: string, reason: string): Promise<Row> {
    const row = await this.get(id);
    const text = reason.trim();
    if (text.length < 15 || text.length > 255) throw new BadRequestException('A justificativa precisa ter de 15 a 255 caracteres.');
    if (row.status !== 'issued') throw new BadRequestException('Só é possível cancelar notas emitidas.');
    if (row.provider === 'manual') {
      // Issued by hand in the Prefeitura portal: it has to be cancelled there too; here we only record it.
      const [next] = await this.db
        .update(fiscalInvoices)
        .set({ status: 'canceled', canceledAt: new Date(), cancelReason: text, updatedAt: new Date() })
        .where(eq(fiscalInvoices.id, id))
        .returning();
      return next;
    }
    if (!row.providerRef) throw new BadRequestException('Esta nota não foi enviada ao emissor.');
    const token = await this.settings.token();
    if (!token) throw new BadRequestException('Token do emissor não configurado.');
    const provider = new FocusNfeProvider(token, (row.environment as 'homologacao' | 'producao') ?? 'producao');
    const result = await provider.cancel(row.providerRef, text);
    if (result.state === 'canceled') {
      const [next] = await this.db
        .update(fiscalInvoices)
        .set({ status: 'canceled', canceledAt: new Date(), cancelReason: text, updatedAt: new Date() })
        .where(eq(fiscalInvoices.id, id))
        .returning();
      return next;
    }
    throw new BadRequestException(result.error ?? 'O emissor recusou o cancelamento.');
  }

  /** Everything the admin needs to type into the Prefeitura portal for this payment. */
  async manualData(id: string) {
    const row = await this.get(id);
    const s = await this.settings.get();
    return {
      customer: { name: row.customerName, email: row.customerEmail, doc: row.customerDoc, address: row.customerAddress },
      amountCents: row.amountCents,
      paidAt: row.paidAt,
      competencia: competenciaLabel(row.paidAt),
      itemListaServico: s.tax.itemListaServico,
      codigoTributarioMunicipio: s.tax.codigoTributarioMunicipio,
      issRetido: s.tax.issRetido,
      description: renderDescription(s.description, {
        plano: row.planLabel ?? 'assinatura',
        competencia: competenciaLabel(row.paidAt),
        fatura: row.stripeInvoiceNumber ?? row.stripeInvoiceId,
      }),
    };
  }

  /** Records a nota the admin issued by hand in the Prefeitura portal (no emitter involved). */
  async markManual(id: string, input: { number: string; verificationCode?: string; issuedAt?: string; url?: string }): Promise<Row> {
    const row = await this.get(id);
    if (!['review', 'queued', 'error', 'skipped'].includes(row.status)) throw new BadRequestException('Esta nota não pode ser registrada agora.');
    const number = String(input.number ?? '').trim();
    if (!/^[A-Za-z0-9./-]{1,20}$/.test(number)) throw new BadRequestException('Informe o número da nota (até 20 caracteres).');
    const code = String(input.verificationCode ?? '').trim().slice(0, 30);
    const url = String(input.url ?? '').trim();
    if (url && !/^https:\/\//i.test(url)) throw new BadRequestException('O link da nota precisa começar com https://');
    const issuedAt = input.issuedAt ? new Date(input.issuedAt) : new Date();
    if (Number.isNaN(issuedAt.getTime()) || issuedAt.getTime() > Date.now() + 24 * 3_600_000) throw new BadRequestException('Data de emissão inválida.');
    const [next] = await this.db
      .update(fiscalInvoices)
      .set({
        status: 'issued',
        provider: 'manual',
        environment: 'producao',
        nfseNumber: number,
        verificationCode: code || null,
        nfseUrl: url || null,
        issuedAt,
        errorMessage: null,
        nextAttemptAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(fiscalInvoices.id, id), inArray(fiscalInvoices.status, ['review', 'queued', 'error', 'skipped'])))
      .returning();
    if (!next) throw new BadRequestException('Esta nota mudou de estado; atualize a página.');
    return next;
  }

  async skip(id: string, reason: string): Promise<Row> {
    const row = await this.get(id);
    if (!['review', 'queued', 'error'].includes(row.status)) throw new BadRequestException('Esta nota não pode ser dispensada agora.');
    const [next] = await this.db
      .update(fiscalInvoices)
      .set({ status: 'skipped', skipReason: reason.trim() || 'Dispensada pelo admin.', updatedAt: new Date() })
      .where(eq(fiscalInvoices.id, id))
      .returning();
    return next;
  }

  /** Puts every "review" nota in the queue (used after turning on automatic issue, in production). */
  async queueAllReview(): Promise<number> {
    const s = await this.settings.get();
    if (s.environment !== 'producao') throw new BadRequestException('A emissão em lote só roda em produção.');
    const rows = await this.db.update(fiscalInvoices).set({ status: 'queued', updatedAt: new Date() }).where(eq(fiscalInvoices.status, 'review')).returning({ id: fiscalInvoices.id });
    return rows.length;
  }

  async updateCustomer(id: string, input: { name?: string; email?: string; doc?: string; address?: CustomerAddress | null }): Promise<Row> {
    const row = await this.get(id);
    if (!['review', 'queued', 'error', 'skipped'].includes(row.status)) throw new BadRequestException('Dados do tomador só podem ser editados antes da emissão.');
    const rawDoc = input.doc === undefined ? undefined : digits(input.doc);
    if (rawDoc && !validDoc(rawDoc)) throw new BadRequestException('CPF/CNPJ inválido.');
    const [next] = await this.db
      .update(fiscalInvoices)
      .set({
        ...(input.name !== undefined ? { customerName: input.name.trim() || null } : {}),
        ...(input.email !== undefined ? { customerEmail: input.email.trim() || null } : {}),
        ...(rawDoc !== undefined ? { customerDoc: rawDoc || null } : {}),
        ...(input.address !== undefined ? { customerAddress: input.address } : {}),
        updatedAt: new Date(),
      })
      .where(eq(fiscalInvoices.id, id))
      .returning();
    return next;
  }

  // ---------------------------------------------------------------- background work

  /** One pass: emit what is queued and due, then follow up on notas the Prefeitura is still processing. */
  async tick(): Promise<{ emitted: number; refreshed: number }> {
    const s = await this.settings.get();
    if (!s.enabled) return { emitted: 0, refreshed: 0 };
    let emitted = 0;
    let refreshed = 0;

    if (s.environment === 'producao' && s.autoIssue) {
      const due = await this.db
        .select({ id: fiscalInvoices.id })
        .from(fiscalInvoices)
        .where(and(eq(fiscalInvoices.status, 'queued'), or(isNull(fiscalInvoices.nextAttemptAt), lte(fiscalInvoices.nextAttemptAt, new Date()))))
        .orderBy(fiscalInvoices.createdAt)
        .limit(100);
      for (const { id } of due) {
        try {
          await this.issue(id);
          emitted += 1;
        } catch (e) {
          this.logger.warn(`queued nota ${id} not emitted: ${(e as Error).message}`);
        }
      }
    }

    const processing = await this.db.select({ id: fiscalInvoices.id }).from(fiscalInvoices).where(eq(fiscalInvoices.status, 'processing')).limit(50);
    for (const { id } of processing) {
      try {
        await this.refresh(id);
        refreshed += 1;
      } catch (e) {
        this.logger.warn(`could not refresh nota ${id}: ${(e as Error).message}`);
      }
    }
    return { emitted, refreshed };
  }

  async hasProcessing(): Promise<boolean> {
    const [row] = await this.db.select({ id: fiscalInvoices.id }).from(fiscalInvoices).where(eq(fiscalInvoices.status, 'processing')).limit(1);
    return Boolean(row);
  }

  // ---------------------------------------------------------------- admin reads

  async list(opts: { status?: string; q?: string; limit: number; offset: number }) {
    const conds = [];
    if (opts.status && opts.status !== 'all') conds.push(eq(fiscalInvoices.status, opts.status));
    if (opts.q) {
      const like = `%${opts.q.replace(/[%_]/g, '')}%`;
      conds.push(or(ilike(fiscalInvoices.customerName, like), ilike(fiscalInvoices.customerEmail, like), ilike(fiscalInvoices.nfseNumber, like), ilike(fiscalInvoices.stripeInvoiceNumber, like)));
    }
    const where = conds.length ? and(...conds) : undefined;
    const rows = await this.db.select().from(fiscalInvoices).where(where).orderBy(desc(fiscalInvoices.paidAt)).limit(opts.limit).offset(opts.offset);
    const [{ total }] = await this.db.select({ total: sql<number>`count(*)::int` }).from(fiscalInvoices).where(where);
    return { rows, total };
  }

  async stats() {
    const byStatus = await this.db
      .select({ status: fiscalInvoices.status, n: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${fiscalInvoices.amountCents}),0)::int` })
      .from(fiscalInvoices)
      .groupBy(fiscalInvoices.status);
    const [refunded] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(fiscalInvoices)
      .where(and(eq(fiscalInvoices.status, 'issued'), sql`${fiscalInvoices.refundedCents} > 0`));
    return {
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, { count: r.n, cents: r.cents }])),
      refundedToReview: refunded.n,
    };
  }

  one(id: string) {
    return this.get(id);
  }

  /** Sends a throwaway R$ 1,00 nota to the homologação environment so the whole setup can be checked end to end. */
  async sendTest() {
    const s = await this.settings.get();
    if (s.environment !== 'homologacao') throw new BadRequestException('A nota de teste só roda em homologação.');
    const provider = await this.settings.provider(s);
    const missing = missingConfig(s, Boolean(provider));
    if (!provider || missing.length > 0) throw new BadRequestException(`Configuração incompleta: ${missing.join(', ')}.`);
    const ref = `rw-teste-${Date.now()}`;
    const payload = buildNfsePayload(
      { ref, amountCents: 100, issuedAt: new Date(), description: 'Nota de teste Realwise (homologação).', customer: { name: 'Cliente de Teste', email: null, doc: null, address: null } },
      s,
      'homologacao',
    );
    const first = await provider.emit(ref, payload);
    let last: ProviderResult | null = first;
    for (let i = 0; i < 6 && last?.state === 'processing'; i += 1) {
      await new Promise((r) => setTimeout(r, 2500));
      last = await provider.consult(ref);
    }
    return { ref, result: last ?? first };
  }
}
