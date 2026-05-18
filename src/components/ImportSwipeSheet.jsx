import { useState, useRef, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import ImportOnboardingOverlay, { ONBOARDING_KEY } from './ImportOnboardingOverlay';

export default function ImportSwipeSheet({
  transactions,
  initialIndex,
  isCreditCard,
  onUpdate,
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const touchStartX = useRef(null);
  const { categories, formatCurrency, language } = useSettings();

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true);
    }
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  };

  const goTo = (index) => {
    if (index < 0 || index >= transactions.length) return;
    setCurrentIndex(index);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta < 0) goTo(currentIndex + 1);
    else goTo(currentIndex - 1);
  };

  const trans = transactions[currentIndex];
  const isLast = currentIndex === transactions.length - 1;

  if (!trans) return null;

  const patch = (field, value) => onUpdate(trans._localId, { [field]: value });

  const typeLabel = (type) =>
    type === 'income'
      ? language === 'pt' ? 'ENTRADA' : 'INCOME'
      : language === 'pt' ? 'SAÍDA' : 'EXPENSE';

  return (
    <>
      {showOnboarding && <ImportOnboardingOverlay onDismiss={dismissOnboarding} />}

      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[90vh]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-gray-200 dark:bg-gray-600" />
        </div>

        {/* Navigation header */}
        <div className="flex items-center gap-2.5 px-4 pt-2 pb-1">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xl font-black disabled:opacity-30 active:scale-95 transition-all text-gray-900 dark:text-white"
          >
            ‹
          </button>

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

          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={isLast}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xl font-black disabled:opacity-30 active:scale-95 transition-all text-gray-900 dark:text-white"
          >
            ›
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
              <p className="text-base font-black text-gray-900 dark:text-white line-clamp-2 leading-snug">
                {trans._isGroup ? trans._baseDescription : trans.description}
              </p>
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

          {/* Fields */}
          <div className="flex flex-col gap-3">
            {/* Description */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                {language === 'pt' ? 'Descrição' : 'Description'}
              </label>
              <input
                type="text"
                value={trans.description}
                onChange={(e) => patch('description', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Amount + Type */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                  {language === 'pt' ? 'Valor' : 'Amount'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={trans.amount}
                  onChange={(e) => patch('amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              {!isCreditCard && (
                <div className="flex-1">
                  <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                    {language === 'pt' ? 'Tipo' : 'Type'}
                  </label>
                  <div className="flex p-0.5 bg-gray-100 dark:bg-gray-700 rounded-xl gap-0.5">
                    <button
                      onClick={() => patch('type', 'expense')}
                      className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all ${
                        trans.type === 'expense'
                          ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                          : 'text-gray-400'
                      }`}
                    >
                      {typeLabel('expense')}
                    </button>
                    <button
                      onClick={() => patch('type', 'income')}
                      className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all ${
                        trans.type === 'income'
                          ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                          : 'text-gray-400'
                      }`}
                    >
                      {typeLabel('income')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                {language === 'pt' ? 'Categoria' : 'Category'}
              </label>
              <div className="relative">
                <select
                  value={trans.category || ''}
                  onChange={(e) => patch('category', e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-9"
                >
                  <option value="">{language === 'pt' ? 'Sem categoria' : 'Uncategorized'}</option>
                  {(categories[trans.type] || []).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                {language === 'pt' ? 'Data' : 'Date'}
              </label>
              <input
                type="date"
                value={trans.date ? trans.date.split('T')[0] : ''}
                onChange={(e) => patch('date', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Include toggle */}
            <div className="flex items-center justify-between px-3.5 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {language === 'pt' ? 'Incluir na importação' : 'Include in import'}
              </span>
              <button
                onClick={() => patch('selected', !trans.selected)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  trans.selected ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-800 shadow transition-transform ${
                    trans.selected ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Fechar only on last card */}
        {isLast && (
          <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={onClose}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all shadow-xl shadow-emerald-600/20"
            >
              {language === 'pt' ? 'Fechar' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
