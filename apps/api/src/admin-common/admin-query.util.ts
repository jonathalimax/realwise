import { BadRequestException } from '@nestjs/common';
import { sql, SQL } from 'drizzle-orm';

/** Brazil has had no DST since 2019, so a fixed offset is safe for "admin day" boundaries. */
export const ADMIN_TZ = 'America/Sao_Paulo';
const BRT_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_PAGE_SIZE = 100;

export type RawQuery = Record<string, string | string[] | undefined>;

export function str(value: unknown, max = 200): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

export function parseInteger(value: unknown, def: number, min: number, max: number, name: string): number {
  const v = str(value, 20);
  if (v === undefined) return def;
  if (!/^-?\d+$/.test(v)) throw new BadRequestException(`${name} must be an integer`);
  return Math.min(max, Math.max(min, parseInt(v, 10)));
}

export function parsePaging(q: RawQuery, defPageSize = 25): { page: number; pageSize: number; offset: number } {
  const page = parseInteger(q.page, 1, 1, 100000, 'page');
  const pageSize = parseInteger(q.pageSize, defPageSize, 1, MAX_PAGE_SIZE, 'pageSize');
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function parseUuid(value: unknown, name: string): string | undefined {
  const v = str(value, 40);
  if (v === undefined) return undefined;
  if (!UUID_RE.test(v)) throw new BadRequestException(`${name} must be a UUID`);
  return v;
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Parses a date filter. `YYYY-MM-DD` is read as a day in Brazil time (UTC-3); anything else must be an ISO timestamp.
 * With `endOfDay`, a date-only value means the *start of the next day* (exclusive upper bound).
 */
export function parseDateParam(value: unknown, name: string, endOfDay = false): Date | undefined {
  const v = str(value, 40);
  if (v === undefined) return undefined;
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    d = new Date(`${v}T00:00:00-03:00`);
    if (!Number.isNaN(d.getTime()) && endOfDay) d = new Date(d.getTime() + DAY_MS);
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    d = new Date(v);
  } else {
    throw new BadRequestException(`${name} must be YYYY-MM-DD or an ISO timestamp`);
  }
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${name} is not a valid date`);
  return d;
}

export function parseRange(
  q: RawQuery,
  opts: { defaultDays?: number; maxDays: number },
): { from?: Date; to?: Date } {
  let from = parseDateParam(q.from, 'from');
  const to = parseDateParam(q.to, 'to', true);
  if (opts.defaultDays !== undefined && !from && !to) {
    from = new Date(Date.now() - opts.defaultDays * DAY_MS);
  }
  if (from && to) {
    if (from >= to) throw new BadRequestException('from must be before to');
    if (to.getTime() - from.getTime() > opts.maxDays * DAY_MS) {
      throw new BadRequestException(`date range cannot exceed ${opts.maxDays} days`);
    }
  }
  return { from, to };
}

/** Midnight (Brazil time) of the day containing `date`, as a UTC Date. */
export function startOfBrtDay(date: Date): Date {
  const shifted = new Date(date.getTime() - BRT_OFFSET_HOURS * 3600 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), BRT_OFFSET_HOURS));
}

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Escapes `%`, `_` and `\` so user input is matched literally by ILIKE. */
export function likeContains(input: string): string {
  return `%${input.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** `timestamptz` parameter (ISO string + explicit cast keeps postgres.js from guessing the type). */
export function ts(date: Date): SQL {
  return sql`${date.toISOString()}::timestamptz`;
}

export const MICRO_CENTS_PER_USD = 1e8;
export function microCentsToUsd(value: number | string | null | undefined): number {
  return Math.round((Number(value ?? 0) / MICRO_CENTS_PER_USD) * 1e6) / 1e6;
}

/** CSV cell with quoting and protection against spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
