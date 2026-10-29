import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { and, count, countDistinct, desc, eq, gte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AllowWithoutSubscription } from '../billing/allow-without-subscription.decorator';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { landingEvents, leads, users } from '../db/schema';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VISITOR_RE = /^[A-Za-z0-9-]{8,64}$/;
const EVENTS = ['view', 'cta_click'] as const;
const str = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

/** Tiny per-IP sliding-window limiter so the public endpoints cannot be used to flood the database. */
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return recent.length > max;
}
const ipOf = (req: Request) => String(req.headers['x-forwarded-for'] ?? req.ip ?? 'unknown').split(',')[0].trim();

/** Public endpoints used by the landing page: funnel events and the "receive news" form. */
@Public()
@AllowWithoutSubscription()
@Controller('public/landing')
export class PublicLandingController {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  @Post('event')
  @HttpCode(204)
  async event(@Body() body: Record<string, unknown>, @Req() req: Request): Promise<void> {
    if (limited(`e:${ipOf(req)}`, 40, 60_000)) return;
    const visitorId = str(body?.visitorId, 64);
    const event = str(body?.event, 20);
    if (!visitorId || !VISITOR_RE.test(visitorId) || !event || !(EVENTS as readonly string[]).includes(event)) return;
    await this.db.insert(landingEvents).values({ visitorId, event, cta: str(body?.cta, 80), source: str(body?.source, 80) });
  }

  @Post('lead')
  async lead(@Body() body: Record<string, unknown>, @Req() req: Request): Promise<{ ok: boolean }> {
    if (str(body?.website, 100)) return { ok: true }; // honeypot: bots fill hidden fields
    if (limited(`l:${ipOf(req)}`, 5, 60 * 60_000)) throw new BadRequestException('Muitas tentativas. Tente de novo mais tarde.');
    const email = str(body?.email, 200)?.toLowerCase() ?? '';
    if (!EMAIL_RE.test(email)) throw new BadRequestException('Digite um e-mail válido.');
    if (body?.consent !== true) throw new BadRequestException('Marque a caixa para receber novidades.');
    const rawPhone = str(body?.phone, 30);
    const digits = rawPhone?.replace(/\D/g, '') ?? '';
    if (rawPhone && (digits.length < 10 || digits.length > 13)) throw new BadRequestException('Telefone inválido. Use DDD + número.');
    const phone = rawPhone ? digits : null;
    const source = str(body?.source, 80) ?? 'landing';

    const [existing] = await this.db.select().from(leads).where(sql`lower(${leads.email}) = ${email}`).limit(1);
    if (existing) {
      await this.db
        .update(leads)
        .set({ phone: phone ?? existing.phone, marketingConsent: true, updatedAt: new Date() })
        .where(eq(leads.id, existing.id));
    } else {
      await this.db.insert(leads).values({ email, phone, source, marketingConsent: true, status: 'new' });
    }
    return { ok: true };
  }
}

const DAY_MS = 86_400_000;

/** Landing funnel numbers for the admin: visits, CTA taps, captured leads and signups. */
@Controller('admin/landing')
@UseGuards(AdminGuard)
export class AdminLandingController {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  @Get('stats')
  async stats(@Query('days') daysRaw?: string) {
    const days = Math.min(Math.max(Number(daysRaw) || 30, 1), 365);
    const since = new Date(Date.now() - days * DAY_MS);
    const [visits] = await this.db
      .select({ visitors: countDistinct(landingEvents.visitorId), views: count() })
      .from(landingEvents)
      .where(and(eq(landingEvents.event, 'view'), gte(landingEvents.createdAt, since)));
    const [clicks] = await this.db
      .select({ clickers: countDistinct(landingEvents.visitorId), clicks: count() })
      .from(landingEvents)
      .where(and(eq(landingEvents.event, 'cta_click'), gte(landingEvents.createdAt, since)));
    const [leadRow] = await this.db.select({ n: count() }).from(leads).where(gte(leads.createdAt, since));
    const [signupRow] = await this.db.select({ n: count() }).from(users).where(gte(users.createdAt, since));
    const topCtas = await this.db
      .select({ cta: sql<string>`coalesce(${landingEvents.cta}, '(sem nome)')`, n: count() })
      .from(landingEvents)
      .where(and(eq(landingEvents.event, 'cta_click'), gte(landingEvents.createdAt, since)))
      .groupBy(sql`1`)
      .orderBy(desc(count()))
      .limit(8);
    const topSources = await this.db
      .select({ source: sql<string>`coalesce(${landingEvents.source}, 'direct')`, visitors: countDistinct(landingEvents.visitorId) })
      .from(landingEvents)
      .where(and(eq(landingEvents.event, 'view'), gte(landingEvents.createdAt, since)))
      .groupBy(sql`1`)
      .orderBy(desc(countDistinct(landingEvents.visitorId)))
      .limit(8);
    const perDay = await this.db
      .select({
        date: sql<string>`to_char(${landingEvents.createdAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
        visitors: sql<number>`count(distinct ${landingEvents.visitorId}) filter (where ${landingEvents.event} = 'view')::int`,
        clicks: sql<number>`count(*) filter (where ${landingEvents.event} = 'cta_click')::int`,
      })
      .from(landingEvents)
      .where(gte(landingEvents.createdAt, since))
      .groupBy(sql`1`)
      .orderBy(sql`1`);
    const visitors = Number(visits?.visitors ?? 0);
    const clickers = Number(clicks?.clickers ?? 0);
    return {
      days,
      visitors,
      views: Number(visits?.views ?? 0),
      ctaClicks: Number(clicks?.clicks ?? 0),
      clickers,
      ctr: visitors ? clickers / visitors : 0,
      leads: Number(leadRow?.n ?? 0),
      signups: Number(signupRow?.n ?? 0),
      topCtas: topCtas.map((r) => ({ cta: r.cta, count: Number(r.n) })),
      topSources: topSources.map((r) => ({ source: r.source, visitors: Number(r.visitors) })),
      perDay: perDay.map((r) => ({ date: r.date, visitors: Number(r.visitors), clicks: Number(r.clicks) })),
    };
  }
}
