import { CallHandler, ExecutionContext, Inject, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Observable } from 'rxjs';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { GeoService } from './geo.service';

export const LAST_ACTIVE_THROTTLE_MS = 10 * 60 * 1000;
const GEO_THROTTLE_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_USERS = 50000;

type Req = { user?: JwtPayload; headers?: Record<string, string | string[] | undefined>; ip?: string };
// Behind the proxy the client is the first address of X-Forwarded-For (same rule the other public endpoints use).
const clientIp = (req: Req): string | undefined => String(req.headers?.['x-forwarded-for'] ?? req.ip ?? '').split(',')[0].trim() || undefined;

/**
 * Global interceptor that stamps `users.last_active_at` for authenticated requests, at most once per
 * 10 minutes per user. Runs after the guards (so `request.user` is set), never awaits the write and never
 * fails the request. The in-memory map avoids a query on almost every request; the conditional UPDATE keeps
 * the 10-minute bound correct across restarts and multiple API replicas. The same hook refreshes the person's
 * approximate place (state and city, from the IP, never stored) about once a day.
 */
@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LastActiveInterceptor.name);
  private readonly lastTouch = new Map<string, number>();
  private readonly lastGeo = new Map<string, number>();

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly geo: GeoService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<Req>();
      const userId = req.user?.sub;
      if (userId) {
        this.touch(userId);
        this.touchGeo(userId, clientIp(req));
      }
    }
    return next.handle();
  }

  private touch(userId: string): void {
    const now = Date.now();
    const previous = this.lastTouch.get(userId);
    if (previous !== undefined && now - previous < LAST_ACTIVE_THROTTLE_MS) return;
    if (this.lastTouch.size >= MAX_TRACKED_USERS) {
      for (const [id, at] of this.lastTouch) if (now - at >= LAST_ACTIVE_THROTTLE_MS) this.lastTouch.delete(id);
      if (this.lastTouch.size >= MAX_TRACKED_USERS) this.lastTouch.clear();
    }
    this.lastTouch.set(userId, now);

    void this.db
      .execute(
        sql`update users set last_active_at = now()
            where id = ${userId}::uuid
              and (last_active_at is null or last_active_at < now() - interval '10 minutes')`,
      )
      .catch((e: Error) => {
        this.lastTouch.delete(userId);
        this.logger.warn(`last_active_at touch failed: ${e.message}`);
      });
  }

  private touchGeo(userId: string, ip: string | undefined): void {
    const now = Date.now();
    const previous = this.lastGeo.get(userId);
    if (previous !== undefined && now - previous < GEO_THROTTLE_MS) return;
    if (this.lastGeo.size >= MAX_TRACKED_USERS) this.lastGeo.clear();
    this.lastGeo.set(userId, now);

    void this.geo
      .lookup(ip)
      .then(async (place) => {
        if (!place) return; // unknown or private address: keep what we already had
        await this.db.execute(
          sql`update users set geo_country = ${place.country}, geo_region = ${place.region}, geo_city = ${place.city}, geo_at = now()
              where id = ${userId}::uuid`,
        );
      })
      .catch((e: Error) => {
        this.lastGeo.delete(userId);
        this.logger.warn(`location update failed: ${e.message}`);
      });
  }
}
