import { apiClient } from '../client';

const DEFAULT_CATEGORIES_BY_LANG = {
  en: {
    expense: ['Housing', 'Bills', 'Vehicle', 'Food', 'Healthcare', 'Education', 'Leisure', 'Clothing', 'Taxes', 'Subscriptions', 'Travel', 'Church', 'Investments', 'Uncategorized', 'Other'],
    income: ['Salary', 'Freelance', 'Investment', 'Refund', 'Gift', 'Uncategorized', 'Other'],
  },
  pt: {
    expense: ['Moradia', 'Contas', 'Veiculo', 'Alimentacao', 'Mercado', 'Saude', 'Educacao', 'Lazer', 'Esporte', 'Vestuario', 'Beleza', 'Compras', 'Impostos', 'Assinaturas', 'Viagens', 'Igreja', 'Investimentos', 'Sem categoria', 'Diversos'],
    income: ['Salario', 'Freelance', 'Investimentos', 'Reembolso', 'Presente', 'Sem categoria', 'Outros'],
  },
};

function getDefaultCategories(language) {
  return DEFAULT_CATEGORIES_BY_LANG[language] || DEFAULT_CATEGORIES_BY_LANG.pt;
}

export function normalizeSettings(data) {
  const language = data?.language === 'en' ? 'en' : 'pt';
  const defaults = getDefaultCategories(language);

  return {
    currency: data?.currency || 'BRL',
    language,
    darkMode: data?.darkMode ?? false,
    billReminders: data?.billReminders ?? true,
    monthlyRollover: data?.monthlyRollover ?? true,
    tutorialCompleted: data?.tutorialCompleted === true,
    geminiApiKey: data?.geminiApiKey || '',
    expenseCategories: data?.expenseCategories || defaults.expense,
    incomeCategories: data?.incomeCategories || defaults.income,
    categoryRuleMapping: data?.categoryRuleMapping || null,
    rulePercentages: data?.rulePercentages || null,
  };
}

export function createSettingsResource({ client = apiClient } = {}) {
  return {
    get() {
      return client.get('/user-settings');
    },
    update(patch) {
      return client.patch('/user-settings', patch);
    },
  };
}

export const settingsResource = createSettingsResource();
