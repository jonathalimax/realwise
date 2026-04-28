import { useMemo } from 'react';
import { useMonth } from '../contexts/MonthContext';
import { useSettings } from '../contexts/SettingsContext';

const getNow = () => new Date();
const getCurrentMonthKey = () => {
  const d = getNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function CompactMonthNav({ selectedMonth, onMonthChange, locale }) {
  const currentMonthKey = getCurrentMonthKey();
  const isCurrentMonth = selectedMonth === currentMonthKey;
  const [y, m] = selectedMonth.split('-').map(Number);
  const currentYear = getNow().getFullYear();

  const prev = () => {
    const d = new Date(y, m - 2, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const next = () => {
    const d = new Date(y, m, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const label = useMemo(() => {
    const d = new Date(y, m - 1, 1);
    const monthStr = d.toLocaleDateString(locale, { month: 'short' });
    // Show year only when viewing a different year
    return y !== currentYear ? `${monthStr} ${y}` : monthStr;
  }, [y, m, locale, currentYear]);

  return (
    <div className="flex items-center gap-1">
      {!isCurrentMonth && (
        <button
          onClick={() => onMonthChange(currentMonthKey)}
          title={locale === 'pt-BR' ? 'Mês atual' : 'Current month'}
          className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-black uppercase hover:bg-violet-200 dark:hover:bg-violet-800/50 transition-colors"
        >
          {locale === 'pt-BR' ? 'hoje' : 'today'}
        </button>
      )}
      <button
        onClick={prev}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
      >
        ‹
      </button>
      <span
        className={`text-sm font-bold min-w-[52px] text-center capitalize tabular-nums uppercase ${
          isCurrentMonth ? 'text-violet-600 dark:text-violet-400' : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        {label}
      </span>
      <button
        onClick={next}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
      >
        ›
      </button>
    </div>
  );
}

/**
 * Shared sticky page header with title + optional compact month nav.
 *
 * Props:
 *  title       – page title string
 *  showMonth   – show the month navigator (default true)
 *  right       – optional React element rendered after the month nav (e.g. a close button)
 */
export default function PageHeader({ title, showMonth = true, right }) {
  const { selectedMonth, setSelectedMonth } = useMonth();
  const { language } = useSettings();
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  return (
    <div className="sticky top-0 z-30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 sm:h-16 gap-3 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white pl-12 md:pl-0 flex-1 truncate uppercase tracking-tight">
            {title}
          </h1>
          {showMonth && (
            <CompactMonthNav
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              locale={locale}
            />
          )}
          {right}
        </div>
      </div>
    </div>
  );
}
