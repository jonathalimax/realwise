import { describe, expect, it } from 'vitest';
import {
  getPremiumAccessBannerContent,
  getPremiumFeatureLockContent,
} from './premiumCopy';

describe('premiumCopy', () => {
  it('builds an active premium access banner with days remaining and free-core reassurance', () => {
    expect(getPremiumAccessBannerContent({ premiumDaysRemaining: 18 })).toEqual({
      eyebrow: 'Premium Access',
      title: '18 days left in your Premium Access',
      body: 'Bills, Planning, and Investments are included for now. Manual tracking and imports stay free forever.',
      cta: 'See premium features',
    });
  });

  it('builds an expired premium lock state that reassures free-core availability', () => {
    expect(getPremiumFeatureLockContent({ featureName: 'Planning' })).toEqual({
      eyebrow: 'Premium feature',
      title: 'Planning is locked',
      body: 'Your 45-day Premium Access for advanced tools has ended. Manual tracking, imports, dashboard, and history are still free.',
      bullets: [
        'Manual transactions stay free',
        'Statement import stays free',
        'Upgrade to unlock Planning again',
      ],
      primaryCta: 'Unlock Premium',
      secondaryCta: 'Keep using free features',
    });
  });
});
