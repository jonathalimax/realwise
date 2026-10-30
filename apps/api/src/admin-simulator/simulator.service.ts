import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AccountDeletionService } from '../account/account-deletion.service';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { users } from '../db/schema';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Addresses ending in `.invalid` can never be delivered: NotificationsService drops them before calling the mail provider. */
export const SANDBOX_EMAIL_SUFFIX = '.invalid';

export interface SandboxScope {
  userId: string;
  clientId: string;
}

/**
 * A private, throwaway user per admin so the simulator can run the real chat (real prompt, real tools, real model)
 * without ever touching a customer's data. "Reset" erases it completely and starts over.
 */
@Injectable()
export class SimulatorService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly deletion: AccountDeletionService,
  ) {}

  private emailFor(adminId: string) {
    return `simulador+${adminId.slice(0, 8)}@realwise${SANDBOX_EMAIL_SUFFIX}`;
  }

  async sandbox(adminId: string): Promise<SandboxScope> {
    const email = this.emailFor(adminId);
    const find = async () => (await this.db.select().from(users).where(eq(users.email, email)))[0];
    let user = await find();
    if (!user) {
      const now = new Date();
      await this.db
        .insert(users)
        .values({
          clientId: `sim${adminId.slice(0, 8)}`,
          email,
          name: 'Simulador',
          premiumStatus: 'trialing',
          premiumAccessStartedAt: now,
          premiumAccessEndsAt: new Date(now.getTime() + YEAR_MS),
          reminderEmailsOptOut: true,
          marketingEmailsOptOut: true,
          // Room to experiment: the simulator should never be stopped by the customer budget.
          llmBudgetOverrideUsd: '20',
        })
        .onConflictDoNothing();
      user = await find();
    }
    return { userId: user.id, clientId: user.clientId };
  }

  /** Erases the sandbox user and everything it created, then makes a fresh one. */
  async reset(adminId: string): Promise<SandboxScope> {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, this.emailFor(adminId)));
    if (existing) await this.deletion.deleteUser(existing.id);
    return this.sandbox(adminId);
  }
}
