import { createHmac, timingSafeEqual } from 'crypto';

const secret = () => process.env.JWT_SECRET ?? 'dev-secret';

// Own prefix so a reminder-unsubscribe token can never be replayed against the marketing opt-out (and vice versa).
export function marketingUnsubscribeToken(userId: string): string {
  return createHmac('sha256', secret()).update(`mkt-unsub:${userId}`).digest('hex').slice(0, 32);
}

export function isValidMarketingUnsubscribeToken(userId: string, token: string): boolean {
  const expected = Buffer.from(marketingUnsubscribeToken(userId));
  const given = Buffer.from(token ?? '');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function marketingUnsubscribeUrl(userId: string): string {
  const api = process.env.API_BASE_URL ?? 'https://api.realwise.com.br';
  return `${api}/marketing/unsubscribe?u=${userId}&t=${marketingUnsubscribeToken(userId)}`;
}

// Leads (landing-page contacts) get their own prefix: a user token can never opt a lead out, nor the reverse.
export function leadUnsubscribeToken(leadId: string): string {
  return createHmac('sha256', secret()).update(`mkt-lead-unsub:${leadId}`).digest('hex').slice(0, 32);
}

export function isValidLeadUnsubscribeToken(leadId: string, token: string): boolean {
  const expected = Buffer.from(leadUnsubscribeToken(leadId));
  const given = Buffer.from(token ?? '');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function leadUnsubscribeUrl(leadId: string): string {
  const api = process.env.API_BASE_URL ?? 'https://api.realwise.com.br';
  return `${api}/marketing/unsubscribe-lead?l=${leadId}&t=${leadUnsubscribeToken(leadId)}`;
}
