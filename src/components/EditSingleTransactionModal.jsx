import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useGoals, GOAL_ICONS } from '../contexts/GoalsContext';
import { useCards } from '../contexts/CardsContext';
import CurrencyInput from './ui/CurrencyInput';

export default function EditSingleTransactionModal({ isOpen, onClose, transaction, onSuccess }) {
  const [type, setType] = useState('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [isIgnored, setIsIgnored] = useState(false);
  const [loading, setLoading] = useState(false);

  const { categories, t, language } = useSettings();
  const { goals, getGoalColor } = useGoals();
  const { userBanks, getBankInfo } = useCards();

  const availableGoals = goals.filter(g => !g.completed);

  // Populate form when transaction changes
  useEffect(() => {
    if (transaction) {
      setType(transaction.type || 'expense');
      setDescription(transaction.description || '');
      setAmount(transaction.amount || 0);
      setCategory(transaction.category || '');
      setTransactionDate(transaction.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setSelectedGoalId(transaction.goalId || '');
      setSelectedBankId(transaction.bankId || null);
      setIsIgnored(transaction.ignored || false);
    }
  }, [transaction]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0 || !transaction?.id) return;

    setLoading(true);

    try {
      const baseDate = new Date(transactionDate + 'T12:00:00');
      const selectedGoal = selectedGoalId ? goals.find(g => g.id === selectedGoalId) : null;

      const updates = {
        type,
        description,
        amount: parseFloat(amount),
        category: category || categories[type][0],
        date: baseDate.toISOString(),
        goalId: selectedGoalId || null,
        goalName: selectedGoal?.name || null,
        bankId: selectedBankId || null,
        ignored: isIgnored,
      };

      await updateDoc(doc(db, 'transactions', transaction.id), updates);

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                    {language === 'pt' ? 'Editar Transação' : 'Edit Transaction'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Type Toggle */}
                  <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                        type === 'expense'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      {t('transactionForm.expense')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                        type === 'income'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      {t('transactionForm.income')}
                    </button>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('transactionForm.amount')}
                    </label>
                    <CurrencyInput value={amount} onChange={setAmount} />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('transactionForm.description')}
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                        text-gray-900 dark:text-white placeholder-gray-400
                        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                        transition-all duration-200"
                      placeholder={t('transactionForm.descriptionPlaceholder')}
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('transactionForm.date')}
                    </label>
                    <input
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                        text-gray-900 dark:text-white
                        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                        transition-all duration-200"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('transactionForm.category')}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                        text-gray-900 dark:text-white
                        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                        transition-all duration-200 appearance-none cursor-pointer pr-10"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 12px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '20px'
                      }}
                    >
                      {categories[type].map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Bank Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {language === 'pt' ? 'Banco' : 'Bank'}
                    </label>
                    <select
                      value={selectedBankId || 'cash'}
                      onChange={(e) => setSelectedBankId(e.target.value === 'cash' ? null : e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                        text-gray-900 dark:text-white
                        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                        transition-all duration-200 appearance-none cursor-pointer pr-10"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 12px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '20px'
                      }}
                    >
                      <option value="cash">{language === 'pt' ? '💵 Dinheiro' : '💵 Cash'}</option>
                      {userBanks.map((userBank) => {
                        const bankInfo = getBankInfo(userBank.bankId);
                        return (
                          <option key={userBank.bankId} value={userBank.bankId}>
                            {bankInfo.icon} {bankInfo.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Link to Goal */}
                  {availableGoals.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('goals.linkToGoal')}
                      </label>
                      <select
                        value={selectedGoalId}
                        onChange={(e) => setSelectedGoalId(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                          text-gray-900 dark:text-white
                          focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                          transition-all duration-200 appearance-none cursor-pointer pr-10"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 12px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '20px'
                        }}
                      >
                        <option value="">{t('goals.noGoalSelected')}</option>
                        {availableGoals.map((goal) => (
                          <option key={goal.id} value={goal.id}>{goal.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Ignore Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsIgnored(!isIgnored)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isIgnored
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🚫</span>
                      <div className="text-left">
                        <span className={`text-sm font-medium ${isIgnored ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          {t('transactionForm.ignoreTransaction')}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('transactionForm.ignoreTransactionHint')}
                        </p>
                      </div>
                    </div>
                    <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-1.5 ${
                      isIgnored ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-600'
                    }`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        isIgnored ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium
                        hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !amount || amount <= 0}
                      className={`flex-1 py-3 rounded-xl font-medium text-white transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${type === 'expense'
                          ? 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700'
                          : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700'
                        }`}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {language === 'pt' ? 'Salvando...' : 'Saving...'}
                        </span>
                      ) : (
                        t('common.save')
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
