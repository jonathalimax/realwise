import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';
import { ErrorLogService } from './error-log.service';

/** Expected, not a problem: the paywall answering a user whose access ended. */
const IGNORED_STATUSES = new Set([402]);

function messageOf(exception: unknown): string {
  if (exception instanceof HttpException) {
    const body = exception.getResponse();
    const inner = typeof body === 'object' && body !== null ? (body as { message?: unknown }).message : undefined;
    if (Array.isArray(inner)) return inner.join('; ');
    if (typeof inner === 'string') return inner;
    return exception.message;
  }
  return exception instanceof Error ? exception.message : String(exception);
}

/**
 * Keeps Nest's normal error response (it delegates to the base filter) and, on the way, stores what failed: route
 * pattern, status, message, stack for server errors, and who was logged in. Never reads the body or headers other than
 * the user agent.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(adapterHost: HttpAdapterHost, private readonly errors: ErrorLogService) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    try {
      if (host.getType() === 'http') this.capture(exception, host);
    } catch {
      /* never let logging change the response */
    }
    super.catch(exception, host);
  }

  private capture(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request & { user?: { sub?: string } }>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (IGNORED_STATUSES.has(status) || req.method === 'OPTIONS' || req.path === '/health') return;
    void this.errors.record({
      source: 'api',
      level: status >= 500 ? 'error' : 'warn',
      statusCode: status,
      method: req.method,
      route: (req.route as { path?: string } | undefined)?.path ?? '(unmatched)',
      message: messageOf(exception),
      stack: status >= 500 && exception instanceof Error ? exception.stack : null,
      userId: req.user?.sub ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }
}
