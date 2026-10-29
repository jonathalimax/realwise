import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { leads, purchases, testimonials } from '../db/schema';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
  ) {}

  private mapTestimonial(row: typeof testimonials.$inferSelect) {
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

    // Stages 2 and 3 relied on single-use discount coupons, which no longer exist (Stripe promotion codes now).
    throw new BadRequestException('Only abandoned-checkout stage 1 is supported.');
  }
}
