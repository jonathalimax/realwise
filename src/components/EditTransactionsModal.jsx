import { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useCards, CARD_ICONS } from '../contexts/CardsContext';

export default function EditTransactionsModal({ isOpen, onClose, transactions, onSuccess }) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('no-change');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const { categories, t, language } = useSettings();
  const { cards, getCardColor } = useCards();

  const handleUpdate = async () => {
    if (!selectedCategory && selectedCardId === 'no-change') {
      setError(language === 'pt' ? 'Selecione uma categoria ou cartão para alterar' : 'Select a category or card to change');
      return;
    }

    setUpdating(true);
    setError('');

    try {
      const updates = {};
      if (selectedCategory) {
        updates.category = selectedCategory;
      }
      if (selectedCardId !== 'no-change') {
        updates.cardId = selectedCardId === 'cash' ? null : selectedCardId;
      }

      for (const transaction of transactions) {
        const docRef = doc(db, 'transactions', transaction.id);
        await updateDoc(docRef, updates);
      }

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Error updating transactions:', err);
      setError(err.message || 'Failed to update transactions');
    } finally {
      setUpdating(false);
    }
  };

  const handleClose = () => {
    setSelectedCategory('');
    setSelectedCardId('no-change');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const allCategories = [...categories.expense, ...categories.income];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {language === 'pt' ? 'Editar Transações' : 'Edit Transactions'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Selected count */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {transactions.length} {language === 'pt' ? 'transações selecionadas' : 'transactions selected'}
            </span>
          </div>

          {/* Category selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'pt' ? 'Nova Categoria' : 'New Category'}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                text-gray-900 dark:text-white
                focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all"
            >
              <option value="">{language === 'pt' ? 'Manter categoria atual' : 'Keep current category'}</option>
              <optgroup label={language === 'pt' ? 'Despesas' : 'Expenses'}>
                {categories.expense.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </optgroup>
              <optgroup label={language === 'pt' ? 'Receitas' : 'Income'}>
                {categories.income.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Card selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'pt' ? 'Novo Cartão' : 'New Card'}
            </label>
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                text-gray-900 dark:text-white
                focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all"
            >
              <option value="no-change">{language === 'pt' ? 'Manter cartão atual' : 'Keep current card'}</option>
              <option value="cash">{t('cards.cashNoCard')}</option>
              {cards.map(card => (
                <option key={card.id} value={card.id}>
                  {card.name} {card.lastDigits ? `****${card.lastDigits}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl">
              <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium
              hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleUpdate}
            disabled={updating || (!selectedCategory && selectedCardId === 'no-change')}
            className="flex-1 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-medium
              hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updating
              ? (language === 'pt' ? 'Atualizando...' : 'Updating...')
              : (language === 'pt' ? 'Atualizar' : 'Update')}
          </button>
        </div>
      </div>
    </div>
  );
}
