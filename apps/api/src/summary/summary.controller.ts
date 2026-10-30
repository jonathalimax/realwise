import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AllowWithoutSubscription } from '../billing/allow-without-subscription.decorator';
import { SummaryService } from './summary.service';
import type { SummaryKind } from './summary.types';

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

/** The private summary page reads its data here. The unguessable token in the link is the only credential. */
@Public()
@AllowWithoutSubscription()
@Controller('public/summary')
export class PublicSummaryController {
  constructor(private readonly summaries: SummaryService) {}

  @Get(':token')
  async get(@Param('token') token: string, @Req() req: Request) {
    if (limited(`sum:${ipOf(req)}`, 60, 60_000)) throw new NotFoundException();
    const found = await this.summaries.byToken(token);
    if (!found) throw new NotFoundException('Este resumo não existe ou o link expirou.');
    return { kind: found.kind, generatedAt: found.generatedAt, clientId: found.clientId, summary: found.payload };
  }
}

/** On demand: "me mostra meu resumo". Returns the private link; the page renders it. */
@Controller('summary')
export class SummaryController {
  constructor(private readonly summaries: SummaryService) {}

  @Post('generate')
  async generate(@CurrentUser() user: JwtPayload, @Body() body: { which?: string }) {
    const which = body?.which === 'last' ? 'last' : 'this';
    const out = await this.summaries.generate(user.sub, 'on_demand', which);
    return { url: out.url, tone: out.payload.tone, score: out.payload.score, headline: out.payload.headline };
  }
}

/** Admin: preview a user's summary, or send it to yourself, to check wording and layout without waiting for the 1st. */
@Controller('admin/summary')
@UseGuards(AdminGuard)
export class AdminSummaryController {
  constructor(private readonly summaries: SummaryService) {}

  @Post('preview')
  async preview(@CurrentUser() admin: JwtPayload, @Body() body: { userId?: string; kind?: SummaryKind; which?: string; send?: boolean }) {
    const userId = body?.userId || admin.sub;
    const kind: SummaryKind = body?.kind === 'trial_end' || body?.kind === 'monthly' ? body.kind : 'on_demand';
    const which = body?.which === 'this' ? 'this' : 'last';
    const out = await this.summaries.generate(userId, kind, which);
    let sentTo: string | null = null;
    if (body?.send) {
      // Always to the admin's own address, never to the user being previewed.
      const [adminRow] = await this.summaries.emailOf(admin.sub);
      sentTo = adminRow?.email ?? null;
      if (sentTo) await this.summaries.send(userId, kind, { which, force: true, toOverride: sentTo });
    }
    return { url: out.url, tone: out.payload.tone, score: out.payload.score, headline: out.payload.headline, sentTo };
  }
}
