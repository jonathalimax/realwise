import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { categories } from '../db/schema';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

type Category = typeof categories.$inferSelect;

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  findAll(clientId: string, userId: string): Promise<Category[]> {
    return this.db
      .select()
      .from(categories)
      .where(and(eq(categories.clientId, clientId), eq(categories.userId, userId), isNull(categories.deletedAt)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Category> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.clientId, clientId), eq(categories.userId, userId), isNull(categories.deletedAt)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateCategoryDto, clientId: string, userId: string): Promise<Category> {
    const rows = await this.db
      .insert(categories)
      .values({ ...dto, clientId, userId })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateCategoryDto, clientId: string, userId: string): Promise<Category> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(categories)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.clientId, clientId), eq(categories.userId, userId), isNull(categories.deletedAt)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.clientId, clientId), eq(categories.userId, userId), isNull(categories.deletedAt)));
  }
}
