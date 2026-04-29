import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMonth } from '../contexts/MonthContext';
import { useSettings } from '../contexts/SettingsContext';
import { auth } from '../firebase';
import { Bars3Icon, ArrowLeftIcon } from '@heroicons/react/24/outline';

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

export default function PageHeader({ title, showMonth = true, right }) {
  const { selectedMonth, setSelectedMonth } = useMonth();
  const { language } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const isDashboard = location.pathname.includes('/dashboard');
  const pathParts = location.pathname.split('/').filter(Boolean);
  
  // Logic to determine if we should show a back button instead of hamburger
  const isNestedRoute = pathParts.length > 1 && !['dashboard', 'income', 'expenses', 'bills', 'cards', 'planning', 'budget', 'goals', 'import', 'help', 'settings'].includes(pathParts[pathParts.length - 1]);

  const toggleSidebar = () => {
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  };

  const handleBack = () => {
    navigate(-1);
  };

  const displayTitle = useMemo(() => {
    if (!isDashboard) return title;
    const user = auth.currentUser;
    if (!user) return title;
    const firstName = user.displayName ? user.displayName.split(' ')[0] : null;
    return language === 'pt' 
      ? (firstName ? `Olá, ${firstName}` : 'Olá novamente') 
      : (firstName ? `Hi, ${firstName}` : 'Hi again');
  }, [isDashboard, title, language]);

  return (
    <div className="sticky top-0 z-30 transition-colors bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center h-14 sm:h-16 px-0">
          {/* Mobile Navigation Toggle / Back */}
          <div className="md:hidden flex-shrink-0 z-10">
            {isNestedRoute ? (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
                aria-label="Back"
              >
                <ArrowLeftIcon className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={toggleSidebar}
                className="p-2 -ml-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
                aria-label="Menu"
              >
                <Bars3Icon className="w-6 h-6" />
              </button>
            )}
          </div>

          <h1 className="absolute inset-x-0 text-center pointer-events-none sm:static sm:text-left sm:flex-1 sm:pointer-events-auto sm:truncate text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
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
          </div>
        </div>
      </div>
    </div>
  );
}
