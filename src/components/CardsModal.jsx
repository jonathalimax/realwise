import { useState } from 'react';
import { useCards, CARD_ICONS, CARD_COLORS } from '../contexts/CardsContext';
import { useSettings } from '../contexts/SettingsContext';

export default function CardsModal({ isOpen, onClose }) {
  const { cards, loading, addCard, updateCard, deleteCard, getCardColor } = useCards();
  const { t } = useSettings();

  const [view, setView] = useState('list'); // 'list', 'form'
  const [editingCard, setEditingCard] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'credit',
    lastDigits: '',
    icon: 'credit',
    color: 'slate',
    closingDay: 10,
    paymentDay: 15
  });

  if (!isOpen) return null;

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'credit',
      lastDigits: '',
      icon: 'credit',
      color: 'slate',
      closingDay: 10,
      paymentDay: 15
    });
    setEditingCard(null);
  };

  const handleOpenForm = (card = null) => {
    if (card) {
      setEditingCard(card);
      setFormData({
        name: card.name,
        type: card.type || 'credit',
        lastDigits: card.lastDigits || '',
        icon: card.icon || 'credit',
        color: card.color || 'slate',
        closingDay: card.closingDay || 10,
        paymentDay: card.paymentDay || 15
      });
    } else {
      resetForm();
    }
    setView('form');
  };

  const handleSubmitCard = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const cardData = {
      name: formData.name.trim(),
      type: formData.type,
      lastDigits: formData.lastDigits.trim(),
      icon: formData.icon,
      color: formData.color,
      closingDay: formData.type === 'credit' ? parseInt(formData.closingDay) : null,
      paymentDay: formData.type === 'credit' ? parseInt(formData.paymentDay) : null
    };

    if (editingCard) {
      await updateCard(editingCard.id, cardData);
    } else {
      await addCard(cardData);
    }

    resetForm();
    setView('list');
  };

  const handleDelete = async (cardId) => {
    await deleteCard(cardId);
    setConfirmDelete(null);
  };

  const CardItem = ({ card }) => {
    const color = getCardColor(card.color);
    const icon = CARD_ICONS[card.icon] || (card.type === 'debit' ? CARD_ICONS.debit : CARD_ICONS.credit);

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 ${color.light} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{card.name}</h3>
              {card.lastDigits && (
                <span className="text-sm text-gray-400">****{card.lastDigits}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                card.type === 'credit'
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              }`}>
                {card.type === 'credit' ? t('cards.creditCard') : t('cards.bankAccount')}
              </span>
            </div>

            {card.type === 'credit' && card.closingDay && card.paymentDay && (
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{t('cards.closingDay')}: {card.closingDay}</span>
                <span className="mx-2">|</span>
                <span>{t('cards.paymentDay')}: {card.paymentDay}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => handleOpenForm(card)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDelete(card.id)}
                className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        {confirmDelete === card.id && (
          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-100 dark:border-rose-800">
            <p className="text-sm text-rose-800 dark:text-rose-300 font-medium">{t('cards.confirmDelete')}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleDelete(card.id)}
                className="flex-1 py-2 bg-rose-500 text-white text-sm font-medium rounded-lg hover:bg-rose-600 transition"
              >
                {t('common.delete')}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Generate day options (1-31)
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <button
                onClick={() => {
                  setView('list');
                  resetForm();
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {view === 'list' && t('cards.title')}
              {view === 'form' && (editingCard ? t('cards.editCard') : t('cards.addCard'))}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* List View */}
          {view === 'list' && (
            <div className="space-y-3">
              {/* Cash / No Card - Always shown first */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-2xl">
                    {CARD_ICONS.other}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{t('cards.cashNoCard')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('cards.cashDescription')}</p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto" />
                  <p className="mt-3 text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                </div>
              ) : cards.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">{t('cards.noCards')}</p>
                </div>
              ) : (
                cards.map((card) => <CardItem key={card.id} card={card} />)
              )}
            </div>
          )}

          {/* Form View */}
          {view === 'form' && (
            <form onSubmit={handleSubmitCard} className="space-y-5">
              {/* Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('cards.type')}
                </label>
                <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'credit', icon: 'credit' })}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      formData.type === 'credit'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {t('cards.creditCard')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'debit', icon: 'debit' })}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      formData.type === 'debit'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {t('cards.bankAccount')}
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('cards.name')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                    text-gray-900 dark:text-white placeholder-gray-400
                    focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                  placeholder={t('cards.namePlaceholder')}
                />
              </div>

              {/* Last 4 Digits */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('cards.lastDigits')}
                </label>
                <input
                  type="text"
                  value={formData.lastDigits}
                  onChange={(e) => setFormData({ ...formData, lastDigits: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  maxLength={4}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                    text-gray-900 dark:text-white placeholder-gray-400
                    focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                  placeholder="1234"
                />
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('cards.icon')}
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {Object.entries(CARD_ICONS).map(([key, emoji]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: key })}
                      className={`p-3 text-xl rounded-xl border-2 transition ${
                        formData.icon === key
                          ? 'border-gray-900 dark:border-gray-400 bg-gray-100 dark:bg-gray-700'
                          : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('cards.color')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {CARD_COLORS.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.name })}
                      className={`w-8 h-8 rounded-full ${color.bg} transition ring-offset-2 dark:ring-offset-gray-900 ${
                        formData.color === color.name ? 'ring-2 ring-gray-900 dark:ring-gray-400' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Credit Card Specific Fields */}
              {formData.type === 'credit' && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl space-y-4">
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-300">{t('cards.invoiceSettings')}</p>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Closing Day */}
                    <div>
                      <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                        {t('cards.closingDay')}
                      </label>
                      <select
                        value={formData.closingDay}
                        onChange={(e) => setFormData({ ...formData, closingDay: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-700 rounded-lg
                          text-gray-900 dark:text-white
                          focus:border-purple-500 focus:ring-0 focus:outline-none"
                      >
                        {dayOptions.map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>

                    {/* Payment Day */}
                    <div>
                      <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                        {t('cards.paymentDay')}
                      </label>
                      <select
                        value={formData.paymentDay}
                        onChange={(e) => setFormData({ ...formData, paymentDay: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-700 rounded-lg
                          text-gray-900 dark:text-white
                          focus:border-purple-500 focus:ring-0 focus:outline-none"
                      >
                        {dayOptions.map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!formData.name.trim()}
                className="w-full py-3.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl
                  hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingCard ? t('common.save') : t('cards.addCard')}
              </button>
            </form>
          )}
        </div>

        {/* Footer - Add button for list view */}
        {view === 'list' && (
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => handleOpenForm()}
              className="w-full py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl
                hover:bg-gray-800 dark:hover:bg-gray-200 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('cards.addCard')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
