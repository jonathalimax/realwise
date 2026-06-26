import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { leads, purchases, coupons, importIssues } from '../db/schema';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';

@Injectable()
export class AdminService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

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
    const rows = await this.db.insert(coupons).values(dto).returning();
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
