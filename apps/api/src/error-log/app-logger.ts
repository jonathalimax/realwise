import { ConsoleLogger } from '@nestjs/common';
import type { ErrorInput } from './error-log.service';

/** Contexts that are already recorded elsewhere (the exception filter) or that would loop. */
const SKIP_CONTEXTS = new Set(['ExceptionsHandler', 'ErrorLog']);

/**
 * Console logger that also forwards `error()` calls to the error table. Background code already reports failures with
 * `logger.error`, so this captures them without touching each call site. The sink is set by ErrorLogService once the
 * app is up; before that (and in tests) it behaves exactly like the default logger.
 */
export class AppLogger extends ConsoleLogger {
  static sink: ((input: ErrorInput) => void) | null = null;

  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams);
    try {
      const params = [...optionalParams];
      const last = params[params.length - 1];
      const context = typeof last === 'string' && params.length > 0 && !/\n\s+at /.test(last) ? (params.pop() as string) : this.context;
      if (context && SKIP_CONTEXTS.has(context)) return;
      const stackParam = params.find((p) => typeof p === 'string' && /\n\s+at /.test(p)) as string | undefined;
      const err = message instanceof Error ? message : null;
      AppLogger.sink?.({
        source: 'job',
        message: err ? err.message : typeof message === 'string' ? message : JSON.stringify(message),
        stack: err?.stack ?? stackParam ?? null,
        context: context ? { logger: context } : null,
      });
    } catch {
      /* logging must never throw */
    }
  }
}
