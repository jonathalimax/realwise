import { BadGatewayException, BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { supportMessages } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminActorService } from './admin-actor.service';
import { pageParams } from './pagination';

const STATUSES = ['open', 'answered', 'closed'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('admin/support')
@UseGuards(AdminGuard)
export class AdminSupportController {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
    private readonly actor: AdminActorService,
  ) {}

  @Get()
  async list(@Query('status') status?: string, @Query('q') q?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const p = pageParams(page, pageSize);
    const term = q?.trim() ? `%${q.trim().replace(/[%_\\]/g, '\\$&')}%` : undefined;
    const where = and(
      status && STATUSES.includes(status) ? eq(supportMessages.status, status) : undefined,
      term
        ? or(
            ilike(supportMessages.email, term),
            ilike(supportMessages.name, term),
            ilike(supportMessages.subject, term),
            ilike(supportMessages.message, term),
          )
        : undefined,
    );
    const [items, [total]] = await Promise.all([
      this.db.select().from(supportMessages).where(where).orderBy(desc(supportMessages.createdAt)).limit(p.pageSize).offset(p.offset),
      this.db.select({ n: count() }).from(supportMessages).where(where),
    ]);
    return { items, total: total?.n ?? 0, page: p.page, pageSize: p.pageSize };
  }

  /** Open-message count for the sidebar badge. */
  @Get('stats')
  async stats() {
    const [row] = await this.db.select({ n: count() }).from(supportMessages).where(eq(supportMessages.status, 'open'));
    return { open: row?.n ?? 0 };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.find(id);
  }

  @Post(':id/reply')
  @HttpCode(200)
  async reply(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { message?: string }) {
    const msg = await this.find(id);
    const reply = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!reply) throw new BadRequestException('A resposta não pode ficar vazia.');
    if (reply.length > 10000) throw new BadRequestException('Resposta muito longa.');

    try {
      await this.notifications.sendSupportReply(msg.email, { name: msg.name, subject: msg.subject, reply, original: msg.message });
    } catch (e) {
      throw new BadGatewayException(`Não foi possível enviar o e-mail: ${(e as Error).message}`);
    }
    // A follow-up reply is appended so the thread keeps its history.
    const stamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const adminReply = msg.adminReply ? `${msg.adminReply}\n\n--- ${stamp} ---\n${reply}` : reply;
    const [row] = await this.db
      .update(supportMessages)
      .set({ adminReply, repliedAt: new Date(), status: 'answered', updatedAt: new Date() })
      .where(eq(supportMessages.id, id))
      .returning();
    await this.actor.record(admin, {
      action: 'support.reply',
      targetUserId: msg.userId,
      targetLabel: msg.email,
      details: { messageId: id },
    });
    return row;
  }

  @Patch(':id')
  async update(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { status?: string }) {
    const msg = await this.find(id);
    if (!body?.status || !STATUSES.includes(body.status)) throw new BadRequestException('status deve ser open, answered ou closed.');
    const [row] = await this.db
      .update(supportMessages)
      .set({ status: body.status, updatedAt: sql`now()` })
      .where(eq(supportMessages.id, id))
      .returning();
    await this.actor.record(admin, {
      action: 'support.status',
      targetUserId: msg.userId,
      targetLabel: msg.email,
      details: { messageId: id, from: msg.status, to: body.status },
    });
    return row;
  }

  private async find(id: string) {
    if (!UUID_RE.test(id)) throw new NotFoundException('Mensagem não encontrada');
    const [row] = await this.db.select().from(supportMessages).where(eq(supportMessages.id, id)).limit(1);
    if (!row) throw new NotFoundException('Mensagem não encontrada');
    return row;
  }
}
