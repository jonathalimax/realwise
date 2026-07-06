import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { leads, purchases, coupons, importIssues, testimonials, pricingConfig } from '../db/schema';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
  ) {}

  private mapCoupon(row: typeof coupons.$inferSelect) {
    return {
      ...row,
      currentUses: row.useCount,
      enabled: row.enabled,
      validFrom: null,
      validUntil: row.expiresAt,
    };
  }

  private mapImportIssue(row: typeof importIssues.$inferSelect) {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    return {
      ...row,
      fileName: typeof metadata.fileName === 'string' ? metadata.fileName : null,
      fileMime: typeof metadata.fileMime === 'string' ? metadata.fileMime : null,
      fileBase64: typeof metadata.fileBase64 === 'string' ? metadata.fileBase64 : null,
      bankType: typeof metadata.bankType === 'string' ? metadata.bankType : null,
      parserUsed: typeof metadata.parserUsed === 'string' ? metadata.parserUsed : null,
      detectedHeaders: Array.isArray(metadata.detectedHeaders) ? metadata.detectedHeaders : [],
      errorMessage: typeof metadata.errorMessage === 'string' ? metadata.errorMessage : null,
      userNote: typeof metadata.userNote === 'string' ? metadata.userNote : null,
      userName: typeof metadata.userName === 'string' ? metadata.userName : null,
      userEmail: typeof metadata.userEmail === 'string' ? metadata.userEmail : null,
      internalNotes: Array.isArray(metadata.internalNotes) ? metadata.internalNotes : [],
      resolvedAt: typeof metadata.resolvedAt === 'string' ? metadata.resolvedAt : null,
      reportedAt: typeof metadata.reportedAt === 'string' ? metadata.reportedAt : null,
      metadata,
    };
  }

  private mapTestimonial(row: typeof testimonials.$inferSelect) {
    return row;
  }

  private mapPricingConfig(row: typeof pricingConfig.$inferSelect | undefined) {
    if (!row) {
      return {
        configKey: 'landing-pricing',
        basePriceCents: 23880,
        compareAtPriceCents: 47988,
        installments: 12,
        stripeWalletEnabled: true,
        mercadopagoEnabled: true,
      };
    }
    return row;
  }

  listLeads(): Promise<(typeof leads.$inferSelect)[]> {
    return this.db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  updateLead(id: string, dto: UpdateLeadDto): Promise<(typeof leads.$inferSelect)[]> {
    return this.db
      .update(leads)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
  }

  listPurchases(): Promise<(typeof purchases.$inferSelect)[]> {
    return this.db.select().from(purchases).orderBy(desc(purchases.createdAt));
  }

  async listCoupons() {
    const rows = await this.db.select().from(coupons).orderBy(desc(coupons.createdAt));
    return rows.map((row) => this.mapCoupon(row));
  }

  async createCoupon(dto: CreateCouponDto) {
    const insert: typeof coupons.$inferInsert = {
      ...dto,
      discountValue: dto.discountValue !== undefined ? String(dto.discountValue) : undefined,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      enabled: dto.enabled ?? true,
    };
    const rows = await this.db.insert(coupons).values(insert).returning();
    return this.mapCoupon(rows[0]);
  }

  async updateCoupon(id: string, dto: Partial<CreateCouponDto>) {
    const rows = await this.db
      .update(coupons)
      .set({
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.discountType !== undefined ? { discountType: dto.discountType } : {}),
        ...(dto.discountValue !== undefined ? { discountValue: String(dto.discountValue) } : {}),
        ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, id))
      .returning();
    return this.mapCoupon(rows[0]);
  }

  async deleteCoupon(id: string): Promise<void> {
    await this.db.delete(coupons).where(eq(coupons.id, id));
  }

  async listTestimonials() {
    const rows = await this.db
      .select()
      .from(testimonials)
      .where(eq(testimonials.active, true))
      .orderBy(desc(testimonials.createdAt));
    return rows.map((row) => this.mapTestimonial(row));
  }

  async createTestimonial(dto: {
    name: string;
    role?: string;
    text: string;
    avatar?: string;
    rating?: number;
  }) {
    const rows = await this.db.insert(testimonials).values({
      name: dto.name,
      role: dto.role ?? null,
      text: dto.text,
      avatar: dto.avatar ?? '👤',
      rating: dto.rating ?? 5,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return this.mapTestimonial(rows[0]);
  }

  async deleteTestimonial(id: string): Promise<void> {
    await this.db.delete(testimonials).where(eq(testimonials.id, id));
  }

  async sendAdminEmail(dto: { to: string; template: 'welcome' | 'access_granted' | 'accept_migration'; fields?: Record<string, unknown> }) {
    await this.notifications.sendAdminEmail(dto.to, dto.template, dto.fields ?? {});
    return { success: true };
  }

  async sendAbandonedCheckoutEmail(dto: { email: string; stage: 1 | 2 | 3; name?: string }) {
    const displayName = dto.name?.trim() || dto.email.split('@')[0];
    if (dto.stage === 1) {
      await this.notifications.sendAbandonedCheckoutEmail(dto.email, displayName, 1);
      return { success: true, email: dto.email, stage: 1 };
    }

    const discountPercent = dto.stage === 2 ? 10 : 5;
    const code = `${dto.email.split('@')[0].replace(/[^a-z0-9]/gi, '')}${discountPercent}`.toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.db.insert(coupons).values({
      code,
      discountType: 'percentage',
      discountValue: String(discountPercent),
      maxUses: 1,
      useCount: 0,
      enabled: true,
      expiresAt,
    });
    await this.notifications.sendAbandonedCheckoutEmail(dto.email, displayName, dto.stage, code, discountPercent, expiresAt);
    return { success: true, email: dto.email, stage: dto.stage, code };
  }

  async getPricingConfig() {
    const rows = await this.db.select().from(pricingConfig).where(eq(pricingConfig.configKey, 'landing-pricing'));
    return this.mapPricingConfig(rows[0]);
  }

  async updatePricingConfig(dto: {
    basePriceCents?: number;
    compareAtPriceCents?: number;
    installments?: number;
    stripeWalletEnabled?: boolean;
    mercadopagoEnabled?: boolean;
  }) {
    const rows = await this.db
      .insert(pricingConfig)
      .values({
        configKey: 'landing-pricing',
        basePriceCents: dto.basePriceCents ?? 23880,
        compareAtPriceCents: dto.compareAtPriceCents ?? 47988,
        installments: dto.installments ?? 12,
        stripeWalletEnabled: dto.stripeWalletEnabled ?? true,
        mercadopagoEnabled: dto.mercadopagoEnabled ?? true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pricingConfig.configKey,
        set: {
          ...(dto.basePriceCents !== undefined ? { basePriceCents: dto.basePriceCents } : {}),
          ...(dto.compareAtPriceCents !== undefined ? { compareAtPriceCents: dto.compareAtPriceCents } : {}),
          ...(dto.installments !== undefined ? { installments: dto.installments } : {}),
          ...(dto.stripeWalletEnabled !== undefined ? { stripeWalletEnabled: dto.stripeWalletEnabled } : {}),
          ...(dto.mercadopagoEnabled !== undefined ? { mercadopagoEnabled: dto.mercadopagoEnabled } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    return this.mapPricingConfig(rows[0]);
  }

  async listImportIssues() {
    const rows = await this.db.select().from(importIssues).orderBy(desc(importIssues.createdAt));
    return rows.map((row) => this.mapImportIssue(row));
  }

  async getImportIssue(id: string) {
    const rows = await this.db.select().from(importIssues).where(eq(importIssues.id, id));
    if (rows.length === 0) throw new NotFoundException();
    return this.mapImportIssue(rows[0]);
  }

  async updateImportIssue(id: string, dto: { status?: string; note?: string }) {
    const existing = await this.getImportIssue(id);
    const metadata = { ...(existing.metadata ?? {}) } as Record<string, unknown>;
    const nextNotes = Array.isArray(existing.internalNotes) ? [...existing.internalNotes] : [];

    if (dto.note?.trim()) {
      nextNotes.push({
        ts: new Date().toISOString(),
        text: dto.note.trim(),
      });
      metadata.internalNotes = nextNotes;
    }

    if (dto.status) {
      metadata.resolvedAt = dto.status === 'resolved' ? new Date().toISOString() : null;
    }

    const rows = await this.db
      .update(importIssues)
      .set({
        status: dto.status ?? existing.status,
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(importIssues.id, id))
      .returning();

    return this.mapImportIssue(rows[0]);
  }
}
