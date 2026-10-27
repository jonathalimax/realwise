import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, inArray, lte, sql, SQL } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { computeAccess } from '../billing/access';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { emailCampaignSends, emailCampaigns, imports, users } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { safeHttpUrl } from '../notifications/email-text';
import { marketingUnsubscribeUrl } from './marketing-token';
import { PageParams } from './pagination';

export const SEGMENT_STATES = ['trial', 'subscribed', 'blocked', 'lifetime'] as const;
type SegmentState = (typeof SEGMENT_STATES)[number];

export interface CampaignSegment {
  states?: SegmentState[];
  signedUpAfter?: string;
  signedUpBefore?: string;
  hasImported?: boolean;
  inactiveDays?: number;
}

export interface AudienceUser {
  id: string;
  email: string;
  name: string | null;
}

export type Campaign = typeof emailCampaigns.$inferSelect;

const BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Validates and normalizes a segment coming from the admin UI; throws 400 on anything malformed. */
export function parseSegment(raw: unknown): CampaignSegment {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('segment inválido');
  const s = raw as Record<string, unknown>;
  const out: CampaignSegment = {};
  if (s.states !== undefined && s.states !== null) {
    if (!Array.isArray(s.states) || s.states.some((x) => !SEGMENT_STATES.includes(x as SegmentState))) {
      throw new BadRequestException(`segment.states deve conter apenas: ${SEGMENT_STATES.join(', ')}`);
    }
    if (s.states.length) out.states = [...new Set(s.states as SegmentState[])];
  }
  for (const key of ['signedUpAfter', 'signedUpBefore'] as const) {
    const v = s[key];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string' || Number.isNaN(new Date(v).getTime())) throw new BadRequestException(`segment.${key} deve ser uma data ISO`);
    out[key] = v;
  }
  if (s.hasImported !== undefined && s.hasImported !== null) {
    if (typeof s.hasImported !== 'boolean') throw new BadRequestException('segment.hasImported deve ser booleano');
    out.hasImported = s.hasImported;
  }
  if (s.inactiveDays !== undefined && s.inactiveDays !== null && s.inactiveDays !== '') {
    const n = Number(s.inactiveDays);
    if (!Number.isInteger(n) || n < 0 || n > 3650) throw new BadRequestException('segment.inactiveDays deve ser um inteiro entre 0 e 3650');
    out.inactiveDays = n;
  }
  return out;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  /** Campaigns being sent by this process; the periodic check never double-starts these. */
  private readonly running = new Set<string>();

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- audience -----------------------------------------------------------------------------------------------

  /** Everyone matching the segment. Users who opted out of marketing email are always excluded. */
  async audience(segment: CampaignSegment): Promise<AudienceUser[]> {
    const conds: SQL[] = [eq(users.marketingEmailsOptOut, false)];
    if (segment.signedUpAfter) conds.push(sql`${users.createdAt} >= ${new Date(segment.signedUpAfter).toISOString()}::timestamptz`);
    if (segment.signedUpBefore) conds.push(sql`${users.createdAt} <= ${new Date(segment.signedUpBefore).toISOString()}::timestamptz`);
    if (segment.hasImported !== undefined) {
      const exists = sql`exists (select 1 from ${imports} where ${imports.userId} = ${users.id})`;
      conds.push(segment.hasImported ? exists : sql`not ${exists}`);
    }
    if (segment.inactiveDays !== undefined) {
      const cutoff = new Date(Date.now() - segment.inactiveDays * 86_400_000);
      conds.push(sql`coalesce(${users.lastActiveAt}, ${users.createdAt}) < ${cutoff.toISOString()}::timestamptz`);
    }
    const rows = await this.db.select().from(users).where(and(...conds));
    const now = new Date();
    const wanted = segment.states;
    return rows
      .filter((u) => {
        if (!wanted) return true;
        const state = computeAccess(u, now).state;
        // The owner/admin account counts as "subscribed" for targeting.
        return wanted.includes((state === 'owner' ? 'subscribed' : state) as SegmentState);
      })
      .map((u) => ({ id: u.id, email: u.email, name: u.name }));
  }

  async audiencePreview(rawSegment: unknown): Promise<{ count: number; sample: { email: string; name: string | null }[] }> {
    const list = await this.audience(parseSegment(rawSegment));
    return { count: list.length, sample: list.slice(0, 10).map((u) => ({ email: u.email, name: u.name })) };
  }

  // ---- CRUD ---------------------------------------------------------------------------------------------------

  async list(status: string | undefined, p: PageParams) {
    const where = status ? eq(emailCampaigns.status, status) : undefined;
    const [items, [total]] = await Promise.all([
      this.db.select().from(emailCampaigns).where(where).orderBy(desc(emailCampaigns.createdAt)).limit(p.pageSize).offset(p.offset),
      this.db.select({ n: count() }).from(emailCampaigns).where(where),
    ]);
    return { items, total: total?.n ?? 0, page: p.page, pageSize: p.pageSize };
  }

  async get(id: string): Promise<Campaign> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Campanha não encontrada');
    const [row] = await this.db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id)).limit(1);
    if (!row) throw new NotFoundException('Campanha não encontrada');
    return row;
  }

  /** Validates the editable fields; with `partial` only the provided ones are checked and returned. */
  cleanFields(dto: Record<string, unknown>, partial: boolean): Partial<typeof emailCampaigns.$inferInsert> {
    const out: Partial<typeof emailCampaigns.$inferInsert> = {};
    const required = [['name', 'Nome', 120], ['subject', 'Assunto', 200], ['body', 'Corpo', 20000]] as const;
    for (const [key, label, max] of required) {
      const v = dto[key];
      if (v === undefined && partial) continue;
      if (typeof v !== 'string' || !v.trim()) throw new BadRequestException(`${label} é obrigatório`);
      if (v.length > max) throw new BadRequestException(`${label} muito longo (máx. ${max})`);
      out[key] = key === 'body' ? v : v.trim();
    }
    for (const [key, label] of [['ctaLabel', 'Texto do botão'], ['ctaUrl', 'Link do botão']] as const) {
      const v = dto[key];
      if (v === undefined && partial) continue;
      if (v === undefined || v === null || v === '') {
        out[key] = null;
        continue;
      }
      if (typeof v !== 'string' || v.length > 500) throw new BadRequestException(`${label} inválido`);
      out[key] = v.trim();
    }
    if (out.ctaUrl && !safeHttpUrl(out.ctaUrl)) throw new BadRequestException('Link do botão deve começar com http:// ou https://');
    if (dto.segment !== undefined || !partial) out.segment = parseSegment(dto.segment);
    return out;
  }

  async create(dto: Record<string, unknown>, createdBy: string | null): Promise<Campaign> {
    const fields = this.cleanFields(dto, false) as typeof emailCampaigns.$inferInsert;
    const [row] = await this.db.insert(emailCampaigns).values({ ...fields, createdBy }).returning();
    return row;
  }

  async update(id: string, dto: Record<string, unknown>): Promise<Campaign> {
    const current = await this.get(id);
    if (current.status !== 'draft' && current.status !== 'scheduled') throw new ConflictException('Só é possível editar campanhas em rascunho ou agendadas.');
    const fields = this.cleanFields(dto, true);
    const [row] = await this.db
      .update(emailCampaigns)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(emailCampaigns.id, id), inArray(emailCampaigns.status, ['draft', 'scheduled'])))
      .returning();
    if (!row) throw new ConflictException('A campanha já começou a ser enviada.');
    return row;
  }

  async remove(id: string): Promise<Campaign> {
    const current = await this.get(id);
    const [row] = await this.db
      .delete(emailCampaigns)
      .where(and(eq(emailCampaigns.id, id), inArray(emailCampaigns.status, ['draft', 'scheduled'])))
      .returning();
    if (!row) throw new ConflictException(`Só é possível excluir campanhas em rascunho ou agendadas (esta está "${current.status}").`);
    return row;
  }

  async sends(id: string, status: string | undefined, p: PageParams) {
    await this.get(id);
    const where = and(eq(emailCampaignSends.campaignId, id), status ? eq(emailCampaignSends.status, status) : undefined);
    const [items, [total]] = await Promise.all([
      this.db.select().from(emailCampaignSends).where(where).orderBy(desc(emailCampaignSends.sentAt)).limit(p.pageSize).offset(p.offset),
      this.db.select({ n: count() }).from(emailCampaignSends).where(where),
    ]);
    return { items, total: total?.n ?? 0, page: p.page, pageSize: p.pageSize };
  }

  async sendTest(id: string, to: string): Promise<void> {
    const c = await this.get(id);
    await this.notifications.sendCampaignEmail(to, { ...c, subject: `[Teste] ${c.subject}` }, marketingUnsubscribeUrl('00000000-0000-0000-0000-000000000000'));
  }

  // ---- sending ------------------------------------------------------------------------------------------------

  /** Sends now, or schedules when `scheduledAt` is in the future. Returns the updated campaign. */
  async send(id: string, scheduledAtRaw?: string | null): Promise<Campaign> {
    const c = await this.get(id);
    if (c.status !== 'draft' && c.status !== 'scheduled') throw new ConflictException('Esta campanha já foi enviada ou está em envio.');
    if (!c.subject.trim() || !c.body.trim()) throw new BadRequestException('Assunto e corpo são obrigatórios.');

    if (scheduledAtRaw) {
      const at = new Date(scheduledAtRaw);
      if (Number.isNaN(at.getTime())) throw new BadRequestException('scheduledAt inválido');
      if (at.getTime() > Date.now() + 60_000) {
        const [row] = await this.db
          .update(emailCampaigns)
          .set({ status: 'scheduled', scheduledAt: at, updatedAt: new Date() })
          .where(and(eq(emailCampaigns.id, id), inArray(emailCampaigns.status, ['draft', 'scheduled'])))
          .returning();
        if (!row) throw new ConflictException('A campanha já começou a ser enviada.');
        return row;
      }
    }

    const started = await this.begin(id);
    if (!started) throw new ConflictException('A campanha já começou a ser enviada.');
    void this.process(id);
    return started;
  }

  /** draft/scheduled -> sending, fixing the recipient count. Null when someone else started it first. */
  private async begin(id: string): Promise<Campaign | null> {
    const c = await this.get(id);
    const list = await this.audience(parseSegment(c.segment));
    if (!list.length) throw new BadRequestException('Nenhum destinatário elegível para este segmento.');
    const [row] = await this.db
      .update(emailCampaigns)
      .set({ status: 'sending', recipientCount: list.length, updatedAt: new Date() })
      .where(and(eq(emailCampaigns.id, id), inArray(emailCampaigns.status, ['draft', 'scheduled'])))
      .returning();
    return row ?? null;
  }

  /** Periodic check: starts due scheduled campaigns and resumes any left in 'sending' (e.g. after a restart). */
  async checkPending(): Promise<void> {
    const due = await this.db
      .select({ id: emailCampaigns.id })
      .from(emailCampaigns)
      .where(and(eq(emailCampaigns.status, 'scheduled'), lte(emailCampaigns.scheduledAt, new Date())));
    for (const { id } of due) {
      try {
        if (await this.begin(id)) void this.process(id);
      } catch (e) {
        // Typically "no eligible recipients": close it out rather than retrying forever.
        this.logger.error(`could not start scheduled campaign ${id}: ${(e as Error).message}`);
        await this.db.update(emailCampaigns).set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() }).where(eq(emailCampaigns.id, id));
      }
    }
    const stuck = await this.db.select({ id: emailCampaigns.id }).from(emailCampaigns).where(eq(emailCampaigns.status, 'sending'));
    for (const { id } of stuck) {
      if (!this.running.has(id)) void this.process(id);
    }
  }

  /** Sends to everyone in the audience who has no `email_campaign_sends` row yet, ~10 emails per second. */
  async process(id: string): Promise<void> {
    if (this.running.has(id)) return;
    this.running.add(id);
    try {
      const c = await this.get(id);
      if (c.status !== 'sending') return;
      const audience = await this.audience(parseSegment(c.segment));
      const done = await this.db.select({ userId: emailCampaignSends.userId }).from(emailCampaignSends).where(eq(emailCampaignSends.campaignId, id));
      const doneIds = new Set(done.map((d) => d.userId));
      const todo = audience.filter((u) => !doneIds.has(u.id));

      for (let i = 0; i < todo.length; i += BATCH_SIZE) {
        const started = Date.now();
        await Promise.all(todo.slice(i, i + BATCH_SIZE).map((u) => this.sendOne(c, u)));
        await this.refreshCounters(id);
        const wait = BATCH_INTERVAL_MS - (Date.now() - started);
        if (wait > 0 && i + BATCH_SIZE < todo.length) await sleep(wait);
      }
      await this.refreshCounters(id);
      await this.db
        .update(emailCampaigns)
        .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
        .where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.status, 'sending')));
      this.logger.log(`[Campaign ${id}] finished, ${todo.length} emails processed in this run`);
    } catch (e) {
      // Left in 'sending': the periodic check resumes it.
      this.logger.error(`[Campaign ${id}] send run failed: ${(e as Error).message}`);
    } finally {
      this.running.delete(id);
    }
  }

  private async sendOne(c: Campaign, u: AudienceUser): Promise<void> {
    // Claim first (unique index), send second: a crash or a second process can never double-send to a user.
    const claimed = await this.db
      .insert(emailCampaignSends)
      .values({ campaignId: c.id, userId: u.id, email: u.email, status: 'sent' })
      .onConflictDoNothing()
      .returning({ id: emailCampaignSends.id });
    if (!claimed.length) return;
    try {
      await this.notifications.sendCampaignEmail(u.email, c, marketingUnsubscribeUrl(u.id));
    } catch (e) {
      await this.db
        .update(emailCampaignSends)
        .set({ status: 'failed', error: (e as Error).message.slice(0, 500) })
        .where(eq(emailCampaignSends.id, claimed[0].id));
    }
  }

  private async refreshCounters(id: string): Promise<void> {
    await this.db
      .update(emailCampaigns)
      .set({
        sentCount: sql`(select count(*)::int from ${emailCampaignSends} where ${emailCampaignSends.campaignId} = ${id} and ${emailCampaignSends.status} = 'sent')`,
        failedCount: sql`(select count(*)::int from ${emailCampaignSends} where ${emailCampaignSends.campaignId} = ${id} and ${emailCampaignSends.status} = 'failed')`,
        updatedAt: new Date(),
      })
      .where(eq(emailCampaigns.id, id));
  }
}
