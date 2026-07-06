import { getPremiumAccessBannerContent } from './premiumCopy';

export default function PremiumAccessBanner({ premiumDaysRemaining, onOpenPremium }) {
  const content = getPremiumAccessBannerContent({ premiumDaysRemaining });

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-slate-100">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
        {content.eyebrow}
      </p>
      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold">{content.title}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{content.body}</p>
        </div>
        <button
          type="button"
          onClick={onOpenPremium}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {content.cta}
        </button>
      </div>
    </div>
  );
}
