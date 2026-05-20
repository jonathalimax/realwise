import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';
import EditTransactionsModal from './EditTransactionsModal';
import EditSingleTransactionModal from './EditSingleTransactionModal';
import { saveUserCategorizationRule } from '../services/categorizationService';

export default function TransactionList({
  transactions = [],
  compact = false,
  sortBy = 'date',
  sortOrder = 'desc',
  onSuccess,
  highlightId,
  hideBulkEdit = false,
  filterButton = null
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const highlightRef = useRef(null);

  // Scroll to highlighted transaction when it changes
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId, transactions]);

  const { formatCurrency, t, language, categories } = useSettings();
  const { canWrite, ownerId } = useAccess();
  const { getBankInfo, findUserBank, getBankDisplayName } = useCards();

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  // Get category icon if available
  const getCategoryIcon = (category, type) => {
    const iconMap = {
      'Alimentação': '🍔', 'Food': '🍔',
      'Transporte': '🚗', 'Vehicle': '🚗', 'Veículo': '🚗',
      'Moradia': '🏠', 'Housing': '🏠',
      'Saúde': '💊', 'Healthcare': '💊',
      'Educação': '📚', 'Education': '📚',
      'Lazer': '🎮', 'Leisure': '🎮',
      'Compras': '🛍️', 'Shopping': '🛍️',
      'Vestuário': '👕', 'Clothing': '👕',
      'Contas': '📄', 'Bills': '📄',
      'Assinaturas': '📱', 'Subscriptions': '📱',
      'Investimentos': '📈', 'Investments': '📈',
      'Diversos': '📦', 'Other': '📦',
      'Salário': '💰', 'Salary': '💰',
      'Freelance': '💻',
      'Presente': '🎁', 'Gift': '🎁',
      'Reembolso': '↩️', 'Refund': '↩️',
    };
    return iconMap[category] || (type === 'income' ? '💵' : '💳');
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    let compare = 0;
    if (sortBy === 'date') {
      compare = new Date(a.date) - new Date(b.date);
    } else if (sortBy === 'description') {
      compare = a.description?.localeCompare(b.description || '') || 0;
    } else if (sortBy === 'amount') {
      compare = a.amount - b.amount;
    } else if (sortBy === 'createdAt') {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      compare = dateA - dateB;
    }
    return sortOrder === 'asc' ? compare : -compare;
  });

  const filteredTransactions = sortedTransactions.filter((trans) =>
    trans.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trans.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedTransactions = filteredTransactions.filter(t => selectedIds.has(t.id));
  const isAllSelected = filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length;
  const hasSelection = selectedIds.size > 0;

  const handleQuickCategoryChange = async (transaction, newCategory) => {
    if (!canWrite || savingId || transaction.category === newCategory) return;

    setSavingId(transaction.id);
    try {
      await updateDoc(doc(db, 'transactions', transaction.id), { category: newCategory });
      if (ownerId) {
        saveUserCategorizationRule(ownerId, {
          description: transaction.description,
          category: newCategory,
          type: transaction.type
        }).catch(err => console.error('Error saving categorization rule:', err));
      }
      onSuccess?.();
    } catch (error) {
      console.error('Error updating category:', error);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header - Search & Actions */}
      {!compact && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1 group">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-violet-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t('transactionList.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white border-0 rounded-2xl
                placeholder-slate-400 dark:placeholder-slate-500
                focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-violet-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            {filterButton}
            {canWrite && !hideBulkEdit && filteredTransactions.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isAllSelected
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border ${isAllSelected ? 'bg-white border-white' : 'border-slate-400 bg-white dark:bg-slate-800'}`}>
                    {isAllSelected && (
                      <svg className="w-3 h-3 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="hidden sm:inline">{isAllSelected ? (language === 'pt' ? 'Desmarcar' : 'Deselect All') : (language === 'pt' ? 'Selecionar Tudo' : 'Select All')}</span>
                </button>

                {hasSelection && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-600/20 hover:bg-violet-700 active:scale-95 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {language === 'pt' ? `Editar (${selectedIds.size})` : `Edit (${selectedIds.size})`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏜️</span>
            </div>
            <p className="font-medium text-slate-900 dark:text-white">{searchTerm ? t('transactionList.noResults') : t('transactionList.empty')}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{searchTerm ? t('transactionList.tryDifferentSearch') : t('transactionList.emptySubtitle')}</p>
          </div>
        ) : (
          filteredTransactions.map((transaction) => {
            const userBank = findUserBank(transaction.bankId);
            const bankInfo = userBank ? getBankInfo(userBank.bankId) : getBankInfo(transaction.bankId);
            const isSaving = savingId === transaction.id;

            return (
              <div
                key={transaction.id}
                ref={transaction.id === highlightId ? highlightRef : null}
                onClick={() => canWrite && setEditingTransaction(transaction)}
                className={`group rounded-2xl transition-all ${canWrite ? 'cursor-pointer active:scale-[0.99]' : ''}
                  ${transaction.id === highlightId
                    ? 'ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-900/20'
                    : selectedIds.has(transaction.id)
                      ? 'bg-violet-50 dark:bg-violet-900/10'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }
                  ${compact ? 'p-2' : 'p-3'}`}
              >
                <div className="flex items-center gap-3">
                  {!compact && canWrite && !hideBulkEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelection(transaction.id); }}
                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors
                        ${selectedIds.has(transaction.id)
                          ? 'bg-violet-600 border-violet-600'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                        }`}
                    >
                      {selectedIds.has(transaction.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )}

                  <div className={`hidden sm:flex w-10 h-10 rounded-full items-center justify-center flex-shrink-0 text-lg
                    ${transaction.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                    {getCategoryIcon(transaction.category, transaction.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2 leading-snug">
                          {transaction.description?.replace(/\s*\(\d+\/\d+\)\s*$/, '')}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 min-w-0">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
                            {new Date(transaction.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600 text-[10px]">•</span>

                          {/* Native Category Selector Styled as Badge */}
                          <div className="relative inline-flex items-center min-w-0" onClick={e => e.stopPropagation()}>
                            <select
                              value={transaction.category || ''}
                              disabled={!canWrite || isSaving}
                              onChange={(e) => handleQuickCategoryChange(transaction, e.target.value)}
                              className={`appearance-none pl-2 pr-5 py-px text-[9px] font-bold rounded-full uppercase tracking-tight transition-colors cursor-pointer border-0 ring-0 focus:ring-2 focus:ring-violet-500 ${
                                transaction.category === 'Sem categoria' || !transaction.category
                                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                                  : transaction.type === 'income'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                              } ${isSaving ? 'opacity-50' : ''}`}
                            >
                              <option value="" disabled>{language === 'pt' ? 'CATEGORIZAR' : 'CATEGORIZE'}</option>
                              {(categories[transaction.type] || []).map(cat => (
                                <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                              ))}
                            </select>
                            <svg className="absolute right-1 w-2.5 h-2.5 pointer-events-none text-current opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>

                          {transaction.bankId && (
                            <span className="text-xs" title={userBank ? getBankDisplayName(userBank) : (bankInfo?.name || '')}>
                              {bankInfo?.icon || '🏦'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </p>
                        {transaction.isInstallment && (
                          <p className="text-[11px] font-bold text-violet-400 dark:text-violet-400 mt-0.5 tabular-nums">
                            {transaction.installmentCurrent} de {transaction.installmentTotal}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <EditTransactionsModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        transactions={selectedTransactions}
        onSuccess={clearSelection}
      />

      <EditSingleTransactionModal
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
        onSuccess={() => {
          setEditingTransaction(null);
          onSuccess?.();
        }}
      />
    </div>
  );
}
