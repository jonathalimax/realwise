import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AllowWithoutSubscription } from '../billing/allow-without-subscription.decorator';
import { ErrorLogService } from './error-log.service';

const KINDS = ['js', 'rejection', 'boundary', 'network'] as const;
const str = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

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

/**
 * Where the web app reports crashes and failed requests. Public on purpose (a crash can happen before login), so it is
 * rate limited per IP and only trusts the user when the signed session cookie verifies.
 */
@Public()
@AllowWithoutSubscription()
@Controller('public/errors')
export class PublicErrorsController {
  private readonly jwt = new JwtService({ secret: process.env.JWT_SECRET ?? 'dev-secret' });

  constructor(private readonly errors: ErrorLogService) {}

  @Post()
  @HttpCode(204)
  async report(@Body() body: Record<string, unknown>, @Req() req: Request): Promise<void> {
    if (limited(`err:${ipOf(req)}`, 30, 60_000)) return;
    const message = str(body?.message, 2000);
    if (!message) return;
    const kind = (KINDS as readonly string[]).includes(String(body?.kind)) ? String(body.kind) : 'js';

    let userId: string | null = null;
    const token = (req.cookies as Record<string, string> | undefined)?.access_token;
    if (token) {
      try {
        userId = this.jwt.verify<JwtPayload>(token).sub ?? null;
      } catch {
        /* expired or invalid session: report it anonymously */
      }
    }

    await this.errors.record({
      source: 'web',
      level: 'error',
      statusCode: typeof body?.status === 'number' ? body.status : null,
      method: str(body?.method, 10),
      route: str(body?.page, 300),
      message,
      stack: str(body?.stack, 8000),
      userId,
      appVersion: str(body?.release, 40),
      userAgent: str(req.headers['user-agent'], 400),
      context: { kind, ...(str(body?.request, 300) ? { request: str(body?.request, 300) } : {}), ...(str(body?.componentStack, 2000) ? { componentStack: str(body?.componentStack, 2000) } : {}) },
    });
  }
}
