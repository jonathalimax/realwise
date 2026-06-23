import en from './en';
import pt from './pt';

export const LANGUAGES = {
  en: { name: 'English', locale: 'en-US', translations: en },
  pt: { name: 'Português', locale: 'pt-BR', translations: pt },
};

export const DEFAULT_LANGUAGE = 'pt';

/**
 * Get a nested translation value by dot notation path
 * @param {object} translations - The translations object
 * @param {string} path - Dot notation path like 'auth.welcomeBack'
 * @param {object} params - Optional parameters for interpolation
 * @returns {string} The translated string
 */
export function getTranslation(translations, path, params = {}) {
  const keys = path.split('.');
  let value = translations;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      console.warn(`Translation missing for: ${path}`);
      return path;
    }
  }

  if (typeof value !== 'string') {
    console.warn(`Translation path ${path} is not a string`);
    return path;
  }

  // Handle interpolation {count}, {name}, etc.
  return value.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? params[key] : `{${key}}`;
  });
}
