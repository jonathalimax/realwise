import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { Tab } from '@headlessui/react';
import { ArrowPathIcon, AdjustmentsHorizontalIcon, ArrowLeftIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useBudget, RULE_COLORS, DEFAULT_RULE_MAPPING, DEFAULT_RULE_PERCENTAGES } from '../contexts/BudgetContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useMonth } from '../contexts/MonthContext';
import CurrencyInput from '../components/ui/CurrencyInput';

export default function BudgetPage() {
  const navigate = useNavigate();
  const { ownerId } = useAccess();
  const { selectedMonth } = useMonth();
  const {
    getBudgetForMonth,
    setAllCategoryBudgets,
    categoryRuleMapping,
    setCategoryRule,
    rulePercentages,
    setRulePercentages,
    autoDistributeBudget,
  } = useBudget();
  const { formatCurrency, t, language, categories } = useSettings();

  // Get expense categories from settings
  const expenseCategories = useMemo(() => categories.expense || [], [categories]);

  // Real transactions for calculating income
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!auth.currentUser || !ownerId) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', ownerId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(data);
    });

    return () => unsubscribe();
  }, [ownerId]);

  // Calculate total income for the selected month
  const totalIncome = useMemo(() => {
    return transactions
      .filter(t => {
        if (t.type !== 'income' || t.ignored) return false;
        const date = new Date(t.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return key === selectedMonth;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, selectedMonth]);

  const [selectedTab, setSelectedTab] = useState(0);
  const [categoryBudgets, setCategoryBudgetsLocal] = useState({});
  const [totalBudget, setTotalBudgetLocal] = useState(0);
  const [localRuleMapping, setLocalRuleMapping] = useState({});
  const [localPercentages, setLocalPercentages] = useState({ needs: 50, wants: 30, savings: 20 });
  const [saving, setSaving] = useState(false);

  // Initialize state when page loads or selectedMonth changes
  useEffect(() => {
    const existingBudget = getBudgetForMonth(selectedMonth);
    setCategoryBudgetsLocal(existingBudget?.categoryBudgets || {});
    setTotalBudgetLocal(existingBudget?.totalBudget || totalIncome || 0);
    setLocalRuleMapping({ ...categoryRuleMapping });
    setLocalPercentages({ ...rulePercentages });
  }, [selectedMonth, categoryRuleMapping, rulePercentages, totalIncome]);

  const handleAutoDistribute = () => {
    const distributed = autoDistributeBudget(totalBudget, expenseCategories, localRuleMapping);
    setCategoryBudgetsLocal(distributed);
  };

  // Calculate previous month key
  const getPreviousMonthKey = (monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    if (month === 1) {
      return `${year - 1}-12`;
    }
    return `${year}-${String(month - 1).padStart(2, '0')}`;
  };

  const previousMonth = getPreviousMonthKey(selectedMonth);
  const previousMonthBudget = getBudgetForMonth(previousMonth);

  const handleCopyFromLastMonth = () => {
    if (previousMonthBudget) {
      // Only copy category budgets from previous month
      // Keep total budget as current month's income (don't copy from previous month)
      setCategoryBudgetsLocal(previousMonthBudget.categoryBudgets || {});
      // totalBudget stays as current month's income - no change needed
    }
  };

  const handleCategoryBudgetChange = (category, value) => {
    setCategoryBudgetsLocal(prev => ({
      ...prev,
      [category]: value
    }));
  };

  const handleRuleChange = (category, rule) => {
    setLocalRuleMapping(prev => ({
      ...prev,
      [category]: rule
    }));
  };

  const handleResetDefaults = () => {
    setLocalRuleMapping({ ...DEFAULT_RULE_MAPPING });
  };

  const handlePercentageChange = (key, value) => {
    const numValue = parseInt(value) || 0;
    setLocalPercentages(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(100, numValue))
    }));
  };

  const handleResetPercentages = () => {
    setLocalPercentages({ ...DEFAULT_RULE_PERCENTAGES });
  };

  const percentageSum = localPercentages.needs + localPercentages.wants + localPercentages.savings;
  const isPercentageValid = percentageSum === 100;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save category budgets
      await setAllCategoryBudgets(selectedMonth, categoryBudgets, totalBudget);

      // Save rule mappings for any changes
      for (const [category, rule] of Object.entries(localRuleMapping)) {
        if (categoryRuleMapping[category] !== rule) {
          await setCategoryRule(category, rule);
        }
      }

      // Save custom percentages if valid and changed
      if (isPercentageValid) {
        const hasPercentageChanges =
          localPercentages.needs !== rulePercentages.needs ||
          localPercentages.wants !== rulePercentages.wants ||
          localPercentages.savings !== rulePercentages.savings;

        if (hasPercentageChanges) {
          await setRulePercentages(localPercentages);
        }
      }

      navigate(-1);
    } catch (error) {
      console.error('Error saving budget:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  const rules = [
    { key: 'needs', label: t('budget.needs'), percent: localPercentages.needs },
    { key: 'wants', label: t('budget.wants'), percent: localPercentages.wants },
    { key: 'savings', label: t('budget.savings'), percent: localPercentages.savings },
  ];

  const getCategoriesByRule = (rule) => {
    return expenseCategories.filter(cat => (localRuleMapping[cat] || 'wants') === rule);
  };

  // Format month for display
  const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    const locale = language === 'pt' ? 'pt-BR' : 'en-US';
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Page Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-14 sm:h-16">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {t('budget.budgetSettings')}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 capitalize">
                {getMonthLabel(selectedMonth)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
        {/* Income Summary Card */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-lg mb-6">
          <p className="text-sm text-white/80 mb-1">
            {language === 'pt' ? 'Renda do Mes' : 'Monthly Income'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-white/70 mt-2">
            {language === 'pt' ? 'Este valor e usado como base para o orcamento' : 'This value is used as budget base'}
          </p>
        </div>

        <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
          <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-700 p-1 mb-6">
            <Tab
              className={({ selected }) =>
                `flex-1 rounded-lg py-2.5 sm:py-3 px-2 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5
                ${selected
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <span className="sm:hidden text-base">📊</span>
              <span className="hidden sm:inline">{t('budget.perCategory')}</span>
              <span className="sm:hidden text-[10px]">{language === 'pt' ? 'Valores' : 'Values'}</span>
            </Tab>
            <Tab
              className={({ selected }) =>
                `flex-1 rounded-lg py-2.5 sm:py-3 px-2 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5
                ${selected
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <span className="sm:hidden text-base">🏷️</span>
              <span className="hidden sm:inline">{t('budget.categoryAssignment')}</span>
              <span className="sm:hidden text-[10px]">{language === 'pt' ? 'Categorias' : 'Categories'}</span>
            </Tab>
            <Tab
              className={({ selected }) =>
                `flex-1 rounded-lg py-2.5 sm:py-3 px-2 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5
                ${selected
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <AdjustmentsHorizontalIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('budget.targetPercentages')}</span>
              <span className="sm:hidden text-[10px]">50/30/20</span>
            </Tab>
          </Tab.List>

          <Tab.Panels>
            {/* Per Category Budget Tab */}
            <Tab.Panel className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
                {/* Total Budget Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('budget.totalBudget')}
                  </label>
                  <CurrencyInput
                    value={totalBudget}
                    onChange={(val) => setTotalBudgetLocal(val)}
                  />
                </div>

                {/* Copy from last month button */}
                <button
                  onClick={handleCopyFromLastMonth}
                  disabled={!previousMonthBudget}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors font-medium ${
                    previousMonthBudget
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <DocumentDuplicateIcon className="w-5 h-5" />
                  {previousMonthBudget ? t('budget.copyFromLastMonth') : t('budget.noPreviousMonthData')}
                </button>
              </div>

              {/* Category budgets grouped by assignment */}
              <div className="space-y-4">
                {rules.map(({ key, label, percent }) => {
                  const colors = RULE_COLORS[key];
                  const categories = getCategoriesByRule(key);
                  if (categories.length === 0) return null;

                  const groupTotal = categories.reduce((sum, cat) => sum + (categoryBudgets[cat] || 0), 0);
                  const targetAmount = totalBudget * (percent / 100);

                  return (
                    <div key={key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                      {/* Group header */}
                      <div className={`flex items-center justify-between px-4 py-3 ${colors.light} border-b ${colors.border}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${colors.bg}`} />
                          <span className={`text-sm font-semibold ${colors.text}`}>
                            {label} ({percent}%)
                          </span>
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {formatCurrency(groupTotal)} / {formatCurrency(targetAmount)}
                        </span>
                      </div>

                      {/* Categories in this group */}
                      <div className="p-3 space-y-2">
                        {categories.map(category => (
                          <div
                            key={category}
                            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                          >
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {category}
                            </span>
                            <CurrencyInput
                              value={categoryBudgets[category] || 0}
                              onChange={(val) => handleCategoryBudgetChange(category, val)}
                              className="!w-32 !py-2 !text-sm !text-right"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total summary */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {language === 'pt' ? 'Total Alocado:' : 'Total Allocated:'}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(expenseCategories.reduce((sum, cat) => sum + (categoryBudgets[cat] || 0), 0))}
                  </span>
                </div>
              </div>
            </Tab.Panel>

            {/* Category Assignment Tab */}
            <Tab.Panel className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {t('budget.configureRule')}
                </p>

                {/* Three columns for rules */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
                  {rules.map(({ key, label, percent }) => {
                    const colors = RULE_COLORS[key];
                    const categories = getCategoriesByRule(key);
                    return (
                      <div key={key} className={`p-2 sm:p-3 rounded-xl ${colors.light} border ${colors.border}`}>
                        <div className="flex items-center gap-1 mb-2">
                          <span className={`w-2 h-2 rounded-full ${colors.bg}`} />
                          <span className={`text-[10px] sm:text-xs font-semibold ${colors.text}`}>
                            {label}
                          </span>
                        </div>
                        <p className={`text-lg sm:text-xl font-bold ${colors.text}`}>{percent}%</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {categories.length} {language === 'pt' ? 'cat.' : 'cat.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category assignment list */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {expenseCategories.map(category => {
                    const currentRule = localRuleMapping[category] || 'wants';
                    const currentRuleColors = RULE_COLORS[currentRule];
                    return (
                      <div
                        key={category}
                        className="flex items-center justify-between p-3 sm:p-4"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{category}</span>
                        <select
                          value={currentRule}
                          onChange={(e) => handleRuleChange(category, e.target.value)}
                          className={`text-sm px-3 py-2 rounded-lg border-2 font-medium ${currentRuleColors.border} ${currentRuleColors.light} ${currentRuleColors.text} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                        >
                          {rules.map(({ key, label }) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reset to defaults */}
              <button
                onClick={handleResetDefaults}
                className="w-full py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
              >
                {t('budget.resetDefaults')}
              </button>
            </Tab.Panel>

            {/* Target Percentages Tab */}
            <Tab.Panel className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {t('budget.customizePercentages')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-6">
                  {t('budget.guideline')}
                </p>

                {/* Percentage inputs */}
                <div className="space-y-4">
                  {[
                    { key: 'needs', label: t('budget.needs'), emoji: '🏠', default: 50 },
                    { key: 'wants', label: t('budget.wants'), emoji: '🎮', default: 30 },
                    { key: 'savings', label: t('budget.savings'), emoji: '💰', default: 20 },
                  ].map(({ key, label, emoji, default: defaultVal }) => {
                    const colors = RULE_COLORS[key];
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-3 sm:p-4 rounded-xl ${colors.light} border-2 ${colors.border}`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          {/* Emoji - Hidden on mobile to save space */}
                          <span className="hidden sm:inline text-2xl">{emoji}</span>
                          <div>
                            <span className={`font-semibold text-sm sm:text-base ${colors.text}`}>{label}</span>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                              {language === 'pt' ? 'Padrao' : 'Default'}: {defaultVal}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={localPercentages[key]}
                            onChange={(e) => handlePercentageChange(key, e.target.value)}
                            className="w-20 px-3 py-2 text-right text-lg font-bold rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="text-lg font-medium text-gray-500 dark:text-gray-400">%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sum validation */}
              <div className={`p-4 rounded-xl ${isPercentageValid ? 'bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-800' : 'bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-800'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isPercentageValid ? (
                      <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={`text-sm font-semibold ${isPercentageValid ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {t('budget.currentSum')}: {percentageSum}%
                    </span>
                  </div>
                  {!isPercentageValid && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {t('budget.mustSumTo100')}
                    </span>
                  )}
                </div>
              </div>

              {/* Reset to 50/30/20 */}
              <button
                onClick={handleResetPercentages}
                className="w-full py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
              >
                {t('budget.resetToDefault')}
              </button>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>

        {/* Save button - Fixed at bottom on mobile */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 sm:relative sm:mt-6 sm:p-0 sm:bg-transparent sm:border-0">
          <div className="max-w-3xl mx-auto flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/25"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
