import { useState, useEffect } from 'react';
import { useSettings, CURRENCIES } from '../contexts/SettingsContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

  // Access control state
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [savingEmails, setSavingEmails] = useState(false);

  // Load allowed emails when Access tab is opened
  useEffect(() => {
    if (activeTab === 'access' && isOpen) {
      loadAllowedEmails();
    }
  }, [activeTab, isOpen]);

  const loadAllowedEmails = async () => {
    setLoadingEmails(true);
    try {
      const accessDoc = await getDoc(doc(db, 'access', 'allowed_emails'));
      if (accessDoc.exists()) {
        setAllowedEmails(accessDoc.data().emails || []);
      } else {
        setAllowedEmails([]);
      }
    } catch (err) {
      console.error('Error loading allowed emails:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  const saveAllowedEmails = async (emails) => {
    setSavingEmails(true);
    try {
      await setDoc(doc(db, 'access', 'allowed_emails'), { emails });
      setAllowedEmails(emails);
    } catch (err) {
      console.error('Error saving allowed emails:', err);
      setEmailError(language === 'pt' ? 'Erro ao salvar' : 'Error saving');
    } finally {
      setSavingEmails(false);
    }
  };

  const handleAddEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError(language === 'pt' ? 'Email inválido' : 'Invalid email');
      return;
    }

    if (allowedEmails.includes(email)) {
      setEmailError(language === 'pt' ? 'Email já existe' : 'Email already exists');
      return;
    }

    const newEmails = [...allowedEmails, email];
    await saveAllowedEmails(newEmails);
    setNewEmail('');
    setEmailError('');
  };

  const handleRemoveEmail = async (email) => {
    const newEmails = allowedEmails.filter(e => e !== email);
    await saveAllowedEmails(newEmails);
  };

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

        <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('language')}
            className={`flex-1 min-w-[70px] py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'language'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('settings.language')}
          </button>
          <button
            onClick={() => setActiveTab('currency')}
            className={`flex-1 min-w-[70px] py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'currency'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('settings.currency')}
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 min-w-[70px] py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'categories'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('settings.categories')}
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={`flex-1 min-w-[70px] py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'access'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {language === 'pt' ? 'Acesso' : 'Access'}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
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

          {activeTab === 'access' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {language === 'pt' ? 'Controle de Acesso' : 'Access Control'}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      {language === 'pt'
                        ? 'Apenas emails nesta lista poderão fazer login. Se a lista estiver vazia, qualquer pessoa pode entrar.'
                        : 'Only emails in this list can log in. If the list is empty, anyone can sign in.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Add new email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Adicionar email autorizado' : 'Add authorized email'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      setEmailError('');
                    }}
                    placeholder="email@example.com"
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-0 focus:border-gray-900 dark:focus:border-gray-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddEmail();
                    }}
                  />
                  <button
                    onClick={handleAddEmail}
                    disabled={savingEmails || !newEmail.trim()}
                    className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
                  >
                    {savingEmails ? (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      language === 'pt' ? 'Adicionar' : 'Add'
                    )}
                  </button>
                </div>
                {emailError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{emailError}</p>
                )}
              </div>

              {/* Email list */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Emails autorizados' : 'Authorized emails'}
                  <span className="text-gray-400 font-normal ml-1">({allowedEmails.length})</span>
                </label>

                {loadingEmails ? (
                  <div className="flex items-center justify-center py-8">
                    <svg className="animate-spin w-6 h-6 text-gray-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                ) : allowedEmails.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">
                      {language === 'pt' ? 'Nenhum email cadastrado' : 'No emails registered'}
                    </p>
                    <p className="text-xs mt-1">
                      {language === 'pt' ? 'Qualquer pessoa pode fazer login' : 'Anyone can sign in'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {allowedEmails.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl group"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                          </svg>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{email}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveEmail(email)}
                          disabled={savingEmails}
                          className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
