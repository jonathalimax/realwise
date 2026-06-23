// Utility functions for the app

/**
 * Creates a URL for a page with optional query parameters
 * @param {string} pageName - The name of the page (e.g., 'Home', 'Donations', 'Support', 'FeatureRequest')
 * @param {Object} params - Optional query parameters
 * @returns {string} The full URL path
 */
export function createPageUrl(pageName, params = {}) {
  const routes = {
    'Home': '/',
    'Donations': '/donations',
    'Support': '/support',
    'FeatureRequest': '/feedback',
    'App': '/dashboard',
  };

  const basePath = routes[pageName] || '/';

  if (Object.keys(params).length === 0) {
    return basePath;
  }

  const queryString = new URLSearchParams(params).toString();
  return `${basePath}?${queryString}`;
}

/**
 * Format currency amount
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (BRL, USD, EUR, GBP)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'BRL') {
  const locales = {
    BRL: 'pt-BR',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
  };

  return new Intl.NumberFormat(locales[currency] || 'en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}
