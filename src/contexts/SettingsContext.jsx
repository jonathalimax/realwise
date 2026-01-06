import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { LANGUAGES, DEFAULT_LANGUAGE, getTranslation } from '../locales';
import { useAccess } from './AccessContext';

const SettingsContext = createContext();

export const CURRENCIES = {
  BRL: { symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
};

// All available predefined categories by language
export const ALL_CATEGORIES_BY_LANG = {
  en: {
    expense: ['Housing', 'Bills', 'Vehicle', 'Food', 'Healthcare', 'Education', 'Leisure', 'Clothing', 'Taxes', 'Subscriptions', 'Travel', 'Church', 'Investments', 'Other'],
    income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Bonus', 'Rental', 'Other']
  },
  pt: {
    expense: ['Moradia', 'Contas', 'Veículo', 'Alimentação', 'Saúde', 'Educação', 'Lazer', 'Vestuário', 'Impostos', 'Assinaturas', 'Viagens', 'Igreja', 'Investimentos', 'Diversos'],
    income: ['Salário', 'Freelance', 'Investimentos', 'Presente', 'Bônus', 'Aluguel', 'Outros']
  }
};

// Default enabled categories (subset of all)
const DEFAULT_CATEGORIES_BY_LANG = {
  en: {
    expense: ['Housing', 'Bills', 'Vehicle', 'Food', 'Healthcare', 'Education', 'Leisure', 'Clothing', 'Taxes', 'Subscriptions', 'Travel', 'Church', 'Investments', 'Other'],
    income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Other']
  },
  pt: {
    expense: ['Moradia', 'Contas', 'Veículo', 'Alimentação', 'Saúde', 'Educação', 'Lazer', 'Vestuário', 'Impostos', 'Assinaturas', 'Viagens', 'Igreja', 'Investimentos', 'Diversos'],
    income: ['Salário', 'Freelance', 'Investimentos', 'Presente', 'Outros']
  }
};

export const getAllCategories = (lang) => ALL_CATEGORIES_BY_LANG[lang] || ALL_CATEGORIES_BY_LANG.pt;
const getDefaultCategories = (lang) => DEFAULT_CATEGORIES_BY_LANG[lang] || DEFAULT_CATEGORIES_BY_LANG.pt;

export function SettingsProvider({ children }) {
  const [currency, setCurrency] = useState('BRL');
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [categories, setCategories] = useState(getDefaultCategories(DEFAULT_LANGUAGE));
  const [tutorialCompleted, setTutorialCompletedState] = useState(true); // Default true to avoid flash
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
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
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (!auth.currentUser || !ownerId) {
      setLoading(false);
      return;
    }

    const settingsRef = doc(db, 'settings', ownerId); // Use ownerId instead of currentUser.uid

    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const userLang = data.language || DEFAULT_LANGUAGE;
        const defaultCats = getDefaultCategories(userLang);
        setCurrency(data.currency || 'BRL');
        setLanguage(userLang);
        setCategories({
          expense: data.expenseCategories || defaultCats.expense,
          income: data.incomeCategories || defaultCats.income
        });
        // Tutorial: false means show tutorial, undefined means first user (show tutorial)
        setTutorialCompletedState(data.tutorialCompleted === true);
      } else {
        // No settings doc = first time user, show tutorial
        setTutorialCompletedState(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ownerId]); // Use ownerId instead of currentUser.uid

  const updateCurrency = async (newCurrency) => {
    setCurrency(newCurrency);
    if (auth.currentUser) {
      const settingsRef = doc(db, 'settings', auth.currentUser.uid);
      await setDoc(settingsRef, { currency: newCurrency }, { merge: true });
    }
  };

  const updateLanguage = async (newLanguage) => {
    setLanguage(newLanguage);
    if (auth.currentUser) {
      const settingsRef = doc(db, 'settings', auth.currentUser.uid);
      await setDoc(settingsRef, { language: newLanguage }, { merge: true });
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  const setTutorialCompleted = async (completed = true) => {
    setTutorialCompletedState(completed);
    if (auth.currentUser) {
      const settingsRef = doc(db, 'settings', auth.currentUser.uid);
      await setDoc(settingsRef, { tutorialCompleted: completed }, { merge: true });
    }
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

    if (auth.currentUser) {
      const settingsRef = doc(db, 'settings', auth.currentUser.uid);
      const field = type === 'expense' ? 'expenseCategories' : 'incomeCategories';
      await setDoc(settingsRef, { [field]: newCategories }, { merge: true });
    }

    return true;
  };

  const removeCategory = async (type, categoryName) => {
    const newCategories = categories[type].filter(c => c !== categoryName);

    setCategories(prev => ({
      ...prev,
      [type]: newCategories
    }));

    if (auth.currentUser) {
      const settingsRef = doc(db, 'settings', auth.currentUser.uid);
      const field = type === 'expense' ? 'expenseCategories' : 'incomeCategories';
      await setDoc(settingsRef, { [field]: newCategories }, { merge: true });
    }
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

    if (auth.currentUser) {
      const settingsRef = doc(db, 'settings', auth.currentUser.uid);
      const field = type === 'expense' ? 'expenseCategories' : 'incomeCategories';
      await setDoc(settingsRef, { [field]: newCategories }, { merge: true });
    }
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
      loading
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
