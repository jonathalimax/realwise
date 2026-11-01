import { UNCATEGORIZED_CATEGORY } from '../../contexts/SettingsContext';
import CurrencyInput from '../ui/CurrencyInput';
import { INVESTMENT_TYPES } from '../../contexts/InvestmentContext';

/**
 * Shared transaction field body used by both the import swipe sheet and the
 * single-transaction edit modal. Controlled component:
 *   - `value` is the transaction/draft object
 *   - `onChange(field, value)` patches a single field
 * It renders description, amount, type, payment method, date, category,
 * investment fields, and goal/planner-goal selectors. It does NOT render the
 * import status control (import-only) or save/delete UI (parent-owned).
 */
export default function TransactionFields({
  value: trans,
  onChange: patch,
  categories,
  availableGoals = [],
  plannerGoals = [],
  language,
  isCreditCard = false,
  // formatCurrency is accepted for API parity with the import card; not used here.
  // eslint-disable-next-line no-unused-vars
  formatCurrency,
}) {
  const label = (pt, en) => (language === 'pt' ? pt : en);

  const fieldLabel = (text) => (
    <label className="block text-[10px] font-black text-[var(--rw-muted)] uppercase tracking-widest mb-1">
      {text}
    </label>
  );

  const typeLabel = (type) =>
    type === 'income'
      ? language === 'pt' ? 'ENTRADA' : 'INCOME'
      : language === 'pt' ? 'SAÍDA' : 'EXPENSE';

  const isInvestmentCategory =
    trans.category === 'Investimentos' || trans.category === 'Investments';

  return (
    <div className="flex flex-col gap-3">

      {/* Description */}
      <div>
        {fieldLabel(label('Descrição', 'Description'))}
        <input
          type="text"
          value={trans.description}
          onChange={(e) => patch('description', e.target.value)}
          className="w-full px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm text-[var(--rw-ink)] font-medium focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
        />
      </div>

      {/* Amount + Type (type hidden for credit card) */}
      <div className="flex gap-3">
        <div className="flex-1">
          {fieldLabel(label('Valor', 'Amount'))}
          <CurrencyInput
            value={trans.amount}
            onChange={(v) => patch('amount', v)}
            className="!py-0 !text-sm font-bold !rounded-xl !focus:border-violet-500"
            style={{ height: '42px' }}
          />
        </div>
        {!isCreditCard && (
          <div className="flex-1">
            {fieldLabel(label('Tipo', 'Type'))}
            <div className="flex p-0.5 bg-[var(--rw-raised)] rounded-xl gap-0.5 overflow-hidden" style={{ height: '42px' }}>
              <button
                onClick={() => patch('type', 'expense')}
                className={`flex-1 h-full text-[11px] font-black rounded-[10px] transition-all ${
                  trans.type === 'expense'
                    ? 'bg-[var(--rw-raised)] shadow-sm text-[var(--rw-ink)]'
                    : 'text-gray-400'
                }`}
              >
                {typeLabel('expense')}
              </button>
              <button
                onClick={() => patch('type', 'income')}
                className={`flex-1 h-full text-[11px] font-black rounded-[10px] transition-all ${
                  trans.type === 'income'
                    ? 'bg-[var(--rw-raised)] shadow-sm text-[var(--rw-ink)]'
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
          <div className="flex p-0.5 bg-[var(--rw-raised)] rounded-xl gap-0.5 overflow-hidden" style={{ height: '42px' }}>
            {[
              { value: 'debit', label: label('Débito', 'Debit') },
              { value: 'pix', label: 'PIX' },
              { value: 'boleto', label: 'Boleto' },
            ].map(({ value, label: lbl }) => (
              <button
                key={value}
                onClick={() => patch('paymentMethod', value)}
                className={`flex-1 h-full text-[10px] font-black rounded-[10px] transition-all ${
                  (trans.paymentMethod || 'debit') === value
                    ? 'bg-[var(--rw-raised)] shadow-sm text-[var(--rw-ink)]'
                    : 'text-gray-400'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date */}
      <div>
        {fieldLabel(label('Data', 'Date'))}
        <input
          type="date"
          value={trans.date ? trans.date.split('T')[0] : ''}
          onChange={(e) => patch('date', e.target.value)}
          className="w-full px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-medium text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
        />
      </div>

      {/* Category */}
      <div>
        {fieldLabel(label('Categoria', 'Category'))}
        <div className="relative">
          <select
            value={trans.category || ''}
            onChange={(e) => patch('category', e.target.value)}
            className="w-full appearance-none px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-bold text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent pr-9"
          >
            {(() => {
              const uncatName = UNCATEGORIZED_CATEGORY[language] || UNCATEGORIZED_CATEGORY.pt;
              const all = categories[trans.type] || [];
              const uncatEntry = all.find(c => c === uncatName);
              const rest = all.filter(c => c !== uncatName).sort((a, b) => a.localeCompare(b));
              const current = trans.category;
              const extras = current && current !== uncatName && !rest.includes(current) ? [current] : [];
              return (<>
                {uncatEntry && <option value={uncatEntry}>{uncatEntry}</option>}
                {uncatEntry && <optgroup label="──────────────" />}
                {[...extras, ...rest].map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </>);
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
                className="w-full appearance-none px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-bold text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent pr-9"
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
                  className="w-full px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-bold text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                {fieldLabel(label('Vencimento', 'Maturity'))}
                <input
                  type="date"
                  value={trans.maturityDate || ''}
                  onChange={(e) => patch('maturityDate', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-medium text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
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
                  className="w-full px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-bold text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent uppercase"
                />
              </div>
              <div className="flex-1">
                {fieldLabel(label('Plataforma', 'Platform'))}
                <input
                  type="text"
                  value={trans.platform || ''}
                  onChange={(e) => patch('platform', e.target.value)}
                  placeholder="XP, Clear..."
                  className="w-full px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-medium text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
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
                className="w-full px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-medium text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
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
                className="w-full px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-medium text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
              />
            </div>
          )}
        </>
      )}

      {/* Goal */}
      {availableGoals.length > 0 && (
        <div>
          {fieldLabel(label('Meta', 'Goal'))}
          <div className="relative">
            <select
              value={trans.goalId || ''}
              onChange={(e) => patch('goalId', e.target.value || null)}
              className="w-full appearance-none px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-medium text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent pr-9"
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
              className="w-full appearance-none px-3.5 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-sm font-medium text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent pr-9"
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

    </div>
  );
}
