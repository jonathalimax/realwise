import { sql, SQL } from 'drizzle-orm';
import { users } from '../db/schema';
import { OWNER_EMAIL, PAST_DUE_GRACE_DAYS } from '../billing/access';

/**
 * SQL mirror of `computeAccess` (billing/access.ts) so admin lists can filter, count and sort by access state
 * in the database. Evaluates to 'owner' | 'lifetime' | 'subscribed' | 'trial' | 'blocked'.
 * Keep in sync with computeAccess; the admin-v2 scratch-database check compares both on seeded users.
 */
export function accessStateSql(): SQL<string> {
  return sql<string>`(case
    when ${users.role} = 'admin' or lower(btrim(${users.email})) = ${OWNER_EMAIL} then 'owner'
    when ${users.premiumStatus} = 'active' and ${users.stripeSubscriptionId} is null then 'lifetime'
    when ${users.subscriptionStatus} in ('active', 'trialing') then 'subscribed'
    when ${users.subscriptionStatus} = 'past_due'
      and ${users.subscriptionCurrentPeriodEnd} is not null
      and now() < ${users.subscriptionCurrentPeriodEnd} + make_interval(days => ${PAST_DUE_GRACE_DAYS}) then 'subscribed'
    when ${users.subscriptionStatus} = 'canceled'
      and ${users.subscriptionCancelAtPeriodEnd}
      and ${users.subscriptionCurrentPeriodEnd} is not null
      and now() < ${users.subscriptionCurrentPeriodEnd} then 'subscribed'
    when ${users.premiumStatus} = 'trialing'
      and ${users.premiumAccessEndsAt} is not null
      and ${users.premiumAccessEndsAt} > now() then 'trial'
    else 'blocked'
  end)`;
}
