import { BadGatewayException, BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { supportMessages, users } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminActorService } from './admin-actor.service';
import { pageParams } from './pagination';

const STATUSES = ['open', 'answered', 'closed'];
/** Where a ticket created by an admin came from (the person wrote to us outside the app). */
const CHANNELS = ['email', 'whatsapp', 'phone', 'other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

  /**
   * Opens a ticket on someone's behalf: they wrote by e-mail, WhatsApp or phone and the admin logs it here, attached to
   * their account when there is one. Replies still go out by e-mail.
   */
  @Post()
  async create(
    @CurrentUser() admin: JwtPayload,
    @Body() body: { userId?: string; email?: string; name?: string; subject?: string; message?: string; channel?: string },
  ) {
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (message.length < 2) throw new BadRequestException('Escreva a mensagem da pessoa.');
    if (message.length > 10000) throw new BadRequestException('Mensagem muito longa.');
    const channel = body?.channel && CHANNELS.includes(body.channel) ? body.channel : 'other';
    const subject = typeof body?.subject === 'string' && body.subject.trim() ? body.subject.trim().slice(0, 200) : null;

    let userId: string | null = null;
    let email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    let name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : null;
    if (body?.userId) {
      if (!UUID_RE.test(body.userId)) throw new BadRequestException('Usuário inválido.');
      const [u] = await this.db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, body.userId)).limit(1);
      if (!u) throw new NotFoundException('Usuário não encontrado');
      userId = u.id;
      email = u.email;
      name = u.name ?? name;
    } else if (email) {
      // Typed only an e-mail: attach it to the account when one exists.
      const [u] = await this.db.select({ id: users.id, name: users.name }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
      if (u) {
        userId = u.id;
        name = u.name ?? name;
      }
    }
    if (!EMAIL_RE.test(email)) throw new BadRequestException('Informe um e-mail válido ou escolha um usuário.');

    const [row] = await this.db.insert(supportMessages).values({ userId, name, email, subject, message, source: channel }).returning();
    await this.actor.record(admin, {
      action: 'support.create',
      targetUserId: userId,
      targetLabel: email,
      details: { messageId: row.id, channel },
    });
    return row;
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
