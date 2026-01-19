import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { ArrowPathIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { useBudget, RULE_COLORS, DEFAULT_RULE_MAPPING, DEFAULT_RULE_PERCENTAGES } from '../contexts/BudgetContext';
import { useSettings } from '../contexts/SettingsContext';

export default function BudgetPage() {
  const navigate = useNavigate();
  const {
    getBudgetForMonth,
    setAllCategoryBudgets,
    categoryRuleMapping,
    setCategoryRule,
    rulePercentages,
    setRulePercentages,
    autoDistributeBudget,
  } = useBudget();
  const { formatCurrency, t } = useSettings();

  // Get current month in YYYY-MM format
  const currentMonth = new Date().toISOString().slice(0, 7);
  // For now, use mock data - in production this would come from transactions
  const totalIncome = 5000;
  const expenseCategories = ['Food', 'Transport', 'Housing', 'Entertainment', 'Healthcare', 'Education', 'Other'];

  const [selectedTab, setSelectedTab] = useState(0);
  const [categoryBudgets, setCategoryBudgetsLocal] = useState({});
  const [totalBudget, setTotalBudgetLocal] = useState(totalIncome || 0);
  const [localRuleMapping, setLocalRuleMapping] = useState({});
  const [localPercentages, setLocalPercentages] = useState({ needs: 50, wants: 30, savings: 20 });
  const [saving, setSaving] = useState(false);

  // Initialize state when page loads
  useEffect(() => {
    const existingBudget = getBudgetForMonth(currentMonth);
    setCategoryBudgetsLocal(existingBudget?.categoryBudgets || {});
    setTotalBudgetLocal(existingBudget?.totalBudget || totalIncome || 0);
    setLocalRuleMapping({ ...categoryRuleMapping });
    setLocalPercentages({ ...rulePercentages });
  }, [currentMonth, categoryRuleMapping, rulePercentages, totalIncome]);

  const handleAutoDistribute = () => {
    const distributed = autoDistributeBudget(totalBudget, expenseCategories, localRuleMapping);
    setCategoryBudgetsLocal(distributed);
  };

  const handleCategoryBudgetChange = (category, value) => {
    const numValue = parseFloat(value) || 0;
    setCategoryBudgetsLocal(prev => ({
      ...prev,
      [category]: numValue
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
      await setAllCategoryBudgets(currentMonth, categoryBudgets, totalBudget);

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

      navigate('/home');
    } catch (error) {
      console.error('Error saving budget:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    navigate('/home');
  };

  const rules = [
    { key: 'needs', label: t('budget.needs'), percent: localPercentages.needs },
    { key: 'wants', label: t('budget.wants'), percent: localPercentages.wants },
    { key: 'savings', label: t('budget.savings'), percent: localPercentages.savings },
  ];

  const getCategoriesByRule = (rule) => {
    return expenseCategories.filter(cat => (localRuleMapping[cat] || 'wants') === rule);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Page Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-14">
            <button
              onClick={handleClose}
              className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
              {t('budget.budgetSettings')}
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-4 pb-24">
        <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
          <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-700 p-1 mb-4">
            <Tab
              className={({ selected }) =>
                `flex-1 rounded-lg py-2.5 sm:py-2 px-2 text-[11px] leading-tight sm:text-sm font-medium transition-colors flex items-center justify-center gap-1
                ${selected
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <span className="hidden sm:inline">{t('budget.perCategory')}</span>
              <span className="sm:hidden">📊</span>
            </Tab>
            <Tab
              className={({ selected }) =>
                `flex-1 rounded-lg py-2.5 sm:py-2 px-2 text-[11px] leading-tight sm:text-sm font-medium transition-colors flex items-center justify-center gap-1
                ${selected
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <span className="hidden sm:inline">{t('budget.categoryAssignment')}</span>
              <span className="sm:hidden">🏷️</span>
            </Tab>
            <Tab
              className={({ selected }) =>
                `flex-1 rounded-lg py-2.5 sm:py-2 px-2 text-[11px] leading-tight sm:text-sm font-medium transition-colors flex items-center justify-center gap-1
                ${selected
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <AdjustmentsHorizontalIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              <span className="hidden sm:inline">{t('budget.targetPercentages')}</span>
              <span className="sm:hidden text-xs">%</span>
            </Tab>
          </Tab.List>

          <Tab.Panels>
            {/* Per Category Budget Tab */}
            <Tab.Panel className="space-y-4">
              {/* Total Budget Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('budget.totalBudget')}
                </label>
                <input
                  type="number"
                  value={totalBudget}
                  onChange={(e) => setTotalBudgetLocal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Auto-distribute button */}
              <button
                onClick={handleAutoDistribute}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <ArrowPathIcon className="w-4 h-4" />
                {t('budget.autoDistribute')}
              </button>

              {/* Category budgets grouped by assignment */}
              <div className="max-h-64 overflow-y-auto space-y-4">
                {rules.map(({ key, label, percent }) => {
                  const colors = RULE_COLORS[key];
                  const categories = getCategoriesByRule(key);
                  if (categories.length === 0) return null;

                  const groupTotal = categories.reduce((sum, cat) => sum + (categoryBudgets[cat] || 0), 0);
                  const targetAmount = totalBudget * (percent / 100);

                  return (
                    <div key={key} className="space-y-2">
                      {/* Group header */}
                      <div className={`flex items-center justify-between px-2 py-1 rounded ${colors.light}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colors.bg}`} />
                          <span className={`text-sm font-semibold ${colors.text}`}>
                            {label} ({percent}%)
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatCurrency(groupTotal)} / {formatCurrency(targetAmount)}
                        </span>
                      </div>

                      {/* Categories in this group */}
                      <div className="space-y-1 pl-2">
                        {categories.map(category => (
                          <div
                            key={category}
                            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                          >
                            <span className="text-sm text-gray-900 dark:text-white">
                              {category}
                            </span>
                            <input
                              type="number"
                              value={categoryBudgets[category] || ''}
                              onChange={(e) => handleCategoryBudgetChange(category, e.target.value)}
                              placeholder="0"
                              className="w-28 px-2 py-1 text-right text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total summary */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Total Allocated:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(expenseCategories.reduce((sum, cat) => sum + (categoryBudgets[cat] || 0), 0))}
                  </span>
                </div>
              </div>
            </Tab.Panel>

            {/* Category Assignment Tab */}
            <Tab.Panel className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('budget.configureRule')}
              </p>

              {/* Three columns for rules */}
              <div className="grid grid-cols-3 gap-3">
                {rules.map(({ key, label, percent }) => {
                  const colors = RULE_COLORS[key];
                  const categories = getCategoriesByRule(key);
                  return (
                    <div key={key} className={`p-3 rounded-lg ${colors.light} border ${colors.border}`}>
                      <div className="flex items-center gap-1 mb-2">
                        <span className={`w-2 h-2 rounded-full ${colors.bg}`} />
                        <span className={`text-xs font-semibold ${colors.text}`}>
                          {label} ({percent}%)
                        </span>
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {categories.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                            No categories
                          </p>
                        ) : (
                          categories.map(cat => (
                            <div
                              key={cat}
                              className="text-xs text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-700/50 rounded px-2 py-1"
                            >
                              {cat}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Category assignment list */}
              <div className="max-h-48 overflow-y-auto space-y-2">
                {expenseCategories.map(category => {
                  const currentRule = localRuleMapping[category] || 'wants';
                  return (
                    <div
                      key={category}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <span className="text-sm text-gray-900 dark:text-white">{category}</span>
                      <select
                        value={currentRule}
                        onChange={(e) => handleRuleChange(category, e.target.value)}
                        className="text-sm pl-2 pr-8 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {rules.map(({ key, label }) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Reset to defaults */}
              <button
                onClick={handleResetDefaults}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
              >
                {t('budget.resetDefaults')}
              </button>
            </Tab.Panel>

            {/* Target Percentages Tab */}
            <Tab.Panel className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('budget.customizePercentages')}
              </p>

              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                {t('budget.guideline')}
              </p>

              {/* Percentage inputs */}
              <div className="space-y-3">
                {[
                  { key: 'needs', label: t('budget.needs'), emoji: '🏠', default: 50 },
                  { key: 'wants', label: t('budget.wants'), emoji: '🎮', default: 30 },
                  { key: 'savings', label: t('budget.savings'), emoji: '💰', default: 20 },
                ].map(({ key, label, emoji, default: defaultVal }) => {
                  const colors = RULE_COLORS[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between p-3 rounded-lg ${colors.light} border ${colors.border}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{emoji}</span>
                        <span className={`font-medium ${colors.text}`}>{label}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          (default: {defaultVal}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={localPercentages[key]}
                          onChange={(e) => handlePercentageChange(key, e.target.value)}
                          className="w-20 px-2 py-1 text-right text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sum validation */}
              <div className={`p-3 rounded-lg ${isPercentageValid ? 'bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${isPercentageValid ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {t('budget.currentSum')}: {percentageSum}%
                  </span>
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
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
              >
                {t('budget.resetToDefault')}
              </button>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>

        {/* Save button */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
