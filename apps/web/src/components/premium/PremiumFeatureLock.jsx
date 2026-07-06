import { getPremiumFeatureLockContent } from './premiumCopy';
import PremiumFeatureBadge from './PremiumFeatureBadge';

export default function PremiumFeatureLock({
  featureName,
  onUnlock,
  onBackToFree,
}) {
  const content = getPremiumFeatureLockContent({ featureName });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <PremiumFeatureBadge>{content.eyebrow}</PremiumFeatureBadge>
      <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{content.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
        {content.body}
      </p>

      <ul className="mt-5 space-y-2 text-sm text-slate-700 dark:text-slate-200">
        {content.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onUnlock}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {content.primaryCta}
        </button>
        <button
          type="button"
          onClick={onBackToFree}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {content.secondaryCta}
        </button>
      </div>
    </div>
  );
}
