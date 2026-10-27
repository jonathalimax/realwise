import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, lte, inArray, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { bills, users, billReminders } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';

interface BillRow {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  status: string;
  userId: string;
  clientId: string;
}

interface BillEntry {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  daysOverdue?: number;
}

@Injectable()
export class BillRemindersService {
  private readonly logger = new Logger(BillRemindersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
  ) {}

  groupBillsForUser(pendingBills: BillRow[]): {
    overdue: BillEntry[];
    dueToday: BillEntry[];
    dueSoon: BillEntry[];
  } {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().slice(0, 10);

    const overdue: BillEntry[] = [];
    const dueToday: BillEntry[] = [];
    const dueSoon: BillEntry[] = [];

    for (const bill of pendingBills) {
      const dueStr = bill.dueDate.slice(0, 10);
      if (dueStr < todayStr) {
        const daysOverdue = Math.floor((now.getTime() - new Date(dueStr).getTime()) / 86_400_000);
        overdue.push({ id: bill.id, name: bill.name, amount: bill.amount, dueDate: dueStr, daysOverdue });
      } else if (dueStr === todayStr) {
        dueToday.push({ id: bill.id, name: bill.name, amount: bill.amount, dueDate: dueStr });
      } else if (dueStr <= in3DaysStr) {
        dueSoon.push({ id: bill.id, name: bill.name, amount: bill.amount, dueDate: dueStr });
      }
    }
    return { overdue, dueToday, dueSoon };
  }

  async runForAllUsers(): Promise<void> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const pendingBills: BillRow[] = await this.db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.status, 'pending'),
          isNull(bills.deletedAt),
          gte(bills.dueDate, thirtyDaysAgo.toISOString().slice(0, 10)),
          lte(bills.dueDate, in3Days.toISOString().slice(0, 10)),
        ),
      );

    if (pendingBills.length === 0) {
      this.logger.log('[BillReminders] No pending bills in reminder window');
      return;
    }

    const userIds = [...new Set(pendingBills.map((b) => b.userId))];
    const userRows: { id: string; email: string; clientId: string }[] = await this.db
      .select({ id: users.id, email: users.email, clientId: users.clientId })
      .from(users)
      .where(inArray(users.id, userIds));

    for (const user of userRows) {
      const userBills = pendingBills.filter((b) => b.userId === user.id);
      const groups = this.groupBillsForUser(userBills);
      const totalActionable = groups.overdue.length + groups.dueToday.length + groups.dueSoon.length;
      if (totalActionable === 0) continue;

      try {
        // One big call to action: opens the chat, where Elio walks the user through settling the bills.
        const frontendBase = (process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br').replace(/\/$/, '');
        await this.notifications.sendBillReminderEmail(user.email, groups, `${frontendBase}/${user.clientId}/chat?intent=bills`);
        const billIds = [...groups.overdue, ...groups.dueToday, ...groups.dueSoon].map((b) => b.id);
        await this.db.insert(billReminders).values(
          billIds.map((billId) => ({
            clientId: user.clientId,
            userId: user.id,
            billId,
            remindAt: now,
            sent: true,
            sentVia: 'email',
          })),
        );
        this.logger.log(`[BillReminders] Sent to ${user.email}: ${totalActionable} bill(s)`);
      } catch (err) {
        this.logger.error(`[BillReminders] Failed for ${user.email}: ${(err as Error).message}`);
      }
    }
  }
}
