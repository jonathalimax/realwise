import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_SUBSCRIPTION_KEY = 'allowWithoutSubscription';

/** Marks a controller/route as reachable even when the user's access is blocked (auth, billing, health). */
export const AllowWithoutSubscription = () => SetMetadata(ALLOW_WITHOUT_SUBSCRIPTION_KEY, true);
