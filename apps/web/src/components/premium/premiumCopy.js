export function getPremiumAccessBannerContent({ premiumDaysRemaining }) {
  return {
    eyebrow: 'Premium Access',
    title: `${premiumDaysRemaining} days left in your Premium Access`,
    body: 'Bills, Planning, and Investments are included for now. Manual tracking and imports stay free forever.',
    cta: 'See premium features',
  };
}

export function getPremiumFeatureLockContent({ featureName }) {
  return {
    eyebrow: 'Premium feature',
    title: `${featureName} is locked`,
    body: 'Your 45-day Premium Access for advanced tools has ended. Manual tracking, imports, dashboard, and history are still free.',
    bullets: [
      'Manual transactions stay free',
      'Statement import stays free',
      `Upgrade to unlock ${featureName} again`,
    ],
    primaryCta: 'Unlock Premium',
    secondaryCta: 'Keep using free features',
  };
}
