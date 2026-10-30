import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import PageHeader from '../components/PageHeader';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export default function CategorySettingsPage() {
  const {
    t,
    language,
    categories,
    allCategories,
    addCategory,
    removeCategory,
    toggleCategory,
  } = useSettings();

  const [expandedType, setExpandedType] = useState('expense');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);

  const getCustomCategories = (type) => {
    return categories[type].filter(cat => !allCategories[type].includes(cat));
  };

  const isProtectedCategory = (cat) => cat === 'Other' || cat === 'Outros';

  const handleAddCategory = async (type) => {
    const value = type === 'expense' ? newExpenseCategory : newIncomeCategory;
    const success = await addCategory(type, value);
    if (success) {
      if (type === 'expense') {
        setNewExpenseCategory('');
        setShowAddExpense(false);
      } else {
        setNewIncomeCategory('');
        setShowAddIncome(false);
      }
    }
  };

  const CategoryToggle = ({ type, category, color }) => {
    const isEnabled = categories[type].includes(category);
    const isProtected = isProtectedCategory(category);
    const colorClasses = color === 'rose'
      ? { bg: 'bg-rose-500', border: 'border-rose-200 dark:border-rose-800', hoverBg: 'hover:bg-rose-50 dark:hover:bg-rose-900/30' }
      : { bg: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800', hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30' };

    return (
      <button
        onClick={() => toggleCategory(type, category)}
        disabled={isProtected && isEnabled}
        className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-all cursor-pointer
          ${isEnabled
            ? `${colorClasses.border} ${colorClasses.hoverBg} bg-white dark:bg-gray-700`
            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800'
          }
          ${isProtected && isEnabled ? 'cursor-not-allowed' : ''}
        `}
      >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors flex-shrink-0
          ${isEnabled ? colorClasses.bg : 'border-2 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700'}`}
        >
          {isEnabled && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className={`text-sm font-medium ${isEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
          {category}
        </span>
        {isProtected && isEnabled && (
          <span className="ml-auto text-xs text-gray-400">
            {language === 'pt' ? 'obrigatório' : 'required'}
          </span>
        )}
      </button>
    );
  };

  const CustomCategoryChip = ({ type, category, color }) => {
    const colorClasses = color === 'rose'
      ? 'bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-200'
      : 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200';

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${colorClasses}`}>
        {category}
        <button
          onClick={() => removeCategory(type, category)}
          className="ml-1 opacity-60 hover:opacity-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    );
  };

  // Called as a function (not <CategorySection />): a nested component remounts on every render and steals input focus.
  const renderCategorySection = ({ type, label, color }) => {
    const isExpanded = expandedType === type;
    const icon = isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setExpandedType(isExpanded ? null : type)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${color === 'rose' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
            <h3 className="font-bold text-gray-900 dark:text-white">{label}</h3>
          </div>
          {icon}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 space-y-4">
            {/* Predefined categories */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {language === 'pt' ? 'Padrão' : 'Default'}
              </p>
              <div className="space-y-2">
                {allCategories[type].map((cat) => (
                  <CategoryToggle key={cat} type={type} category={cat} color={color} />
                ))}
              </div>
            </div>

            {/* Custom categories */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {t('settings.customCategories')}
              </p>

              {getCustomCategories(type).length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {getCustomCategories(type).map((cat) => (
                    <CustomCategoryChip key={cat} type={type} category={cat} color={color} />
                  ))}
                </div>
              ) : !showAddExpense && !showAddIncome && (
                <p className="text-sm text-gray-400 mb-3">{t('settings.noCustomCategories')}</p>
              )}

              {/* Add custom category */}
              {type === 'expense' && showAddExpense ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value)}
                    placeholder={t('settings.categoryPlaceholder')}
                    autoFocus
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-0 focus:border-gray-900 dark:focus:border-gray-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategory('expense');
                      if (e.key === 'Escape') setShowAddExpense(false);
                    }}
                  />
                  <button
                    onClick={() => handleAddCategory('expense')}
                    className="px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600"
                  >
                    {t('common.add')}
                  </button>
                  <button
                    onClick={() => setShowAddExpense(false)}
                    className="px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : type === 'income' && showAddIncome ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIncomeCategory}
                    onChange={(e) => setNewIncomeCategory(e.target.value)}
                    placeholder={t('settings.categoryPlaceholder')}
                    autoFocus
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-0 focus:border-gray-900 dark:focus:border-gray-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategory('income');
                      if (e.key === 'Escape') setShowAddIncome(false);
                    }}
                  />
                  <button
                    onClick={() => handleAddCategory('income')}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600"
                  >
                    {t('common.add')}
                  </button>
                  <button
                    onClick={() => setShowAddIncome(false)}
                    className="px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => type === 'expense' ? setShowAddExpense(true) : setShowAddIncome(true)}
                  className={`flex items-center gap-2 text-sm font-medium ${
                    type === 'expense'
                      ? 'text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300'
                      : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('settings.addCustom')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title={t('settings.categories')} showMonth={false} backTo="/settings" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-4">
        {renderCategorySection({ type: 'expense', label: t('settings.expenseCategories'), color: 'rose' })}
        {renderCategorySection({ type: 'income', label: t('settings.incomeCategories'), color: 'emerald' })}
      </main>
    </div>
  );
}
