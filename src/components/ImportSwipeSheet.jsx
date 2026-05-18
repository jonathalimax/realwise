import { useState, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useGoals } from '../contexts/GoalsContext';
import { INVESTMENT_TYPES, RETURN_TYPES } from '../contexts/InvestmentContext';
import usePlannerGoals from '../pages/planner/usePlannerGoals';
import ImportOnboardingOverlay, { ONBOARDING_KEY } from './ImportOnboardingOverlay';

export default function ImportSwipeSheet({
  transactions,
  initialIndex,
  isCreditCard,
  onUpdate,
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY));
  const touchStartX = useRef(null);
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

  const typeLabel = (type) =>
    type === 'income'
      ? language === 'pt' ? 'ENTRADA' : 'INCOME'
      : language === 'pt' ? 'SAÍDA' : 'EXPENSE';

  const isInvestmentCategory =
    trans.category === 'Investimentos' || trans.category === 'Investments';

  const label = (pt, en) => (language === 'pt' ? pt : en);

  const fieldLabel = (text) => (
    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
      {text}
    </label>
  );

  return (
    <>
      {showOnboarding && <ImportOnboardingOverlay onDismiss={dismissOnboarding} />}

      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Sheet — fixed 85svh so height never changes between cards */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl"
        style={{ height: '85svh' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — touch here to drag down and dismiss */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-500" />
        </div>

        {/* Navigation header */}
        <div className="flex items-center gap-2.5 px-4 pt-1 pb-1">
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

            {/* Description */}
            <div>
              {fieldLabel(label('Descrição', 'Description'))}
              <input
                type="text"
                value={trans.description}
                onChange={(e) => patch('description', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Amount + Type (type hidden for credit card) */}
            <div className="flex gap-3">
              <div className="flex-1">
                {fieldLabel(label('Valor', 'Amount'))}
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
                  {fieldLabel(label('Tipo', 'Type'))}
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

            {/* Payment method — shown only for account imports (not credit card) */}
            {!isCreditCard && (
              <div>
                {fieldLabel(label('Método de pagamento', 'Payment method'))}
                <div className="flex p-0.5 bg-gray-100 dark:bg-gray-700 rounded-xl gap-0.5">
                  {[
                    { value: 'debit', label: label('Débito', 'Debit') },
                    { value: 'pix', label: 'PIX' },
                    { value: 'boleto', label: 'Boleto' },
                  ].map(({ value, label: lbl }) => (
                    <button
                      key={value}
                      onClick={() => patch('paymentMethod', value)}
                      className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${
                        (trans.paymentMethod || 'debit') === value
                          ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                          : 'text-gray-400'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category */}
            <div>
              {fieldLabel(label('Categoria', 'Category'))}
              <div className="relative">
                <select
                  value={trans.category || ''}
                  onChange={(e) => patch('category', e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-9"
                >
                  <option value="">{label('Sem categoria', 'Uncategorized')}</option>
                  {(() => {
                    const typeCats = categories[trans.type] || [];
                    const current = trans.category;
                    const opts = current && !typeCats.includes(current) ? [current, ...typeCats] : typeCats;
                    return opts.map((cat) => <option key={cat} value={cat}>{cat}</option>);
                  })()}
                </select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Investment fields — only when category is investment */}
            {isInvestmentCategory && (
              <>
                <div>
                  {fieldLabel(label('Tipo de investimento', 'Investment type'))}
                  <div className="relative">
                    <select
                      value={trans.investmentType || 'fixed_income'}
                      onChange={(e) => patch('investmentType', e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-9"
                    >
                      {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                        <option key={key} value={key}>
                          {info.icon} {language === 'pt'
                            ? { fixed_income: 'Renda Fixa', stocks: 'Ações', crypto: 'Cripto', funds: 'Fundos', fii: 'FII', etf: 'ETF', other: 'Outro' }[key] || key
                            : key}
                        </option>
                      ))}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Fixed income */}
                {(trans.investmentType === 'fixed_income' || !trans.investmentType) && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      {fieldLabel(label('Rentab. esperada %', 'Expected return %'))}
                      <input
                        type="number"
                        step="0.01"
                        value={trans.expectedReturn || 0}
                        onChange={(e) => patch('expectedReturn', parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex-1">
                      {fieldLabel(label('Vencimento', 'Maturity'))}
                      <input
                        type="date"
                        value={trans.maturityDate || ''}
                        onChange={(e) => patch('maturityDate', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {/* Stocks / ETF / FII */}
                {(trans.investmentType === 'stocks' || trans.investmentType === 'etf' || trans.investmentType === 'fii') && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      {fieldLabel('Ticker')}
                      <input
                        type="text"
                        value={trans.ticker || ''}
                        onChange={(e) => patch('ticker', e.target.value.toUpperCase())}
                        placeholder="PETR4"
                        className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent uppercase"
                      />
                    </div>
                    <div className="flex-1">
                      {fieldLabel(label('Plataforma', 'Platform'))}
                      <input
                        type="text"
                        value={trans.platform || ''}
                        onChange={(e) => patch('platform', e.target.value)}
                        placeholder="XP, Clear..."
                        className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {/* Crypto */}
                {trans.investmentType === 'crypto' && (
                  <div>
                    {fieldLabel(label('Moeda', 'Coin'))}
                    <input
                      type="text"
                      value={trans.coinName || ''}
                      onChange={(e) => patch('coinName', e.target.value)}
                      placeholder="Bitcoin, Ethereum..."
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Funds */}
                {trans.investmentType === 'funds' && (
                  <div>
                    {fieldLabel(label('Nome do fundo', 'Fund name'))}
                    <input
                      type="text"
                      value={trans.fundName || ''}
                      onChange={(e) => patch('fundName', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                )}
              </>
            )}

            {/* Date */}
            <div>
              {fieldLabel(label('Data', 'Date'))}
              <input
                type="date"
                value={trans.date ? trans.date.split('T')[0] : ''}
                onChange={(e) => patch('date', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Goal */}
            {availableGoals.length > 0 && (
              <div>
                {fieldLabel(label('Meta', 'Goal'))}
                <div className="relative">
                  <select
                    value={trans.goalId || ''}
                    onChange={(e) => patch('goalId', e.target.value || null)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-9"
                  >
                    <option value="">{label('Nenhuma', 'None')}</option>
                    {availableGoals.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Planner Goal */}
            {plannerGoals.length > 0 && (
              <div>
                {fieldLabel(label('Meta do planejamento', 'Planner goal'))}
                <div className="relative">
                  <select
                    value={trans.plannerGoalId || ''}
                    onChange={(e) => patch('plannerGoalId', e.target.value || null)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-9"
                  >
                    <option value="">{label('Nenhuma', 'None')}</option>
                    {plannerGoals.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Include toggle */}
            <div className="flex items-center justify-between px-3.5 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {label('Incluir na importação', 'Include in import')}
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

            {/* Ignored toggle */}
            <div className="flex items-center justify-between px-3.5 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {label('Ignorar transação', 'Ignore transaction')}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {label('Não entra nos totais', 'Excluded from totals')}
                </p>
              </div>
              <button
                onClick={() => patch('ignored', !trans.ignored)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  trans.ignored ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    trans.ignored ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

          </div>
        </div>

        {/* Footer — always rendered so scroll area height stays constant */}
        <div className="flex-shrink-0 px-4 py-4 border-t border-gray-100 dark:border-gray-700">
          {isLast ? (
            <button
              onClick={onClose}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all shadow-xl shadow-emerald-600/20"
            >
              {label('Fechar', 'Close')}
            </button>
          ) : (
            <div className="h-14" />
          )}
        </div>
      </div>
    </>
  );
}
