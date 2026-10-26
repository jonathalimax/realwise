import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { users } from '../db/schema';
import { computeAccess } from './access';
import { ALLOW_WITHOUT_SUBSCRIPTION_KEY } from './allow-without-subscription.decorator';

export const SUBSCRIPTION_REQUIRED_CODE = 'SUBSCRIPTION_REQUIRED';

/**
 * Global paywall. Must be registered after JwtAuthGuard so `request.user` is populated.
 * Fails closed: an unknown user row or any DB error never grants access.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_SUBSCRIPTION_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const subject = request.user?.sub;
    if (!subject) throw new UnauthorizedException();

    const rows = await this.db.select().from(users).where(eq(users.id, subject));
    const access = computeAccess(rows[0] ?? null, new Date());
    if (access.allowed) return true;

    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: SUBSCRIPTION_REQUIRED_CODE,
        message: 'An active subscription is required.',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
