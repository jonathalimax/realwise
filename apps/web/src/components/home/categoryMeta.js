// Shared by the Home cards: an emoji and a colour per category name.
export const CATEGORY_ICONS = {
  Housing: '🏠', Moradia: '🏠',
  Food: '🍔', Alimentação: '🍔', 'Alimentação fora': '🍽️',
  Transport: '🚗', Transporte: '🚗', Vehicle: '🚗', Veículo: '🚗',
  Entertainment: '🎮', Lazer: '🎮', Leisure: '🎮',
  Healthcare: '💊', Saúde: '💊',
  Shopping: '🛍️', Compras: '🛍️',
  Mercado: '🛒', Groceries: '🛒',
  Esporte: '⚽', Sports: '⚽',
  Beleza: '💅', Beauty: '💅',
  Clothing: '👕', Vestuário: '👕',
  Bills: '📄', Contas: '📄',
  Education: '📚', Educação: '📚',
  Travel: '✈️', Viagens: '✈️',
  Subscriptions: '📺', Assinaturas: '📺',
  Taxes: '🏛️', Impostos: '🏛️', 'Impostos e taxas': '🏛️',
  Church: '⛪', Igreja: '⛪',
  Other: '📦', Diversos: '📦', Outros: '📦',
  Investments: '📈', Investimentos: '📈',
  Refund: '↩️', Reembolso: '↩️',
  Uncategorized: '❓', 'Sem categoria': '❓',
};

export const iconFor = (category) => CATEGORY_ICONS[category] || '💰';

// Distinct, readable on dark and light; the order is by rank so the biggest category always gets the first colour.
export const CATEGORY_COLORS = ['#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#3B82F6', '#F97316', '#14B8A6', '#84CC16', '#EF4444'];
export const OTHERS_COLOR = '#94A3B8';
