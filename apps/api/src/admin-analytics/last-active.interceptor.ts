import { CallHandler, ExecutionContext, Inject, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Observable } from 'rxjs';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';

export const LAST_ACTIVE_THROTTLE_MS = 10 * 60 * 1000;
const MAX_TRACKED_USERS = 50000;

/**
 * Global interceptor that stamps `users.last_active_at` for authenticated requests, at most once per
 * 10 minutes per user. Runs after the guards (so `request.user` is set), never awaits the write and never
 * fails the request. The in-memory map avoids a query on almost every request; the conditional UPDATE keeps
 * the 10-minute bound correct across restarts and multiple API replicas.
 */
@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LastActiveInterceptor.name);
  private readonly lastTouch = new Map<string, number>();

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const userId = context.switchToHttp().getRequest<{ user?: JwtPayload }>().user?.sub;
      if (userId) this.touch(userId);
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
}
