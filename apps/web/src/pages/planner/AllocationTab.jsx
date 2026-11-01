import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAccess } from '@/contexts/AccessContext';
import { useBudget } from '@/contexts/BudgetContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useCards } from '@/contexts/CardsContext';
import useTransactions from '@/hooks/useTransactions';
import { NumericFormat } from 'react-number-format';
import { Badge } from '@/components/ui/badge';
import { formatBRL } from './usePlannerState';

const RULE_LABELS = {
  needs:   { short: 'N', label: 'Necessidades', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  wants:   { short: 'D', label: 'Desejos',      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  savings: { short: 'P', label: 'Poupança',     color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
};

export function InnerTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-[var(--rw-raised)] rounded-xl p-1">
      {tabs.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            active === t.value
              ? 'bg-[var(--rw-raised)] text-violet-600 dark:text-violet-400 shadow-sm'
              : 'text-[var(--rw-muted)] hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function AllocationTab({ onGoToRenda,
  state,
  liquidezFinal,
  necessidadesValue,
  poupancaValue,
  desejosValue,
  monthAllocation,
  updateMonthAllocation,
  resetMonthAllocation,
  selectedMonth,
  categoryBudgetsPct,
  updateCategoryBudgetPct,
  copyFromPreviousMonth,
  innerTab,
  setInnerTab,
}) {
  const { ownerId } = useAccess();
  const { transactions: allTx } = useTransactions({}, { enabled: Boolean(ownerId) });
  const { categories } = useSettings();
  const { calculateCategorySpending, getCategoryRule, setCategoryRule } = useBudget();
  const { getPaymentMonthKey } = useCards();
  const [searchParams, setSearchParams] = useSearchParams();

  const monthTx = useMemo(() => allTx.filter(tx => {
    if (tx.type !== 'expense' || tx.ignored) return false;
    const key = getPaymentMonthKey(tx.date, tx.bankId, tx.paymentMethod);
    return key === selectedMonth;
  }), [allTx, selectedMonth, getPaymentMonthKey]);

  const categorySpending = useMemo(() => calculateCategorySpending(monthTx), [monthTx, calculateCategorySpending]);

  const allCategories = useMemo(() => {
    const registered = categories?.expense ?? [];
    const spending   = Object.keys(categorySpending);
    const budgeted   = Object.keys(categoryBudgetsPct ?? {});
    return [...new Set([...registered, ...spending, ...budgeted])].sort();
  }, [categories?.expense, categorySpending, categoryBudgetsPct]);

  // Allocated R$ per rule bucket
  const allocatedByRule = useMemo(() => {
    const sums = { needs: 0, wants: 0, savings: 0 };
    allCategories.forEach(cat => {
      const pct   = categoryBudgetsPct[cat] ?? 0;
      const value = liquidezFinal * pct / 100;
      const rule  = getCategoryRule(cat);
      if (rule in sums) sums[rule] += value;
    });
    return sums;
  }, [allCategories, categoryBudgetsPct, liquidezFinal, getCategoryRule]);

  const allocationTotal = monthAllocation.necessidades + monthAllocation.poupanca + monthAllocation.desejos;
  const isValid    = allocationTotal === 100;
  const hasOverride = state.plannerVersions?.some(v => v.from === selectedMonth);

  const totalPctAllocatedAcrossCategories = allCategories.reduce((sum, c) => sum + (categoryBudgetsPct[c] ?? 0), 0);
  const totalValueAllocatedAcrossCategories = liquidezFinal * totalPctAllocatedAcrossCategories / 100;
  const remainingBudget = liquidezFinal - totalValueAllocatedAcrossCategories;

  if (liquidezFinal <= 0) {
    return (
      <div className="bg-[var(--rw-surface)] rounded-2xl p-12 shadow-sm border border-[var(--rw-border)] text-center space-y-6">
        <div className="max-w-xs mx-auto">
          <p className="text-[var(--rw-muted)] mb-6">
            Você ainda não definiu sua renda para este mês. Preencha os dados de renda para começar o planejamento.
          </p>
          <button
            onClick={() => onGoToRenda?.()}
            className="w-full px-6 py-3 rounded-xl font-bold bg-violet-600 text-white hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20 active:scale-[0.98]"
          >
            💰 Definir Renda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── MASTER PLAN (70/20/10) ───────────────────────────────────────── */}
      {innerTab === 'regra' && <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isValid && <Badge variant="destructive">Soma: {allocationTotal}%</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('Deseja copiar todos os limites e a regra do mês anterior para este mês?')) {
                  copyFromPreviousMonth();
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--rw-surface)] text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-900/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors shadow-sm"
            >
              📥 Copiar do mês anterior
            </button>
            <button
              onClick={() => {
                if (window.confirm('Tem certeza que deseja resetar a regra 70/20/10 e todos os limites de categorias deste mês para o padrão?')) {
                  resetMonthAllocation();
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--rw-surface)] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm"
            >
              🔄 Resetar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { 
              key: 'necessidades', emoji: '🏠', label: 'Necessidades', ruleKey: 'needs',   
              pct: monthAllocation.necessidades, value: necessidadesValue, allocated: allocatedByRule.needs,   
              sub: 'Fixas / Essenciais', 
              colors: {
                bg: 'bg-blue-50 dark:bg-blue-900/20',
                border: 'border-blue-100 dark:border-blue-800/50',
                text: 'text-blue-700 dark:text-blue-300',
                label: 'text-blue-600 dark:text-blue-400',
                subtext: 'text-blue-400/80',
                slider: 'text-blue-500',
                bar: 'bg-blue-500'
              },
              onChange: v => updateMonthAllocation('necessidades', v) 
            },
            { 
              key: 'poupanca', emoji: '💰', label: 'Poupança', ruleKey: 'savings', 
              pct: monthAllocation.poupanca, value: poupancaValue, allocated: allocatedByRule.savings, 
              sub: 'Investimentos',    
              colors: {
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                border: 'border-emerald-100 dark:border-emerald-800/50',
                text: 'text-emerald-700 dark:text-emerald-300',
                label: 'text-emerald-600 dark:text-emerald-400',
                subtext: 'text-emerald-400/80',
                slider: 'text-emerald-500',
                bar: 'bg-emerald-500'
              },
              onChange: v => updateMonthAllocation('poupanca', v) 
            },
            { 
              key: 'desejos', emoji: '🎯', label: 'Desejos', ruleKey: 'wants',   
              pct: monthAllocation.desejos, value: desejosValue, allocated: allocatedByRule.wants,   
              sub: 'Lazer / Variáveis',  
              colors: {
                bg: 'bg-orange-50 dark:bg-orange-900/20',
                border: 'border-orange-100 dark:border-orange-800/50',
                text: 'text-orange-700 dark:text-orange-300',
                label: 'text-orange-600 dark:text-orange-400',
                subtext: 'text-orange-400/80',
                slider: 'text-orange-500',
                bar: 'bg-orange-500'
              },
              onChange: v => updateMonthAllocation('desejos', v) 
            },
          ].map(({ key, emoji, label, pct, value, allocated, sub, colors, onChange }) => {
            const isOver  = allocated > value;
            const fillPct = value > 0 ? Math.min((allocated / value) * 100, 100) : 0;

            return (
              <div key={key} className={`${colors.bg} rounded-2xl p-4 border ${colors.border} space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold ${colors.label} uppercase tracking-widest`}>{emoji} {label}</span>
                  <span className={`text-lg font-bold tabular-nums ${colors.text}`}>{pct}%</span>
                </div>

                <div className="space-y-1 py-1">
                  <input
                    type="range" min={0} max={100} step={1} value={pct}
                    onChange={e => onChange(Number(e.target.value))}
                    className={`styled-slider ${colors.slider}`}
                    style={{ background: `linear-gradient(to right, currentColor ${pct}%, #1e293b ${pct}%)` }}
                  />
                </div>

                <div>
                  <p className={`text-xl font-bold ${colors.text} tabular-nums`}>
                    {formatBRL.format(value)}
                  </p>
                  <p className={`text-[10px] ${colors.subtext} -mt-0.5`}>{sub}</p>
                </div>

                <div className="pt-2 border-t border-black/5 dark:border-white/5">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-400">Distribuído</span>
                    <span className={`font-bold ${isOver ? 'text-red-500' : colors.label}`}>
                      {formatBRL.format(allocated)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 mb-3">
                    <div
                      className={`h-1.5 rounded-full transition-all ${isOver ? 'bg-red-500' : colors.bar}`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>}

      {/* ── CATEGORY LIMITS ──────────────────────────────────────────────── */}
      {innerTab === 'categorias' && <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <p className="text-xs text-gray-400">Classifique e defina o teto de gastos</p>
          </div>
          <div className="text-right">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
              remainingBudget >= 0 
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {remainingBudget >= 0 ? `Livre: ${formatBRL.format(remainingBudget)}` : `Excedido: ${formatBRL.format(Math.abs(remainingBudget))}`}
            </span>
          </div>
        </div>

        {/* 2-column grid for categories on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allCategories.length === 0 ? (
            <div className="md:col-span-2 py-8 text-center text-sm text-gray-400">
              Nenhuma categoria encontrada.
            </div>
          ) : (
            allCategories.map(category => {
              const pct    = categoryBudgetsPct[category] ?? 0;
              const limit  = liquidezFinal * pct / 100;
              const spent  = categorySpending[category] ?? 0;
              const rule   = getCategoryRule(category);
              const pctUsed = limit > 0 ? (spent / limit) * 100 : 0;

              const barColor  = pctUsed === 0 ? 'bg-[var(--rw-track)]'
                : pctUsed < 80  ? 'bg-emerald-500'
                : pctUsed < 100 ? 'bg-amber-500'
                : 'bg-red-500';
              const textColor = pctUsed === 0 ? 'text-gray-400'
                : pctUsed < 80  ? 'text-emerald-600 dark:text-emerald-400'
                : pctUsed < 100 ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-500';

              return (
                <div key={category} className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)] hover:border-violet-200 dark:hover:border-violet-900/50 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold text-[var(--rw-ink)] flex-1 truncate">{category}</span>
                    <select
                      value={rule ?? ''}
                      onChange={e => setCategoryRule(category, e.target.value)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer ${
                        rule ? RULE_LABELS[rule]?.color : 'bg-[var(--rw-raised)] text-gray-400 border-transparent'
                      }`}
                    >
                      <option value="">— Regra —</option>
                      {Object.entries(RULE_LABELS).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative w-24">
                      <NumericFormat
                        value={pct === 0 ? '' : pct}
                        onValueChange={vals => updateCategoryBudgetPct(category, vals.floatValue ?? 0)}
                        decimalSeparator="," suffix=" %" decimalScale={1} allowNegative={false} placeholder="0 %"
                        className="w-full px-2 py-1.5 rounded-lg border border-[var(--rw-border)] bg-[var(--rw-raised)] text-[var(--rw-ink)] text-xs font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      />
                    </div>
                    {pct > 0 && (
                      <span className="text-xs font-bold text-gray-400 tabular-nums">
                        = {formatBRL.format(limit)}
                      </span>
                    )}
                  </div>

                  {pct > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/50">
                      <div className="flex justify-between text-[10px] mb-1.5">
                        <span className="text-gray-400">Gasto: <span className="font-bold text-[var(--rw-muted)]">{formatBRL.format(spent)}</span></span>
                        <span className={`font-bold ${textColor}`}>{pctUsed.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-[var(--rw-raised)] rounded-full overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.min(pctUsed, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>}
    </div>
  );
}
