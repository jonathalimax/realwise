import { useState, useEffect } from 'react';
import { useSettings, CURRENCIES } from '../contexts/SettingsContext';
import { OWNER_EMAIL, useAccess } from '../contexts/AccessContext';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import InstallPWAButton from '../components/ui/InstallPWAButton';
import { checkAIQuota } from '../services/aiCategorizationService';

export default function SettingsPage() {
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
    geminiApiKey,
    updateGeminiApiKey,
    billReminders,
    updateBillReminders,
    t
  } = useSettings();
  const { ownerId } = useAccess();

  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [activeTab, setActiveTab] = useState('categories');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);

  // AI Settings
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiQuota, setAiQuota] = useState({ used: 0, remaining: 950 });
  const [savingApiKey, setSavingApiKey] = useState(false);

  // Access control state
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [savingEmails, setSavingEmails] = useState(false);

  // Load allowed emails when Access tab is opened
  useEffect(() => {
    if (activeTab === 'access') {
      loadAllowedEmails();
    }
  }, [activeTab]);

  // Load AI quota and API key
  useEffect(() => {
    if (geminiApiKey) {
      setApiKeyInput(geminiApiKey);
    }
    if (ownerId) {
      checkAIQuota(ownerId).then(setAiQuota);
    }
  }, [geminiApiKey, ownerId]);

  const loadAllowedEmails = async () => {
    setLoadingEmails(true);
    try {
      const accessDoc = await getDoc(doc(db, 'access', 'allowed_emails'));
      if (accessDoc.exists()) {
        const data = accessDoc.data();
        const emails = data.emails || [];
        const existingOwnerId = data.ownerId || null;

        if (emails.length > 0 && typeof emails[0] === 'string') {
          // Convert old format (array of strings) to new format (array of objects)
          const converted = emails.map(email => ({ email, role: 'write' }));
          await saveAllowedEmails(converted, existingOwnerId);
          setAllowedEmails(converted);
        } else {
          // If ownerId is missing and current user is owner, save it now
          const currentUserEmail = auth.currentUser?.email?.toLowerCase();
          const isCurrentUserOwner = currentUserEmail === OWNER_EMAIL;
          if (!existingOwnerId && emails.length > 0 && isCurrentUserOwner) {
            await saveAllowedEmails(emails, null);
          }
          setAllowedEmails(emails);
        }
      } else {
        setAllowedEmails([]);
      }
    } catch (err) {
      console.error('Error loading allowed emails:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  const saveAllowedEmails = async (emails, existingOwnerId = null) => {
    setSavingEmails(true);
    try {
      // Create simplified lists for Firestore rules (lowercase for case-insensitive matching)
      const allowedEmailsList = emails.map(e => e.email.toLowerCase());
      const writeEmailsList = emails.filter(e => e.role === 'write').map(e => e.email.toLowerCase());

      // Preserve the original owner's UID - only set if not already set
      // This prevents shared users from overwriting the ownerId when they modify the list
      const currentUserEmail = auth.currentUser.email?.toLowerCase();
      const isCurrentUserOwner = currentUserEmail === OWNER_EMAIL;
      const ownerUid = isCurrentUserOwner ? auth.currentUser.uid : (existingOwnerId || ownerId);

      await setDoc(doc(db, 'access', 'allowed_emails'), {
        emails,
        ownerId: ownerUid,
        // Simplified lists for Firestore security rules
        allowedEmailsList,
        writeEmailsList
      });
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError(language === 'pt' ? 'Email inválido' : 'Invalid email');
      return;
    }

    if (allowedEmails.some(e => e.email === email)) {
      setEmailError(language === 'pt' ? 'Email já existe' : 'Email already exists');
      return;
    }

    // Always add with write access by default - can be changed later
    const newEmails = [...allowedEmails, { email, role: 'write' }];
    await saveAllowedEmails(newEmails);
    setNewEmail('');
    setEmailError('');
  };

  const handleRemoveEmail = async (email) => {
    const newEmails = allowedEmails.filter(e => e.email !== email);
    await saveAllowedEmails(newEmails);
  };

  const handleChangeRole = async (email, newRole) => {
    if (email === OWNER_EMAIL) return;

    const newEmails = allowedEmails.map(e =>
      e.email === email ? { ...e, role: newRole } : e
    );
    await saveAllowedEmails(newEmails);
  };

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

  const getCustomCategories = (type) => {
    return categories[type].filter(cat => !allCategories[type].includes(cat));
  };

  const handleSaveApiKey = async () => {
    setSavingApiKey(true);
    try {
      await updateGeminiApiKey(apiKeyInput.trim());
    } catch (err) {
      console.error('Error saving API key:', err);
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleRemoveApiKey = async () => {
    setSavingApiKey(true);
    try {
      await updateGeminiApiKey('');
      setApiKeyInput('');
    } catch (err) {
      console.error('Error removing API key:', err);
    } finally {
      setSavingApiKey(false);
    }
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Page Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pl-12 md:pl-0">
              {t('settings.title')}
            </h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-14 sm:top-16 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 min-w-[80px] py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'categories'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('settings.categories')}
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 min-w-[80px] py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'notifications'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {language === 'pt' ? 'Notificações' : 'Notifications'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* General Tab — hidden but kept for potential admin access */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Language */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('settings.language')}</h3>
              <div className="space-y-2">
                {Object.entries(languages).map(([code, { name }]) => (
                  <button
                    key={code}
                    onClick={() => updateLanguage(code)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition ${
                      language === code
                        ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {code === 'en' ? '🇺🇸' : '🇧🇷'}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-white">{name}</span>
                    </div>
                    {language === code && (
                      <svg className="w-5 h-5 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('settings.currency')}</h3>
              <div className="space-y-2">
                {Object.entries(CURRENCIES).map(([code, { symbol, name }]) => (
                  <button
                    key={code}
                    onClick={() => updateCurrency(code)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition ${
                      currency === code
                        ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-gray-700 dark:text-gray-200">{symbol}</span>
                      <div className="text-left">
                        <p className="font-medium text-gray-800 dark:text-white">{code}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{name}</p>
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
            </div>

            {/* PWA Install */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Instalar Aplicativo' : 'Install Application'}
              </h3>
              <div className="flex justify-center py-2">
                <InstallPWAButton />
              </div>
            </div>

            {/* AI Categorization */}
            <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <span className="text-lg">🤖</span>
                {language === 'pt' ? 'Categorização com IA' : 'AI Categorization'}
                <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full">
                  {language === 'pt' ? 'Grátis' : 'Free'}
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {language === 'pt'
                  ? 'Use IA do Google (Gemini) para categorizar automaticamente suas transações. Limite gratuito: 1.000 por dia.'
                  : 'Use Google AI (Gemini) to automatically categorize your transactions. Free tier: 1,000/day.'}
              </p>

              {/* API Key Input */}
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={language === 'pt' ? 'Cole sua chave da API Gemini' : 'Paste your Gemini API key'}
                    className="w-full px-4 py-3 pr-20 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                      text-gray-900 dark:text-white placeholder-gray-400
                      focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                      transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showApiKey ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput.trim() || apiKeyInput === geminiApiKey || savingApiKey}
                    className="flex-1 py-2.5 bg-violet-500 text-white rounded-xl text-sm font-medium
                      hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingApiKey
                      ? (language === 'pt' ? 'Salvando...' : 'Saving...')
                      : (language === 'pt' ? 'Salvar Chave' : 'Save Key')}
                  </button>
                  {geminiApiKey && (
                    <button
                      onClick={handleRemoveApiKey}
                      disabled={savingApiKey}
                      className="px-4 py-2.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium
                        hover:bg-rose-200 dark:hover:bg-rose-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {language === 'pt' ? 'Remover' : 'Remove'}
                    </button>
                  )}
                </div>

                {/* Status */}
                {geminiApiKey ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {language === 'pt' ? 'IA Ativada' : 'AI Enabled'}
                      </span>
                    </div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      {language === 'pt' ? `${aiQuota.remaining} restantes hoje` : `${aiQuota.remaining} remaining today`}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {language === 'pt'
                        ? '📝 Obtenha sua chave grátis em: ai.google.dev'
                        : '📝 Get your free key at: ai.google.dev'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Categories Tab - Reusing the exact same structure from SettingsModal */}
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

        {/* Access Tab */}
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
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  inputMode="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setEmailError('');
                  }}
                  placeholder="email@example.com"
                  className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-0 focus:border-gray-900 dark:focus:border-gray-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddEmail();
                  }}
                />
                <button
                  onClick={handleAddEmail}
                  disabled={savingEmails || !newEmail.trim()}
                  className="px-6 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingEmails ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {language === 'pt' ? 'Adicionar' : 'Add'}
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {language === 'pt'
                  ? 'Novos usuários serão adicionados com acesso de escrita por padrão.'
                  : 'New users will be added with write access by default.'}
              </p>
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
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {allowedEmails.map((entry) => {
                    const emailStr = typeof entry === 'string' ? entry : entry.email;
                    const role = typeof entry === 'string' ? 'write' : (entry.role || 'write');
                    const isOwnerEmail = emailStr === OWNER_EMAIL;

                    return (
                      <div
                        key={emailStr}
                        className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        {/* Email and badges row */}
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                          </svg>
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{emailStr}</span>
                          {isOwnerEmail && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full flex-shrink-0">
                              {language === 'pt' ? 'Dono' : 'Owner'}
                            </span>
                          )}
                        </div>

                        {/* Actions row - only show for non-owner */}
                        {!isOwnerEmail && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {language === 'pt' ? 'Permissão:' : 'Permission:'}
                              </span>
                              <select
                                value={role}
                                onChange={(e) => handleChangeRole(emailStr, e.target.value)}
                                disabled={savingEmails}
                                className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg focus:ring-0 focus:border-gray-900 dark:focus:border-gray-500"
                              >
                                <option value="write">{language === 'pt' ? 'Escrita' : 'Write'}</option>
                                <option value="read">{language === 'pt' ? 'Leitura' : 'Read'}</option>
                              </select>
                            </div>
                            <button
                              onClick={() => handleRemoveEmail(emailStr)}
                              disabled={savingEmails}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              {language === 'pt' ? 'Remover' : 'Remove'}
                            </button>
                          </div>
                        )}

                        {/* Owner always shows write badge */}
                        {isOwnerEmail && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {language === 'pt' ? 'Permissão:' : 'Permission:'}
                            </span>
                            <span className="px-3 py-1.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg">
                              {language === 'pt' ? 'Escrita' : 'Write'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-3 rounded-xl ${billReminders ? 'bg-violet-100 dark:bg-violet-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <svg className={`w-6 h-6 ${billReminders ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {language === 'pt' ? 'Lembretes de contas por email' : 'Bill reminders by email'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {language === 'pt'
                        ? 'Todos os dias às 9h (horário de Brasília), enviaremos um email com as contas vencendo hoje ou atrasadas.'
                        : 'Every day at 9 AM (Brazil time), we send an email with bills due today or overdue.'}
                    </p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={billReminders}
                  onClick={() => updateBillReminders(!billReminders)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${billReminders ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${billReminders ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
