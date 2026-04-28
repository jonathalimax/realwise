import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { deleteDoc, doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';
import EditTransactionsModal from './EditTransactionsModal';
import EditSingleTransactionModal from './EditSingleTransactionModal';
import { saveUserCategorizationRule } from '../services/categorizationService';
import CategoryPicker from './ui/CategoryPicker';

export default function TransactionList({ transactions = [], selectedMonth, compact = false, sortBy = 'date', sortOrder = 'desc', onSuccess, highlightId }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [pickerTransaction, setPickerTransaction] = useState(null);
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
    // Common category icons mapping
    const iconMap = {
      // Expense categories (Portuguese)
      'Alimentacao': '🍽️',
      'Transporte': '🚗',
      'Moradia': '🏠',
      'Saude': '💊',
      'Educacao': '📚',
      'Lazer': '🎮',
      'Compras': '🛍️',
      'Servicos': '🔧',
      'Assinaturas': '📱',
      'Investimentos': '📈',
      'Outros': '📦',
      // Expense categories (English)
      'Food': '🍽️',
      'Transportation': '🚗',
      'Housing': '🏠',
      'Health': '💊',
      'Education': '📚',
      'Entertainment': '🎮',
      'Shopping': '🛍️',
      'Services': '🔧',
      'Subscriptions': '📱',
      'Investments': '📈',
      'Others': '📦',
      // Income categories (Portuguese)
      'Salario': '💰',
      'Freelancer': '💻',
      'Investimento': '📊',
      'Presente': '🎁',
      'Reembolso': '↩️',
      // Income categories (English)
      'Salary': '💰',
      'Freelance': '💻',
      'Investment': '📊',
      'Gift': '🎁',
      'Refund': '↩️',
    };
    return iconMap[category] || (type === 'income' ? '💵' : '💳');
  };

  const handleDelete = async (transaction) => {
    const id = transaction.id;

    if (transaction.isInstallment && transaction.installmentGroupId) {
      const choice = window.confirm(
        language === 'pt'
          ? `Esta é a parcela ${transaction.installmentCurrent}/${transaction.installmentTotal}.\n\nClique OK para excluir TODAS as parcelas ou Cancelar para excluir apenas esta.`
          : `This is installment ${transaction.installmentCurrent}/${transaction.installmentTotal}.\n\nClick OK to delete ALL installments or Cancel to delete only this one.`
      );
      try {
        if (choice) {
          const q = query(
            collection(db, 'transactions'),
            where('installmentGroupId', '==', transaction.installmentGroupId),
            where('userId', '==', transaction.userId)
          );
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.forEach(d => batch.delete(d.ref));
          await batch.commit();
        } else {
          await deleteDoc(doc(db, 'transactions', id));
        }
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
      return;
    }

    if (window.confirm(language === 'pt' ? 'Excluir esta transação?' : 'Delete this transaction?')) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  const getSortedTransactions = () => {
    return [...transactions].sort((a, b) => {
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
  };

  const sortedTransactions = getSortedTransactions();

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

  // Quick category change handler (from picker)
  const handleQuickCategoryChange = async (newCategory) => {
    if (!canWrite || savingId || !pickerTransaction) return;

    const transaction = pickerTransaction;
    setSavingId(transaction.id);
    setPickerTransaction(null);

    try {
      await updateDoc(doc(db, 'transactions', transaction.id), {
        category: newCategory
      });

      // Save the categorization rule for learning (fire and forget)
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

  // Open category picker for a transaction
  const openCategoryPicker = (transaction, e) => {
    e.stopPropagation();
    setPickerTransaction(transaction);
  };

  return (
    <div className={compact ? '' : ''}>
      {/* Header - Hidden in compact mode */}
      {!compact && (
        <div className="pb-3 sm:pb-4">
          {/* Mobile: Search first, then actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search - Full width on mobile */}
            <div className="relative flex-1 sm:max-w-xs order-1 sm:order-2">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white border-0 rounded-xl
                  placeholder-slate-400 dark:placeholder-slate-500
                  focus:bg-white dark:focus:bg-slate-600 focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-500 transition-all"
              />
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-2 sm:gap-3 order-2 sm:order-1">
              {/* Select All Checkbox - Only for write access */}
              {canWrite && filteredTransactions.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors
                    ${isAllSelected
                      ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white'
                      : hasSelection
                        ? 'bg-slate-400 border-slate-400'
                        : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600 hover:border-slate-400'
                    }`}
                >
                  {(isAllSelected || hasSelection) && (
                    <svg className="w-3 h-3 text-white dark:text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
        {filteredTransactions.length === 0 ? (
          <div className="py-8 sm:py-12 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="font-medium text-slate-900 dark:text-white text-sm sm:text-base mb-1">
              {searchTerm ? t('transactionList.noResults') : t('transactionList.empty')}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {searchTerm ? t('transactionList.tryDifferentSearch') : t('transactionList.emptySubtitle')}
            </p>
          </div>
        ) : (
          filteredTransactions.map((transaction) => {
            const userBank = findUserBank(transaction.bankId);
            const bankInfo = userBank ? getBankInfo(userBank.bankId) : getBankInfo(transaction.bankId);

            return (
              <div
                key={transaction.id}
                ref={transaction.id === highlightId ? highlightRef : null}
                onClick={() => canWrite && navigate(`/transactions/${transaction.id}/edit`)}
                className={`group rounded-xl transition-all ${canWrite ? 'cursor-pointer active:scale-[0.99]' : ''}
                  ${transaction.id === highlightId
                    ? 'ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-900/20'
                    : selectedIds.has(transaction.id)
                      ? 'bg-slate-100 dark:bg-slate-700/50'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }
                  ${compact ? 'p-2' : 'p-2.5 sm:p-3'}
                  ${transaction.ignored ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  {/* Selection Checkbox - Hidden in compact mode and for read-only users */}
                  {!compact && canWrite && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelection(transaction.id); }}
                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors mt-0.5
                        ${selectedIds.has(transaction.id)
                          ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white'
                          : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600'
                        }`}
                    >
                      {selectedIds.has(transaction.id) && (
                        <svg className="w-3 h-3 text-white dark:text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )}

                  {/* Type Indicator with Category Icon - Hidden on mobile to save space */}
                  <div
                    className={`${compact ? 'hidden' : 'hidden sm:flex'} w-9 h-9 sm:w-10 sm:h-10 rounded-full items-center justify-center flex-shrink-0 text-base sm:text-lg
                      ${transaction.type === 'income'
                        ? 'bg-emerald-100 dark:bg-emerald-900/40'
                        : 'bg-rose-100 dark:bg-rose-900/40'}`}
                  >
                    {getCategoryIcon(transaction.category, transaction.type)}
                  </div>

                  {/* Content - Mobile-first layout */}
                  <div className="flex-1 min-w-0">
                    {/* Mobile: Title on its own row for full visibility */}
                    <div className="sm:hidden">
                      <p
                        className={`font-medium text-slate-900 dark:text-white ${compact ? 'text-sm truncate' : 'text-sm'}`}
                        title={transaction.description}
                      >
                        {transaction.description}
                        {transaction.ignored && (
                          <span className="ml-1.5 inline-flex px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded">
                            {t('transactionForm.ignored')}
                          </span>
                        )}
                      </p>
                      {/* Second row: date, category badge, amount */}
                      <div className="flex items-center justify-between mt-1.5 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex-shrink-0">
                            {new Date(transaction.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                          </span>
                          {/* Tappable Category Badge */}
                          <button
                            onClick={(e) => canWrite && openCategoryPicker(transaction, e)}
                            className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition-all flex-shrink-0 ${
                              canWrite ? 'active:scale-95' : ''
                            } ${
                              !transaction.category
                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                                : transaction.type === 'income'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {transaction.category || (language === 'pt' ? 'Categorizar' : 'Needs Category')}
                            {canWrite && (
                              <svg className="w-3 h-3 ml-0.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                          {transaction.bankId && (
                            <span className="text-[11px] flex-shrink-0" title={userBank ? getBankDisplayName(userBank) : (bankInfo?.name || '')}>
                              {bankInfo?.icon || '🏦'}
                            </span>
                          )}
                        </div>
                        {/* Amount */}
                        <p
                          className={`font-bold whitespace-nowrap flex-shrink-0 text-sm
                            ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                        >
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </p>
                      </div>
                    </div>

                    {/* Desktop: Original horizontal layout */}
                    <div className="hidden sm:block">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p
                              className="font-medium text-slate-900 dark:text-white text-sm line-clamp-1"
                              title={transaction.description}
                            >
                              {transaction.description}
                            </p>
                            {transaction.ignored && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded">
                                {t('transactionForm.ignored')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="flex-shrink-0">
                              {new Date(transaction.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            {/* Tappable Category Badge - Desktop */}
                            <button
                              onClick={(e) => canWrite && openCategoryPicker(transaction, e)}
                              className={`px-2 py-0.5 text-xs font-medium rounded-full transition-all ${
                                canWrite ? 'hover:opacity-80 active:scale-95' : ''
                              } ${
                                !transaction.category
                                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                                  : transaction.type === 'income'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                              }`}
                            >
                              {transaction.category || (language === 'pt' ? 'Categorizar' : 'Needs Category')}
                              {canWrite && (
                                <svg className="w-3 h-3 ml-0.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                            {transaction.bankId && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="flex-shrink-0" title={userBank ? getBankDisplayName(userBank) : (bankInfo?.name || '')}>
                                  {bankInfo?.icon || '🏦'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Amount */}
                        <p
                          className={`font-bold whitespace-nowrap flex-shrink-0 text-base
                            ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                        >
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Edit indicator for mobile - shows chevron when tappable */}
                  {canWrite && !compact && (
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0 sm:hidden mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}

                  {/* Edit & Delete Buttons - Desktop only */}
                  {!compact && canWrite && (
                    <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/transactions/${transaction.id}/edit`); }}
                        className="p-2 text-slate-400 hover:text-blue-500
                          hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                        title={language === 'pt' ? 'Editar' : 'Edit'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(transaction); }}
                        className="p-2 text-slate-400 hover:text-rose-500
                          hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                        title={language === 'pt' ? 'Excluir' : 'Delete'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Month Summary Footer - Hidden in compact mode */}
      {!compact && filteredTransactions.length > 0 && (
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-700">
          {/* Mobile layout: compact grid */}
          <div className="sm:hidden">
            <div className="grid grid-cols-3 gap-1.5">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl py-2 px-2 text-center">
                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wide font-medium">{t('balance.income')}</p>
                <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">+{formatCurrency(monthTotals.income)}</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl py-2 px-2 text-center">
                <p className="text-[9px] text-rose-600 dark:text-rose-400 uppercase tracking-wide font-medium">{t('balance.expenses')}</p>
                <p className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5">-{formatCurrency(monthTotals.expense)}</p>
              </div>
              <div className={`rounded-xl py-2 px-2 text-center ${monthTotals.income - monthTotals.expense >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                <p className={`text-[9px] uppercase tracking-wide font-medium ${monthTotals.income - monthTotals.expense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {language === 'pt' ? 'Saldo' : 'Balance'}
                </p>
                <p className={`text-xs sm:text-sm font-bold mt-0.5 ${monthTotals.income - monthTotals.expense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatCurrency(monthTotals.income - monthTotals.expense)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2">
              {filteredTransactions.length} {language === 'pt' ? 'transacoes' : 'transactions'}
            </p>
          </div>

          {/* Desktop layout: horizontal */}
          <div className="hidden sm:flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">{filteredTransactions.length} {language === 'pt' ? 'transacoes' : 'transactions'}</span>
            <div className="flex items-center gap-4">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                +{formatCurrency(monthTotals.income)}
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                -{formatCurrency(monthTotals.expense)}
              </span>
              <span className={`font-bold ${monthTotals.income - monthTotals.expense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                = {formatCurrency(monthTotals.income - monthTotals.expense)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transactions Modal (bulk) */}
      <EditTransactionsModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        transactions={selectedTransactions}
        onSuccess={clearSelection}
      />

      {/* Edit Single Transaction Modal */}
      <EditSingleTransactionModal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
        onSuccess={() => {
          setEditingTransaction(null);
          onSuccess?.();
        }}
      />

      {/* Category Picker */}
      <CategoryPicker
        isOpen={!!pickerTransaction}
        onClose={() => setPickerTransaction(null)}
        onSelect={handleQuickCategoryChange}
        currentCategory={pickerTransaction?.category}
        type={pickerTransaction?.type || 'expense'}
      />
    </div>
  );
}
