import { useState, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useGoals } from '../contexts/GoalsContext';
import usePlannerGoals from '../pages/planner/usePlannerGoals';
import ImportOnboardingOverlay, { ONBOARDING_KEY } from './ImportOnboardingOverlay';
import { statusFromFlags, flagsForStatus } from './import/importStatus';
import TransactionFields from './transaction/TransactionFields';

export default function ImportSwipeSheet({
  transactions,
  initialIndex,
  isCreditCard,
  onUpdate,
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY));
  const handleTouchStartY = useRef(null);
  const { categories, formatCurrency, language } = useSettings();
  const { goals } = useGoals();
  const plannerGoals = usePlannerGoals();
  const availableGoals = goals.filter(g => !g.completed);

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  };

  const goTo = (index) => {
    if (index < 0 || index >= transactions.length) return;
    setCurrentIndex(index);
  };

  const handleDragStart = (e) => {
    handleTouchStartY.current = e.touches[0].clientY;
  };

  const handleDragEnd = (e) => {
    if (handleTouchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - handleTouchStartY.current;
    handleTouchStartY.current = null;
    if (delta > 80) onClose();
  };

  const trans = transactions[currentIndex];
  const isLast = currentIndex === transactions.length - 1;

  if (!trans) return null;

  const patch = (field, value) => onUpdate(trans._localId, { [field]: value });

  const label = (pt, en) => (language === 'pt' ? pt : en);

  return (
    <>
      {showOnboarding && <ImportOnboardingOverlay onDismiss={dismissOnboarding} />}

      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Sheet — fixed 85svh so height never changes between cards */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl"
        style={{ height: '90svh' }}
      >
        {/* Drag handle — touch here to drag down and dismiss */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-500" />
        </div>

        {/* Progress header */}
        <div className="flex items-center gap-2.5 px-4 pt-1 pb-1">
          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isLast ? 'bg-emerald-500' : 'bg-gray-900 dark:bg-white'
                }`}
                style={{ width: `${((currentIndex + 1) / transactions.length) * 100}%` }}
              />
            </div>
            <span
              className={`text-[11px] font-bold transition-colors ${
                isLast
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {isLast
                ? `${currentIndex + 1} de ${transactions.length} ✓`
                : `${currentIndex + 1} de ${transactions.length}`}
            </span>
          </div>

          {/* Close button — always visible as fallback */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center active:scale-95 transition-all text-gray-500 dark:text-gray-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable edit form */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 min-h-0">
          {/* Identity row */}
          <div className="flex items-start gap-2.5 mb-5">
            <div
              className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                trans.type === 'income'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40'
                  : 'bg-rose-100 dark:bg-rose-900/40'
              }`}
            >
              <svg
                className={`w-4 h-4 ${
                  trans.type === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {trans.type === 'income' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                )}
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              {/* Fixed 2-line height — overflow hidden prevents any layout shift */}
              <p className="text-base font-black text-gray-900 dark:text-white line-clamp-2 leading-snug" style={{ height: '2.75rem', overflow: 'hidden' }}>
                {trans._isGroup ? trans._baseDescription : trans.description}
              </p>
              {/* Always reserve badge row height to prevent shift when badge appears/disappears */}
              <div style={{ height: '1.375rem' }}>
                {(trans._isGroup || trans.isInstallment) && (
                  <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 uppercase tracking-tight">
                    {trans._isGroup
                      ? `${trans.installmentTotal}x · ${label('edições aplicam a todas', 'edits apply to all')}`
                      : `${label('Parcela', 'Installment')} ${trans.installmentCurrent}/${trans.installmentTotal}`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <p
                className={`text-lg font-black whitespace-nowrap ${
                  trans.type === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {trans.type === 'income' ? '+' : '-'}
                {formatCurrency(trans._isGroup ? trans._totalAmount : trans.amount)}
              </p>
            </div>
          </div>

          {/* ── Fields ── */}
          <div className="flex flex-col gap-3">

            <TransactionFields
              value={trans}
              onChange={patch}
              categories={categories}
              availableGoals={availableGoals}
              plannerGoals={plannerGoals}
              language={language}
              isCreditCard={isCreditCard}
              formatCurrency={formatCurrency}
            />

            {/* Import status — single control replacing the include/ignore toggles */}
            <div>
              {(() => {
                const status = statusFromFlags({ selected: trans.selected, ignored: trans.ignored });
                const setStatus = (next) => {
                  const flags = flagsForStatus(next);
                  patch('selected', flags.selected);
                  patch('ignored', flags.ignored);
                };
                const options = [
                  { value: 'import', label: label('Importar', 'Import') },
                  { value: 'importIgnore', label: label('Importar e ignorar', 'Import & ignore') },
                  { value: 'skip', label: label('Não importar', "Don't import") },
                ];
                return (
                  <>
                    <div className="flex p-0.5 bg-gray-100 dark:bg-gray-700 rounded-xl gap-0.5 overflow-hidden">
                      {options.map(({ value, label: lbl }) => (
                        <button
                          key={value}
                          onClick={() => setStatus(value)}
                          className={`flex-1 px-1 py-2.5 text-[11px] font-black rounded-[10px] transition-all leading-tight ${
                            status === value
                              ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                              : 'text-gray-400'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                    {/* Fixed-height clarifier row — reserved always so layout never shifts */}
                    <div className="h-4 mt-1">
                      {status === 'importIgnore' && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium text-center">
                          {label('Não aparece nos totais', 'Not counted in totals')}
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

          </div>
        </div>

        {/* Bottom navigation — always visible, large tap targets */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex-shrink-0 w-14 h-14 rounded-2xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-3xl font-black disabled:opacity-30 active:scale-95 transition-all text-gray-900 dark:text-white"
            aria-label={label('Voltar', 'Back')}
          >
            ‹
          </button>
          {isLast ? (
            <button
              onClick={onClose}
              className="flex-1 h-14 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all shadow-xl shadow-emerald-600/20"
            >
              {label('Concluir', 'Finish')}
            </button>
          ) : (
            <button
              onClick={() => goTo(currentIndex + 1)}
              className="flex-1 h-14 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all"
            >
              {label('Próximo', 'Next')} ›
            </button>
          )}
        </div>
      </div>
    </>
  );
}
