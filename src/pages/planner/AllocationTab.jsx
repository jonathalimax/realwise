import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useBudget } from '@/contexts/BudgetContext';
import { useSettings } from '@/contexts/SettingsContext';
import { NumericFormat } from 'react-number-format';
import { Badge } from '@/components/ui/badge';
import { formatBRL } from './usePlannerState';
import SpendingChart from '@/components/charts/SpendingChart';
import CategoryTrendChart from './CategoryTrendChart';

// ── Rule labels for category classification ───────────────────────────────────
const RULE_LABELS = {
  needs:   { label: '🏠 Necessidades', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  wants:   { label: '🎯 Desejos',       color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  savings: { label: '💰 Poupança',      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
};

function AllocationSlider({ label, emoji, value, onChange, colorClass }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{emoji} {label}</span>
        <span className={`text-lg font-bold tabular-nums ${colorClass}`}>{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-gray-200 dark:[&::-webkit-slider-runnable-track]:bg-gray-600 [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-gray-200 dark:[&::-moz-range-track]:bg-gray-600"
      />
    </div>
  );
}

function BudgetProgressBar({ pct, colorClass }) {
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all duration-300 ${colorClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function CategoryBudgetRow({ cat, liquidezFinal, updateCategoryBudget }) {
  const computedValue = cat.mode === 'pct' ? liquidezFinal * (cat.pct / 100) : cat.value;
  const computedPct   = cat.mode === 'value' && liquidezFinal > 0 ? (cat.value / liquidezFinal) * 100 : cat.pct;

  return (
    <div className="flex items-center gap-3 py-3 border-t border-gray-100 dark:border-gray-700 first:border-t-0">
      <span className="text-xl shrink-0">{cat.emoji}</span>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-28 shrink-0">{cat.label}</span>

      <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden shrink-0">
        {['pct', 'value'].map(m => (
          <button
            key={m}
            onClick={() => updateCategoryBudget(cat.id, 'mode', m)}
            className={`px-2 py-1 text-xs font-semibold transition-colors ${
              cat.mode === m
                ? 'bg-violet-600 text-white'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            {m === 'pct' ? '%' : 'R$'}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {cat.mode === 'pct' ? (
          <NumericFormat
            value={cat.pct}
            onValueChange={vals => updateCategoryBudget(cat.id, 'pct', vals.floatValue ?? 0)}
            decimalSeparator="," suffix=" %" decimalScale={1} allowNegative={false}
            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        ) : (
          <NumericFormat
            value={cat.value === 0 ? '' : cat.value}
            onValueChange={vals => updateCategoryBudget(cat.id, 'value', vals.floatValue ?? 0)}
            thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} allowNegative={false} placeholder="R$ 0,00"
            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        )}
      </div>

      <div className="text-right shrink-0 w-28">
        <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{formatBRL.format(computedValue)}</p>
        <p className="text-xs text-gray-400 tabular-nums">{computedPct.toFixed(1)}% da liquidez</p>
      </div>
    </div>
  );
}

// ── Inner tab pill bar ────────────────────────────────────────────────────────
function InnerTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
      {tabs.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            active === t.value
              ? 'bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function AllocationTab({
  state,
  liquidezFinal,
  necessidadesValue,
  poupancaValue,
  desejosValue,
  monthAllocation,
  updateMonthAllocation,
  resetMonthAllocation,
  selectedMonth,
  updateCategoryBudget,
}) {
  const { ownerId } = useAccess();
  const { categories } = useSettings();
  const {
    getTemplateBudget,
    setTemplateCategoryBudget,
    calculateCategorySpending,
    getBudgetStatus,
    getStatusColor,
    getCategoryRule,
    setCategoryRule,
  } = useBudget();

  const [activeTab, setActiveTab] = useState('regra');
  const [allTx, setAllTx] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', ownerId));
    const unsub = onSnapshot(q, snap => {
      setAllTx(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingTx(false);
    });
    return unsub;
  }, [ownerId]);

  const monthTx = useMemo(() => allTx.filter(tx => {
    if (tx.type !== 'expense' || tx.ignored) return false;
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return key === selectedMonth;
  }), [allTx, selectedMonth]);

  const last6Months = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${selectedMonth}-01`);
    d.setMonth(d.getMonth() - (5 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }), [selectedMonth]);

  const templateBudget = getTemplateBudget();
  const categorySpending = useMemo(() => calculateCategorySpending(monthTx), [monthTx, calculateCategorySpending]);

  const allocatedByRule = useMemo(() => {
    const limits = templateBudget?.categoryBudgets ?? {};
    const sums = { needs: 0, wants: 0, savings: 0 };
    Object.entries(limits).forEach(([cat, amount]) => {
      const rule = getCategoryRule(cat);
      if (rule in sums) sums[rule] += amount ?? 0;
    });
    return sums;
  }, [templateBudget, getCategoryRule]);

  const allCategories = useMemo(() => {
    const registeredCats = categories?.expense ?? [];
    const templateCats = templateBudget ? Object.keys(templateBudget.categoryBudgets || {}) : [];
    const spendingCats = Object.keys(categorySpending);
    return [...new Set([...registeredCats, ...spendingCats, ...templateCats])].sort();
  }, [categories?.expense, categorySpending, templateBudget]);

  const allocationTotal = monthAllocation.necessidades + monthAllocation.poupanca + monthAllocation.desejos;
  const isValid = allocationTotal === 100;
  const hasOverride = !!state.allocationOverrides?.[selectedMonth];

  const categoryBudgets = state.categoryBudgets ?? [];
  const totalCategoryValue = categoryBudgets.reduce((sum, c) =>
    sum + (c.mode === 'pct' ? liquidezFinal * (c.pct / 100) : c.value), 0);
  const totalCategoryPct = liquidezFinal > 0 ? (totalCategoryValue / liquidezFinal) * 100 : 0;
  const remaining = liquidezFinal - totalCategoryValue;

  if (liquidezFinal <= 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <p className="text-gray-500 dark:text-gray-400">Preencha o Dashboard Financeiro para ver a alocação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <InnerTabs
        tabs={[
          { value: 'regra',        label: 'Regra' },
          { value: 'rastreamento', label: 'Rastreamento' },
          { value: 'limite',       label: 'Limite' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* ── REGRA ──────────────────────────────────────────────────────────── */}
      {activeTab === 'regra' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Regra 64/28/8</h3>
              {isValid
                ? <Badge variant="default">✓ 100%</Badge>
                : <Badge variant="destructive">Soma: {allocationTotal}% (deve ser 100%)</Badge>}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {hasOverride ? `Personalizado para ${selectedMonth}` : `Padrão global — ajuste para personalizar ${selectedMonth}`}
            </p>
            <div className="space-y-5">
              <AllocationSlider label="Necessidades"          emoji="🏠" value={monthAllocation.necessidades} onChange={v => updateMonthAllocation('necessidades', v)} colorClass="text-blue-600 dark:text-blue-400" />
              <AllocationSlider label="Poupança / Investimentos" emoji="💰" value={monthAllocation.poupanca}     onChange={v => updateMonthAllocation('poupanca', v)}     colorClass="text-emerald-600 dark:text-emerald-400" />
              <AllocationSlider label="Desejos / Lazer"       emoji="🎯" value={monthAllocation.desejos}       onChange={v => updateMonthAllocation('desejos', v)}       colorClass="text-orange-500 dark:text-orange-400" />
            </div>
            {hasOverride && (
              <button onClick={resetMonthAllocation} className="mt-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">
                Resetar para padrão global
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Necessidades', emoji: '🏠', pct: monthAllocation.necessidades, value: necessidadesValue, sub: 'Moradia, alimentação, contas', theme: 'blue' },
              { label: 'Poupança',     emoji: '💰', pct: monthAllocation.poupanca,     value: poupancaValue,     sub: 'Reserva + investimentos',    theme: 'emerald' },
              { label: 'Desejos',      emoji: '🎯', pct: monthAllocation.desejos,       value: desejosValue,       sub: 'Lazer, viagens, extras',     theme: 'orange' },
            ].map(({ label, emoji, pct, value, sub, theme }) => (
              <div key={label} className={`bg-${theme}-50 dark:bg-${theme}-900/20 rounded-2xl p-4 border border-${theme}-100 dark:border-${theme}-800`}>
                <p className={`text-xs font-semibold text-${theme}-500 uppercase tracking-wide mb-1`}>{emoji} {label} ({pct}%)</p>
                <p className={`text-xl font-bold text-${theme}-700 dark:text-${theme}-300 tabular-nums`}>{formatBRL.format(value)}</p>
                <p className={`text-xs text-${theme}-400 mt-1`}>{sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">Liquidez Total — {selectedMonth}</span>
              <span className="text-base font-bold text-violet-600 dark:text-violet-400 tabular-nums">{formatBRL.format(liquidezFinal)}</span>
            </div>
            {!isValid && <p className="text-xs text-red-500 mt-2">Ajuste os controles acima para que a soma seja exatamente 100%.</p>}
          </div>
        </div>
      )}

      {/* ── RASTREAMENTO ───────────────────────────────────────────────────── */}
      {activeTab === 'rastreamento' && (
        <div className="space-y-4">
          {loadingTx ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <SpendingChart transactions={monthTx} />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Tendência — últimos 6 meses por categoria
                </h3>
                <CategoryTrendChart allTx={allTx} last6Months={last6Months} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── LIMITE ─────────────────────────────────────────────────────────── */}
      {activeTab === 'limite' && (
        <div className="space-y-4">
          {/* Category budget allocation */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Orçamento por Categoria</h3>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                Math.abs(remaining) < 1
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : remaining < 0
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              }`}>
                {remaining >= 0 ? 'Sobra ' : 'Excede '}{formatBRL.format(Math.abs(remaining))}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Defina % ou R$ fixo — liquidez: {formatBRL.format(liquidezFinal)}</p>
            <div>
              {categoryBudgets.map(cat => (
                <CategoryBudgetRow key={cat.id} cat={cat} liquidezFinal={liquidezFinal} updateCategoryBudget={updateCategoryBudget} />
              ))}
            </div>
            <div className="mt-4 pt-3 border-t-2 border-violet-500">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total alocado ({totalCategoryPct.toFixed(1)}%)</span>
                <span className="text-sm font-bold tabular-nums text-violet-600 dark:text-violet-400">{formatBRL.format(totalCategoryValue)}</span>
              </div>
              <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${totalCategoryValue > liquidezFinal ? 'bg-red-500' : 'bg-violet-500'}`}
                  style={{ width: `${Math.min(100, (totalCategoryValue / liquidezFinal) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Allocation reference */}
          {liquidezFinal > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Referência de alocação — {selectedMonth}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Necessidades', emoji: '🏠', target: necessidadesValue, allocated: allocatedByRule.needs,
                    theme: { card: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800', title: 'text-blue-500', amount: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-200 dark:bg-blue-800', fill: 'bg-blue-500', sub: 'text-blue-400', free: 'text-blue-600 dark:text-blue-300' } },
                  { label: 'Desejos',       emoji: '🎯', target: desejosValue,      allocated: allocatedByRule.wants,
                    theme: { card: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', title: 'text-orange-500', amount: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-200 dark:bg-orange-800', fill: 'bg-orange-500', sub: 'text-orange-400', free: 'text-orange-600 dark:text-orange-300' } },
                  { label: 'Poupança',      emoji: '💰', target: poupancaValue,     allocated: allocatedByRule.savings,
                    theme: { card: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800', title: 'text-emerald-500', amount: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-200 dark:bg-emerald-800', fill: 'bg-emerald-500', sub: 'text-emerald-400', free: 'text-emerald-600 dark:text-emerald-300' } },
                ].map(({ label, emoji, target, allocated, theme }) => {
                  const free = target - allocated;
                  const isOver = allocated > target;
                  const allocPct = target > 0 ? Math.min((allocated / target) * 100, 100) : 0;
                  return (
                    <div key={label} className={`rounded-xl p-3 border ${theme.card}`}>
                      <p className={`text-xs font-semibold mb-0.5 ${theme.title}`}>{emoji} {label}</p>
                      <p className={`text-base font-bold tabular-nums ${theme.amount}`}>{formatBRL.format(target)}</p>
                      <div className={`w-full h-1 rounded-full mt-2 mb-1.5 ${theme.bar}`}>
                        <div className={`h-1 rounded-full transition-all ${isOver ? 'bg-rose-500' : theme.fill}`} style={{ width: `${allocPct}%` }} />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className={theme.sub}>Definido</span>
                          <span className={`tabular-nums font-medium ${isOver ? 'text-rose-500' : theme.sub}`}>{formatBRL.format(allocated)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className={theme.sub}>Livre</span>
                          <span className={`tabular-nums font-semibold ${isOver ? 'text-rose-500' : theme.free}`}>{isOver ? '−' : ''}{formatBRL.format(Math.abs(free))}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-category spending limits */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Limites & Classificação</h3>
              <p className="text-xs text-gray-400 mt-0.5">Limites recorrentes para todos os meses. Classifique cada categoria.</p>
            </div>
            {allCategories.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                Nenhuma categoria registrada. Adicione categorias nas Configurações.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {allCategories.map(category => {
                  const spent = categorySpending[category] ?? 0;
                  const limit = templateBudget?.categoryBudgets?.[category] ?? 0;
                  const rule  = getCategoryRule(category);
                  const status = getBudgetStatus(spent, limit);
                  const colors = getStatusColor(status);
                  const pct   = limit > 0 ? (spent / limit) * 100 : 0;
                  return (
                    <div key={category} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 truncate flex-1">{category}</span>
                        <div className="flex gap-1">
                          {Object.entries(RULE_LABELS).map(([key, { label, color }]) => (
                            <button
                              key={key}
                              onClick={() => setCategoryRule(category, key)}
                              className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${rule === key ? color : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 w-24 shrink-0">{formatBRL.format(spent)} gasto</span>
                        <span className="text-gray-300 dark:text-gray-600 text-xs">/</span>
                        <NumericFormat
                          value={limit === 0 ? '' : limit}
                          onValueChange={vals => setTemplateCategoryBudget(category, vals.floatValue ?? 0)}
                          thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={0} allowNegative={false} placeholder="sem limite"
                          className="w-28 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        {limit > 0 && (
                          <>
                            <div className="flex-1"><BudgetProgressBar pct={pct} colorClass={colors.bg} /></div>
                            <span className={`text-xs font-semibold tabular-nums w-10 text-right shrink-0 ${colors.text}`}>{pct.toFixed(0)}%</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
