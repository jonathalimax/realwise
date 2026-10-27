import { createHmac, timingSafeEqual } from 'crypto';

const secret = () => process.env.JWT_SECRET ?? 'dev-secret';

export function unsubscribeToken(userId: string): string {
  return createHmac('sha256', secret()).update(`unsub:${userId}`).digest('hex').slice(0, 32);
}

export function isValidUnsubscribeToken(userId: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(token ?? '');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
