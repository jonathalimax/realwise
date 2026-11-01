import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMonth } from '../contexts/MonthContext';
import { useSettings } from '../contexts/SettingsContext';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useAccess } from '../contexts/AccessContext';

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
        className={`text-sm font-bold min-w-[52px] text-center capitalize tabular-nums ${
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

export default function PageHeader({ title, showMonth = true, right, backTo }) {
  const { selectedMonth, setSelectedMonth } = useMonth();
  const { language, t } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const isDashboard = location.pathname.includes('/dashboard');
  const pathParts = location.pathname.split('/').filter(Boolean);
  const { currentUser } = useAccess();
  const initial = (currentUser?.displayName || currentUser?.email || '?').trim().charAt(0).toUpperCase();
  
  // Logic to determine if we should show a back button instead of hamburger
  const isNestedRoute = pathParts.length > 1 && !['dashboard', 'income', 'expenses', 'bills', 'cards', 'planning', 'budget', 'goals', 'import', 'help', 'settings'].includes(pathParts[pathParts.length - 1]);

  const handleBack = () => {
    if (backTo) navigate(backTo);
    else navigate(-1);
  };

  const displayTitle = useMemo(() => {
    if (!isDashboard) return title;
    return language === 'pt' ? 'Início' : 'Home';
  }, [isDashboard, title, language]);

  return (
    <div className="sticky top-0 z-30 transition-colors bg-[var(--rw-bg)]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center h-14 sm:h-16 px-0">
          {/* Lead: explicit parent link (e.g. Settings sub-routes) — all breakpoints */}
          {backTo ? (
            <div className="flex-shrink-0 z-10">
              <button
                type="button"
                onClick={handleBack}
                className="p-2 -ml-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
                aria-label={t('common.back')}
              >
                <ArrowLeftIcon className="w-6 h-6" />
              </button>
            </div>
          ) : (
            /* Mobile: history back on nested screens. Main places live in the bottom tab bar. */
            isNestedRoute ? (
              <div className="lg:hidden flex-shrink-0 z-10">
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-2 -ml-2 text-[var(--rw-ink)] hover:bg-[var(--rw-raised)] rounded-xl transition-colors"
                  aria-label={t('common.back')}
                >
                  <ArrowLeftIcon className="w-6 h-6" />
                </button>
              </div>
            ) : null
          )}

          <h1 className="flex-1 min-w-0 ml-2 sm:ml-3 truncate text-left sm:flex-1 text-2xl font-bold tracking-tight text-[var(--rw-ink)]">
            {displayTitle}
          </h1>

          <div className="ml-auto flex items-center gap-2 z-10 flex-shrink-0">
            {showMonth && (
              <CompactMonthNav
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                locale={locale}
              />
            )}
            {right}
            <Link to="/settings" aria-label={language === 'pt' ? 'Ajustes' : 'Settings'} className="lg:hidden w-9 h-9 rounded-full bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)] flex items-center justify-center text-sm font-bold">{initial}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
