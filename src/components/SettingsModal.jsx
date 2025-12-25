import { useState } from 'react';
import { useSettings, CURRENCIES } from '../contexts/SettingsContext';

export default function SettingsModal({ isOpen, onClose }) {
  const {
    currency,
    updateCurrency,
    language,
    languages,
    updateLanguage,
    categories,
    allCategories,
    addCategory,
    removeCategory,
    toggleCategory,
    t
  } = useSettings();
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [activeTab, setActiveTab] = useState('language');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);

  if (!isOpen) return null;

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

  // Get custom categories (ones not in predefined list)
  const getCustomCategories = (type) => {
    return categories[type].filter(cat => !allCategories[type].includes(cat));
  };

  const isProtectedCategory = (cat) => cat === 'Other' || cat === 'Outros';

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('language')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              activeTab === 'language'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('settings.language')}
          </button>
          <button
            onClick={() => setActiveTab('currency')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              activeTab === 'currency'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('settings.currency')}
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              activeTab === 'categories'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('settings.categories')}
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === 'language' && (
            <div className="space-y-3">
              {Object.entries(languages).map(([code, { name }]) => (
                <button
                  key={code}
                  onClick={() => updateLanguage(code)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                    language === code
                      ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {code === 'en' ? '🇺🇸' : '🇧🇷'}
                    </span>
                    <div className="text-left">
                      <p className="font-medium text-gray-800 dark:text-white">{name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{code.toUpperCase()}</p>
                    </div>
                  </div>
                  {language === code && (
                    <svg className="w-5 h-5 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'currency' && (
            <div className="space-y-3">
              {Object.entries(CURRENCIES).map(([code, { symbol, name }]) => (
                <button
                  key={code}
                  onClick={() => updateCurrency(code)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                    currency === code
                      ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">{symbol}</span>
                    <div className="text-left">
                      <p className="font-medium text-gray-800 dark:text-white">{code}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{name}</p>
                    </div>
                  </div>
                  {currency === code && (
                    <svg className="w-5 h-5 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-8">
              {/* Expense Categories */}
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                  {t('settings.expenseCategories')}
                </h3>

                {/* Predefined categories */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {allCategories.expense.map((cat) => (
                    <CategoryToggle key={cat} type="expense" category={cat} color="rose" />
                  ))}
                </div>

                {/* Custom categories */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {t('settings.customCategories')}
                  </p>

                  {getCustomCategories('expense').length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {getCustomCategories('expense').map((cat) => (
                        <CustomCategoryChip key={cat} type="expense" category={cat} color="rose" />
                      ))}
                    </div>
                  ) : !showAddExpense && (
                    <p className="text-sm text-gray-400 mb-3">{t('settings.noCustomCategories')}</p>
                  )}

                  {showAddExpense ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newExpenseCategory}
                        onChange={(e) => setNewExpenseCategory(e.target.value)}
                        placeholder={t('settings.categoryPlaceholder')}
                        autoFocus
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-0 focus:border-gray-900 dark:focus:border-gray-500 focus:outline-none"
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
                  ) : (
                    <button
                      onClick={() => setShowAddExpense(true)}
                      className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('settings.addCustom')}
                    </button>
                  )}
                </div>
              </div>

              {/* Income Categories */}
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  {t('settings.incomeCategories')}
                </h3>

                {/* Predefined categories */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {allCategories.income.map((cat) => (
                    <CategoryToggle key={cat} type="income" category={cat} color="emerald" />
                  ))}
                </div>

                {/* Custom categories */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {t('settings.customCategories')}
                  </p>

                  {getCustomCategories('income').length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {getCustomCategories('income').map((cat) => (
                        <CustomCategoryChip key={cat} type="income" category={cat} color="emerald" />
                      ))}
                    </div>
                  ) : !showAddIncome && (
                    <p className="text-sm text-gray-400 mb-3">{t('settings.noCustomCategories')}</p>
                  )}

                  {showAddIncome ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newIncomeCategory}
                        onChange={(e) => setNewIncomeCategory(e.target.value)}
                        placeholder={t('settings.categoryPlaceholder')}
                        autoFocus
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-0 focus:border-gray-900 dark:focus:border-gray-500 focus:outline-none"
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
                      onClick={() => setShowAddIncome(true)}
                      className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('settings.addCustom')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition"
          >
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
