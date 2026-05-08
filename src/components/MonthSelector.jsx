import { useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@heroicons/react/24/outline';

export default function MonthSelector({ selectedMonth, availableMonths, onMonthChange, locale = 'en-US', enhanced = false }) {
  const currentIndex = availableMonths.indexOf(selectedMonth);
  const canGoPrevious = currentIndex < availableMonths.length - 1;
  const canGoNext = currentIndex > 0;

  const goToPreviousMonth = () => {
    if (canGoPrevious) {
      onMonthChange(availableMonths[currentIndex + 1]);
    }
  };

  const goToNextMonth = () => {
    if (canGoNext) {
      onMonthChange(availableMonths[currentIndex - 1]);
    }
  };

  const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return selectedMonth === currentMonthKey;
  }, [selectedMonth]);

  if (enhanced) {
    return (
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousMonth}
            disabled={!canGoPrevious}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all"
          >
            <ChevronLeftIcon className="w-5 h-5 text-white" />
          </button>

          <div className="text-center">
            <div className="flex items-center gap-2 justify-center mb-1">
              <CalendarIcon className="w-4 h-4 text-white/80" />
              <span className="text-xs text-white/80 uppercase tracking-wide">
                {isCurrentMonth ? (locale === 'pt-BR' ? 'Mês Atual' : 'Current Month') : (locale === 'pt-BR' ? 'Visualizando' : 'Viewing')}
              </span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="bg-transparent text-white text-xl sm:text-2xl font-bold text-center cursor-pointer focus:outline-none capitalize appearance-none"
              style={{ textAlignLast: 'center' }}
            >
              {availableMonths.map(month => (
                <option key={month} value={month} className="text-gray-900 capitalize">
                  {getMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={goToNextMonth}
            disabled={!canGoNext}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all"
          >
            <ChevronRightIcon className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <button
        onClick={goToPreviousMonth}
        disabled={!canGoPrevious}
        className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-all flex-shrink-0"
      >
        <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </button>

      <div className={`flex-1 relative ${isCurrentMonth ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-gray-900 rounded-xl' : ''}`}>
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className={`w-full pl-3 pr-8 py-2 rounded-xl font-bold text-sm border-0 shadow-sm focus:ring-2 focus:ring-violet-500 cursor-pointer text-center capitalize ${
            isCurrentMonth
              ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
          }`}
        >
          {availableMonths.map(month => (
            <option key={month} value={month} className="capitalize">
              {getMonthLabel(month)}
            </option>
          ))}
        </select>
        {isCurrentMonth && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-500 text-white rounded-full">
            {locale === 'pt-BR' ? 'Atual' : 'Current'}
          </span>
        )}
      </div>

      <button
        onClick={goToNextMonth}
        disabled={!canGoNext}
        className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-all flex-shrink-0"
      >
        <ChevronRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </button>
    </div>
  );
}
