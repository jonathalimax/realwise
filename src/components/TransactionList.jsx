import { useState } from 'react';
import { db } from '../firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import EditTransactionsModal from './EditTransactionsModal';

export default function TransactionList({ transactions = [], selectedMonth, compact = false }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showEditModal, setShowEditModal] = useState(false);

  const { formatCurrency, t, language } = useSettings();

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const handleDelete = async (id) => {
    if (window.confirm(language === 'pt' ? 'Excluir esta transação?' : 'Delete this transaction?')) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  // Sort transactions by date (newest first)
  const sortedTransactions = [...transactions].sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });

  const filteredTransactions = sortedTransactions.filter((trans) =>
    trans.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trans.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate totals for the selected month (excluding ignored)
  const monthTotals = filteredTransactions.reduce((acc, trans) => {
    if (trans.ignored) return acc;
    if (trans.type === 'income') {
      acc.income += trans.amount;
    } else {
      acc.expense += trans.amount;
    }
    return acc;
  }, { income: 0, expense: 0 });

  // Selection helpers
  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedTransactions = filteredTransactions.filter(t => selectedIds.has(t.id));
  const isAllSelected = filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length;
  const hasSelection = selectedIds.size > 0;

  return (
    <div className={compact ? '' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden'}>
      {/* Header - Hidden in compact mode */}
      {!compact && (
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Select All Checkbox */}
              {filteredTransactions.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors
                    ${isAllSelected
                      ? 'bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100'
                      : hasSelection
                        ? 'bg-gray-400 border-gray-400'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400'
                    }`}
                >
                  {(isAllSelected || hasSelection) && (
                    <svg className="w-3 h-3 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('transactionList.title')}</h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Edit Selected Button */}
              {hasSelection && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {language === 'pt' ? `Editar (${selectedIds.size})` : `Edit (${selectedIds.size})`}
                </button>
              )}

              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder={t('transactionList.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-0 rounded-lg
                    focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="divide-y divide-gray-50 dark:divide-gray-700">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="font-medium text-gray-900 dark:text-white mb-1">
              {searchTerm ? t('transactionList.noResults') : t('transactionList.empty')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? t('transactionList.tryDifferentSearch') : t('transactionList.emptySubtitle')}
            </p>
          </div>
        ) : (
          filteredTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className={`group flex items-center gap-2 sm:gap-4 ${compact ? 'py-2.5' : 'px-6 py-4'} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg
                ${selectedIds.has(transaction.id) ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}
            >
              {/* Selection Checkbox - Hidden in compact mode */}
              {!compact && (
                <button
                  onClick={() => toggleSelection(transaction.id)}
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors
                    ${selectedIds.has(transaction.id)
                      ? 'bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400'
                    }`}
                >
                  {selectedIds.has(transaction.id) && (
                    <svg className="w-3 h-3 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}

              {/* Icon - Smaller in compact mode */}
              <div
                className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center flex-shrink-0
                  ${transaction.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}
              >
                <svg
                  className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {transaction.type === 'income' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                  )}
                </svg>
              </div>

              {/* Info */}
              <div className={`flex-1 min-w-0 overflow-hidden ${transaction.ignored ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <p className={`font-medium text-gray-900 dark:text-white truncate ${compact ? 'text-sm' : ''}`}>{transaction.description}</p>
                  {transaction.ignored && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded">
                      {t('transactionForm.ignored')}
                    </span>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 text-gray-500 dark:text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>
                  <span className="truncate max-w-[80px]">{transaction.category}</span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="flex-shrink-0">{new Date(transaction.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
                </div>
              </div>

              {/* Amount */}
              <p
                className={`font-semibold whitespace-nowrap flex-shrink-0 ${compact ? 'text-sm' : ''}
                  ${transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </p>

              {/* Delete Button - Hidden in compact mode */}
              {!compact && (
                <button
                  onClick={() => handleDelete(transaction.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-rose-500
                    hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Month Summary Footer - Hidden in compact mode */}
      {!compact && filteredTransactions.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">{filteredTransactions.length} {language === 'pt' ? 'transações' : 'transactions'}</span>
            <div className="flex items-center gap-4">
              <span className="text-emerald-600 font-medium">
                +{formatCurrency(monthTotals.income)}
              </span>
              <span className="text-rose-600 font-medium">
                -{formatCurrency(monthTotals.expense)}
              </span>
              <span className={`font-semibold ${monthTotals.income - monthTotals.expense >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                = {formatCurrency(monthTotals.income - monthTotals.expense)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transactions Modal */}
      <EditTransactionsModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        transactions={selectedTransactions}
        onSuccess={clearSelection}
      />
    </div>
  );
}
