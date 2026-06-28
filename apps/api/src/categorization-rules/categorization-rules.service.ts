import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { categorizationRules } from '../db/schema';
import { CreateCategorizationRuleDto, UpdateCategorizationRuleDto } from './dto/create-categorization-rule.dto';

type CategorizationRule = typeof categorizationRules.$inferSelect;

@Injectable()
export class CategorizationRulesService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  findAll(clientId: string, userId: string): Promise<CategorizationRule[]> {
    return this.db
      .select()
      .from(categorizationRules)
      .where(and(
        eq(categorizationRules.clientId, clientId),
        eq(categorizationRules.userId, userId),
        eq(categorizationRules.isActive, true),
      ))
      .orderBy(desc(categorizationRules.usedCount), desc(categorizationRules.updatedAt));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<CategorizationRule> {
    const rows = await this.db
      .select()
      .from(categorizationRules)
      .where(and(
        eq(categorizationRules.id, id),
        eq(categorizationRules.clientId, clientId),
        eq(categorizationRules.userId, userId),
      ));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async findByKeyword(keyword: string, clientId: string, userId: string): Promise<CategorizationRule | null> {
    const rows = await this.db
      .select()
      .from(categorizationRules)
      .where(and(
        eq(categorizationRules.keyword, keyword),
        eq(categorizationRules.clientId, clientId),
        eq(categorizationRules.userId, userId),
      ));
    return rows[0] ?? null;
  }

  async create(dto: CreateCategorizationRuleDto, clientId: string, userId: string): Promise<CategorizationRule> {
    const rows = await this.db.insert(categorizationRules).values({
      clientId,
      userId,
      keyword: dto.keyword,
      category: dto.category,
      type: dto.type,
      originalDescription: dto.originalDescription,
      isActive: dto.isActive ?? true,
    }).returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateCategorizationRuleDto, clientId: string, userId: string): Promise<CategorizationRule> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(categorizationRules)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(
        eq(categorizationRules.id, id),
        eq(categorizationRules.clientId, clientId),
        eq(categorizationRules.userId, userId),
      ))
      .returning();
    return rows[0];
  }

  async recordUsage(id: string, clientId: string, userId: string): Promise<CategorizationRule> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(categorizationRules)
      .set({
        usedCount: sql`${categorizationRules.usedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(categorizationRules.id, id),
        eq(categorizationRules.clientId, clientId),
        eq(categorizationRules.userId, userId),
      ))
      .returning();
    return rows[0];
  }
}
