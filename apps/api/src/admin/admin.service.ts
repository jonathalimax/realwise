import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { leads, purchases, coupons, importIssues } from '../db/schema';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';

@Injectable()
export class AdminService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

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

  listCoupons(): Promise<(typeof coupons.$inferSelect)[]> {
    return this.db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async createCoupon(dto: CreateCouponDto): Promise<typeof coupons.$inferSelect> {
    const insert: typeof coupons.$inferInsert = {
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    };
    const rows = await this.db.insert(coupons).values(insert).returning();
    return rows[0];
  }

  async deleteCoupon(id: string): Promise<void> {
    await this.db.delete(coupons).where(eq(coupons.id, id));
  }

  listImportIssues(): Promise<(typeof importIssues.$inferSelect)[]> {
    return this.db.select().from(importIssues).orderBy(desc(importIssues.createdAt));
  }

  async resolveImportIssue(id: string): Promise<void> {
    await this.db
      .update(importIssues)
      .set({ status: 'resolved', updatedAt: new Date() })
      .where(eq(importIssues.id, id));
  }
}
