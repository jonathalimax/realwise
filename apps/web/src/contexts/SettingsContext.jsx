import { catalogAll, catalogBasics, CATALOG_TRANSLATIONS } from '../lib/categoryCatalog';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LANGUAGES, DEFAULT_LANGUAGE, getTranslation } from '../locales';
import { useAccess } from './AccessContext';
import { settingsResource, normalizeSettings } from '../lib/api/resources/settings';

const SettingsContext = createContext();
const DARK_MODE_STORAGE_KEY = 'realwise:darkMode';
const LANGUAGE_STORAGE_KEY = 'realwise:language';

// The paywall renders without settings (the endpoint is blocked too), so it reads this copy of the language.
function rememberLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // storage unavailable: the paywall falls back to the browser language
  }
}

export const CURRENCIES = {
  BRL: { symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
};

// The special "uncategorized" sentinel values (by language). Used by components to
// pin this entry at the top of every category select without hardcoding the string.
export const UNCATEGORIZED_CATEGORY = { pt: 'Sem categoria', en: 'Uncategorized' };

// All available predefined categories by language, and the subset that is on by default (see lib/categoryCatalog.js).
export const ALL_CATEGORIES_BY_LANG = { en: catalogAll('en'), pt: catalogAll('pt') };
const DEFAULT_CATEGORIES_BY_LANG = { en: catalogBasics('en'), pt: catalogBasics('pt') };

export const getAllCategories = (lang) => ALL_CATEGORIES_BY_LANG[lang] || ALL_CATEGORIES_BY_LANG.pt;
const getDefaultCategories = (lang) => DEFAULT_CATEGORIES_BY_LANG[lang] || DEFAULT_CATEGORIES_BY_LANG.pt;

// Category translation mapping (PT -> EN and EN -> PT)
const CATEGORY_TRANSLATION_MAP = {
  ...CATALOG_TRANSLATIONS,
  // Expense categories
  'Housing': 'Moradia',
  'Moradia': 'Housing',
  'Bills': 'Contas',
  'Contas': 'Bills',
  'Vehicle': 'Veículo',
  'Veículo': 'Vehicle',
  'Food': 'Alimentação',
  'Alimentação': 'Food',
  'Healthcare': 'Saúde',
  'Saúde': 'Healthcare',
  'Education': 'Educação',
  'Educação': 'Education',
  'Leisure': 'Lazer',
  'Lazer': 'Leisure',
  'Clothing': 'Vestuário',
  'Vestuário': 'Clothing',
  'Taxes': 'Impostos',
  'Impostos': 'Taxes',
  'Subscriptions': 'Assinaturas',
  'Assinaturas': 'Subscriptions',
  'Travel': 'Viagens',
  'Viagens': 'Travel',
  'Church': 'Igreja',
  'Igreja': 'Church',
  'Investments': 'Investimentos',
  'Investimentos': 'Investments',
  'Groceries': 'Mercado',
  'Mercado': 'Groceries',
  'Sports': 'Esporte',
  'Esporte': 'Sports',
  'Beauty': 'Beleza',
  'Beleza': 'Beauty',
  'Shopping': 'Compras',
  'Compras': 'Shopping',
  'Other': 'Diversos',
  'Diversos': 'Other',
  'Uncategorized': 'Sem categoria',
  'Sem categoria': 'Uncategorized',
  // Income categories
  'Salary': 'Salário',
  'Salário': 'Salary',
  'Freelance': 'Freelance',
  'Investment': 'Investimentos',
  'Refund': 'Reembolso',
  'Reembolso': 'Refund',
  'Gift': 'Presente',
  'Presente': 'Gift',
  'Bonus': 'Bônus',
  'Bônus': 'Bonus',
  'Rental': 'Aluguel',
  'Aluguel': 'Rental',
  'Outros': 'Other'
};

// Translate categories when language changes
const translateCategories = (categories, fromLang, toLang) => {
  if (!categories || fromLang === toLang) return categories;

  return {
    expense: categories.expense?.map(cat => CATEGORY_TRANSLATION_MAP[cat] || cat) || [],
    income: categories.income?.map(cat => CATEGORY_TRANSLATION_MAP[cat] || cat) || []
  };
};

export function SettingsProvider({ children }) {
  const [currency, setCurrency] = useState('BRL');
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [categories, setCategories] = useState(getDefaultCategories(DEFAULT_LANGUAGE));
  const [tutorialCompleted, setTutorialCompletedState] = useState(true); // Default true to avoid flash
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [billReminders, setBillRemindersState] = useState(true);
  const [monthlyRollover, setMonthlyRolloverState] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return false;
  });
  const [loading, setLoading] = useState(true);
  const { ownerId } = useAccess();

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(DARK_MODE_STORAGE_KEY, String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    settingsResource.get()
      .then((data) => {
        const normalized = normalizeSettings(data);
        setCurrency(normalized.currency);
        setLanguage(normalized.language);
        rememberLanguage(normalized.language);
        setDarkMode(normalized.darkMode);
        setCategories({
          expense: normalized.expenseCategories,
          income: normalized.incomeCategories,
        });
        setTutorialCompletedState(normalized.tutorialCompleted);
        setGeminiApiKey(normalized.geminiApiKey);
        setBillRemindersState(normalized.billReminders);
        setMonthlyRolloverState(normalized.monthlyRollover);
      })
      .catch((error) => {
        console.error('Error loading settings:', error);
        const normalized = normalizeSettings(null);
        setCurrency(normalized.currency);
        setLanguage(normalized.language);
        setCategories({
          expense: normalized.expenseCategories,
          income: normalized.incomeCategories,
        });
        setTutorialCompletedState(normalized.tutorialCompleted);
        setGeminiApiKey(normalized.geminiApiKey);
        setBillRemindersState(normalized.billReminders);
        setMonthlyRolloverState(normalized.monthlyRollover);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ownerId]);

  const updateCurrency = async (newCurrency) => {
    setCurrency(newCurrency);
    await settingsResource.update({ currency: newCurrency });
  };

  const updateLanguage = async (newLanguage) => {
    if (newLanguage === language) return; // No change needed

    const oldLanguage = language;
    setLanguage(newLanguage);
    rememberLanguage(newLanguage);

    // Translate existing categories
    const translatedCategories = translateCategories(categories, oldLanguage, newLanguage);
    setCategories(translatedCategories);

    await settingsResource.update({
      language: newLanguage,
      expenseCategories: translatedCategories.expense,
      incomeCategories: translatedCategories.income,
    });
  };

  const toggleDarkMode = async () => {
    const nextDarkMode = !darkMode;
    setDarkMode(nextDarkMode);

    try {
      await settingsResource.update({ darkMode: nextDarkMode });
    } catch (error) {
      console.error('Error updating dark mode:', error);
      setDarkMode(!nextDarkMode);
    }
  };

  const setTutorialCompleted = async (completed = true) => {
    setTutorialCompletedState(completed);
    await settingsResource.update({ tutorialCompleted: completed });
  };

  const updateBillReminders = async (enabled) => {
    setBillRemindersState(enabled);
    await settingsResource.update({ billReminders: enabled });
  };

  const updateMonthlyRollover = async (enabled) => {
    setMonthlyRolloverState(enabled);
    await settingsResource.update({ monthlyRollover: enabled });
  };

  const updateGeminiApiKey = async (apiKey) => {
    setGeminiApiKey(apiKey);
    await settingsResource.update({ geminiApiKey: apiKey });
  };

  // Translation function
  const t = useCallback((path, params = {}) => {
    const translations = LANGUAGES[language]?.translations || LANGUAGES[DEFAULT_LANGUAGE].translations;
    return getTranslation(translations, path, params);
  }, [language]);

  const addCategory = async (type, categoryName) => {
    if (!categoryName.trim()) return false;

    const currentCategories = categories[type];
    if (currentCategories.includes(categoryName.trim())) return false;

    const newCategories = [...currentCategories, categoryName.trim()];

    setCategories(prev => ({
      ...prev,
      [type]: newCategories
    }));

    const field = type === 'expense' ? 'expenseCategories' : 'incomeCategories';
    await settingsResource.update({ [field]: newCategories });

    return true;
  };

  const removeCategory = async (type, categoryName) => {
    const newCategories = categories[type].filter(c => c !== categoryName);

    setCategories(prev => ({
      ...prev,
      [type]: newCategories
    }));

    const field = type === 'expense' ? 'expenseCategories' : 'incomeCategories';
    await settingsResource.update({ [field]: newCategories });
  };

  const toggleCategory = async (type, categoryName) => {
    const currentCategories = categories[type];
    const isEnabled = currentCategories.includes(categoryName);

    // Prevent disabling "Other" / "Outros"
    if (isEnabled && (categoryName === 'Other' || categoryName === 'Outros')) return;

    let newCategories;
    if (isEnabled) {
      newCategories = currentCategories.filter(c => c !== categoryName);
    } else {
      newCategories = [...currentCategories, categoryName];
    }

    setCategories(prev => ({
      ...prev,
      [type]: newCategories
    }));

    const field = type === 'expense' ? 'expenseCategories' : 'incomeCategories';
    await settingsResource.update({ [field]: newCategories });
  };

  const formatCurrency = (amount) => {
    const curr = CURRENCIES[currency];
    return new Intl.NumberFormat(curr.locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <SettingsContext.Provider value={{
      currency,
      currencies: CURRENCIES,
      updateCurrency,
      language,
      languages: LANGUAGES,
      updateLanguage,
      t,
      categories,
      allCategories: getAllCategories(language),
      addCategory,
      removeCategory,
      toggleCategory,
      formatCurrency,
      darkMode,
      toggleDarkMode,
      tutorialCompleted,
      setTutorialCompleted,
      geminiApiKey,
      updateGeminiApiKey,
      billReminders,
      updateBillReminders,
      monthlyRollover,
      updateMonthlyRollover,
      loading
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
