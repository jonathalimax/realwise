import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { accounts } from '../db/schema';
import { CreateAccountDto, UpdateAccountDto } from './dto/create-account.dto';

type Account = typeof accounts.$inferSelect;

@Injectable()
export class AccountsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  findAll(clientId: string, userId: string): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.clientId, clientId), eq(accounts.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Account> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.clientId, clientId), eq(accounts.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateAccountDto, clientId: string, userId: string): Promise<Account> {
    const rows = await this.db
      .insert(accounts)
      .values({ ...dto, clientId, userId })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateAccountDto, clientId: string, userId: string): Promise<Account> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(accounts)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.clientId, clientId), eq(accounts.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.clientId, clientId), eq(accounts.userId, userId)));
  }
}
