import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';
import EditTransactionsModal from './EditTransactionsModal';
import EditSingleTransactionModal from './EditSingleTransactionModal';

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
  const highlightRef = useRef(null);

  // Scroll to highlighted transaction when it changes
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId, transactions]);

  const { formatCurrency, t, language } = useSettings();
  const { canWrite } = useAccess();
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

  const groupedByDate = filteredTransactions.reduce((groups, transaction) => {
    const raw = new Date(transaction.date);
    const dateKey = `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(transaction);
    return groups;
  }, {});

  const dateGroups = Object.entries(groupedByDate)
    .sort(([a], [b]) => sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
    .map(([dateKey, items]) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const dateLabel = dateObj.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
      return { dateKey, dateLabel, items };
    });

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

  const renderTransaction = (transaction) => {
    const userBank = findUserBank(transaction.bankId);
    const bankInfo = userBank ? getBankInfo(userBank.bankId) : getBankInfo(transaction.bankId);

    return (
      <div
        key={transaction.id}
        ref={transaction.id === highlightId ? highlightRef : null}
        onClick={() => canWrite && setEditingTransaction(transaction)}
        className={`group rounded-2xl transition-all ${canWrite ? 'cursor-pointer active:scale-[0.99]' : ''}
          ${transaction.id === highlightId
            ? 'ring-2 ring-violet-500 bg-[var(--rw-brand-soft)]'
            : selectedIds.has(transaction.id)
              ? 'bg-violet-50 dark:bg-violet-900/10'
              : 'bg-[var(--rw-surface)] hover:bg-[var(--rw-raised)]'
          }
          ${transaction.ignored && !transaction.isTransfer ? 'opacity-60' : ''}
          ${compact ? 'p-2' : 'p-3'}`}
      >
        <div className="flex items-center gap-3">
          {!compact && canWrite && !hideBulkEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleSelection(transaction.id); }}
              className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors
                ${selectedIds.has(transaction.id)
                  ? 'bg-[var(--rw-brand)] border-violet-600'
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
            {/* Top row: description + amount */}
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[var(--rw-ink)] text-[15px] line-clamp-2 leading-snug">
                {transaction.description?.replace(/\s*\(\d+\/\d+\)\s*$/, '')}
              </p>
              <div className="text-right flex-shrink-0">
                <p className={`font-bold text-sm ${transaction.type === 'income' ? 'text-[var(--rw-pos)]' : 'text-[var(--rw-ink)]'} tabular-nums ${transaction.ignored ? 'line-through' : ''}`}>
                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </p>
              </div>
            </div>

            {/* Bottom row: bank + installment (left) · category badge (right) */}
            <div className="flex items-center justify-between mt-1 gap-2">
              <div className="flex items-center gap-1.5">
                {transaction.bankId && (
                  <span className="text-xs" title={userBank ? getBankDisplayName(userBank) : (bankInfo?.name || '')}>
                    {bankInfo?.icon || '🏦'}
                  </span>
                )}
                {transaction.isInstallment && (
                  <span className="text-[10px] font-bold text-[var(--rw-brand-ink)] tabular-nums">
                    {transaction.installmentCurrent}/{transaction.installmentTotal}
                  </span>
                )}
                {transaction.ignored && !transaction.isTransfer && (
                  <span className="rounded-full bg-[var(--rw-raised)] px-2 py-0.5 text-[10px] font-bold text-[var(--rw-muted)]">
                    {language === 'pt' ? 'Não conta nos totais' : 'Not counted'}
                  </span>
                )}
                {transaction.isTransfer && (
                  <span
                    className="rounded-full bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-sky-700 dark:text-sky-300"
                    title={language === 'pt' ? 'Movimentação entre contas: não entra nas receitas e despesas' : 'Move between accounts: not counted as income or expense'}
                  >
                    {language === 'pt' ? 'Transferência' : 'Transfer'}
                  </span>
                )}
              </div>

              {/* Category: read-only, edited by tapping the row */}
              {!transaction.isTransfer && (
                <span
                  className="max-w-[9rem] truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={
                    !transaction.category || transaction.category === 'Sem categoria'
                      ? { background: 'color-mix(in srgb, var(--rw-warn) 16%, transparent)', color: 'var(--rw-warn)' }
                      : { background: 'var(--rw-raised)', color: 'var(--rw-muted)' }
                  }
                >
                  {transaction.category || (language === 'pt' ? 'Sem categoria' : 'Uncategorized')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
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
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[var(--rw-raised)]/50 text-[var(--rw-ink)] border-0 rounded-2xl
                placeholder-slate-400 dark:placeholder-slate-500
                focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-[var(--rw-brand)] transition-all"
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
                      ? 'bg-[var(--rw-brand)] text-white'
                      : 'bg-[var(--rw-raised)] text-[var(--rw-ink)] hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border ${isAllSelected ? 'bg-white border-white' : 'border-slate-400 bg-[var(--rw-surface)]'}`}>
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
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--rw-brand)] text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-600/20 hover:bg-violet-700 active:scale-95 transition-all"
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
            <p className="font-medium text-[var(--rw-ink)]">{searchTerm ? t('transactionList.noResults') : t('transactionList.empty')}</p>
            <p className="text-sm text-[var(--rw-muted)] mt-1">{searchTerm ? t('transactionList.tryDifferentSearch') : t('transactionList.emptySubtitle')}</p>
          </div>
        ) : sortBy === 'date' ? (
          // Grouped by date with headers
          dateGroups.map(({ dateKey, dateLabel, items }) => (
            <div key={dateKey} className="space-y-1">
              {!compact && (
                <div className="flex items-center gap-2 px-1 py-1">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                    {dateLabel}
                  </span>
                  <div className="flex-1 h-px bg-[var(--rw-raised)]" />
                </div>
              )}
              {items.map((transaction) => renderTransaction(transaction))}
            </div>
          ))
        ) : (
          // Flat list — preserves sort-by-amount / sort-by-description order
          filteredTransactions.map((transaction) => renderTransaction(transaction))
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
