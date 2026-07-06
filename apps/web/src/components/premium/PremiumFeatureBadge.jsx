export default function PremiumFeatureBadge({ children = 'Premium' }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
      {children}
    </span>
  );
}
