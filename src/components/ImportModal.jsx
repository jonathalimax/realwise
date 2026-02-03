import { useState, useCallback, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { parseFile } from '../services/importers';
import { useSettings } from '../contexts/SettingsContext';
import { useCards, BANKS } from '../contexts/CardsContext';
import { useGoals, GOAL_ICONS } from '../contexts/GoalsContext';
import { useInvestments, INVESTMENT_TYPES } from '../contexts/InvestmentContext';
import { generateTransactionHash } from '../services/installments';
import { useIsMobile } from '../hooks/useIsMobile';
import CurrencyInput from './ui/CurrencyInput';

export default function ImportModal({ isOpen, onClose }) {
  const isMobile = useIsMobile();
  const [file, setFile] = useState(null);
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('upload'); // upload, preview, done
  const [existingHashes, setExistingHashes] = useState(new Set());
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [installmentCount, setInstallmentCount] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showEditHint, setShowEditHint] = useState(true);

  const { formatCurrency, categories, t, language } = useSettings();
  const { userBanks, getBankInfo, getBankDisplayName } = useCards();
  const { goals, getGoalColor } = useGoals();
  useInvestments(); // Used for context availability

  // Only show non-completed goals for linking
  const availableGoals = goals.filter(g => !g.completed);

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  // Load existing transaction hashes when modal opens
  useEffect(() => {
    if (isOpen && auth.currentUser) {
      loadExistingHashes();
    }
  }, [isOpen]);

  // Dismiss edit hint after 5 seconds
  useEffect(() => {
    if (step === 'preview' && showEditHint) {
      const timer = setTimeout(() => setShowEditHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [step, showEditHint]);

  const loadExistingHashes = async () => {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const hashes = new Set();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.hash) {
          hashes.add(data.hash);
        } else {
          const hash = generateTransactionHash({
            date: data.date,
            description: data.description,
            amount: data.amount
          });
          hashes.add(hash);
        }
      });

      setExistingHashes(hashes);
    } catch (err) {
      console.error('Error loading existing hashes:', err);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError('');
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleParse = async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      // Always auto-detect bank format
      const parsed = await parseFile(file, 'auto');

      let duplicates = 0;
      let installments = 0;

      const processedTransactions = parsed.map(t => {
        const isDuplicate = existingHashes.has(t.hash);
        if (isDuplicate) duplicates++;
        if (t.isInstallment) installments++;

        return {
          ...t,
          isDuplicate,
          selected: !isDuplicate
        };
      });

      setDuplicateCount(duplicates);
      setInstallmentCount(installments);
      setTransactions(processedTransactions);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);

    try {
      const toImport = transactions.filter(t => t.selected);

      for (const t of toImport) {
        await addDoc(collection(db, 'transactions'), {
          userId: auth.currentUser.uid,
          type: t.type,
          description: t.description,
          amount: t.amount,
          category: t.category,
          createdAt: serverTimestamp(),
          date: t.date,
          imported: true,
          hash: t.hash,
          bankId: selectedBankId || null,
          isInstallment: t.isInstallment || false,
          installmentCurrent: t.installmentCurrent || null,
          installmentTotal: t.installmentTotal || null,
          installmentGroupId: t.installmentGroupId || null,
          autoGenerated: t.autoGenerated || false,
          // New fields from edit form
          goalId: t.goalId || null,
          goalName: t.goalName || null,
          investmentType: t.investmentType || null
        });
      }

      setStep('done');
    } catch (err) {
      setError(err.message || 'Failed to import transactions');
    } finally {
      setImporting(false);
    }
  };

  const toggleTransactionSelection = (index) => {
    setTransactions(prev => prev.map((t, i) =>
      i === index ? { ...t, selected: !t.selected } : t
    ));
  };

  const toggleTransactionType = (index) => {
    setTransactions(prev => prev.map((t, i) =>
      i === index ? { ...t, type: t.type === 'income' ? 'expense' : 'income' } : t
    ));
  };

  const selectedCount = transactions.filter(t => t.selected).length;

  const handleClose = () => {
    setFile(null);
    setTransactions([]);
    setStep('upload');
    setError('');
    setDuplicateCount(0);
    setInstallmentCount(0);
    setSelectedBankId(null);
    setEditingTransaction(null);
    setShowEditHint(true);
    onClose();
  };

  const openEditTransaction = (index) => {
    setEditingTransaction({
      index,
      ...transactions[index],
      selectedGoalId: transactions[index].goalId || '',
      investmentType: transactions[index].investmentType || 'fixed_income'
    });
    setShowEditHint(false);
  };

  const saveEditTransaction = () => {
    if (editingTransaction === null) return;

    const { index, selectedGoalId, ...updates } = editingTransaction;
    setTransactions(prev => prev.map((t, i) =>
      i === index ? {
        ...t,
        ...updates,
        goalId: selectedGoalId || null,
        goalName: selectedGoalId ? availableGoals.find(g => g.id === selectedGoalId)?.name || null : null,
        autoCategory: false // Mark as manually edited
      } : t
    ));
    setEditingTransaction(null);
  };

  if (!isOpen) return null;

  // Wrapper component - full screen on mobile, modal on desktop
  const Wrapper = ({ children }) => {
    if (isMobile) {
      return (
        <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col">
          {children}
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    );
  };

  return (
    <Wrapper>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 ${isMobile ? 'bg-white dark:bg-gray-800' : ''}`}>
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{t('import.title')}</h2>
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
      <div className={`flex-1 overflow-y-auto p-4 sm:p-6 ${isMobile ? 'bg-gray-50 dark:bg-gray-900' : ''}`}>
        {step === 'upload' && (
          <div className="flex flex-col h-full">
            {/* Bank Selection - Compact Grid */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {language === 'pt' ? 'Vincular ao Banco' : 'Link to Bank'}
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {/* Cash / No Bank option */}
                <button
                  type="button"
                  onClick={() => setSelectedBankId(null)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${
                    selectedBankId === null
                      ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-xl flex items-center justify-center text-xl">
                    💵
                  </div>
                  <span className="text-[10px] text-gray-600 dark:text-gray-300 text-center leading-tight">
                    {language === 'pt' ? 'Dinheiro' : 'Cash'}
                  </span>
                </button>

                {/* Bank options from user's registered banks */}
                {userBanks.map((userBank) => {
                  const bankInfo = getBankInfo(userBank.bankId);
                  const displayName = getBankDisplayName(userBank);
                  return (
                    <button
                      key={userBank.id}
                      type="button"
                      onClick={() => setSelectedBankId(userBank.id)}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all relative ${
                        selectedBankId === userBank.id
                          ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-xl flex items-center justify-center text-xl">
                        {bankInfo.icon}
                      </div>
                      <span className="text-[10px] text-gray-600 dark:text-gray-300 text-center leading-tight truncate w-full">
                        {displayName}
                      </span>
                      {userBank.hasCredit && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File Selection - At the bottom */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Arquivo do extrato' : 'Statement file'}
              </label>
              {file ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="block cursor-pointer">
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="w-full py-4 px-4 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                  >
                    <svg className="w-7 h-7 text-gray-400 mx-auto mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {language === 'pt' ? 'Selecionar arquivo' : 'Select file'}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">CSV, XLS, XLSX</p>
                  </div>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl">
                <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {/* Header with Back Button and Stats */}
            <div className="flex items-center gap-3">
              {/* Back Button */}
              <button
                onClick={() => setStep('upload')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('common.back')}
              </button>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300">
                  {transactions.length} {language === 'pt' ? 'encontradas' : 'found'}
                </span>
                {duplicateCount > 0 && (
                  <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full text-sm">
                    {duplicateCount} {language === 'pt' ? 'duplicadas' : 'duplicates'}
                  </span>
                )}
                {installmentCount > 0 && (
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                    {installmentCount} {language === 'pt' ? 'parcelas' : 'installments'}
                  </span>
                )}
              </div>
            </div>

            {/* Edit hint - auto-dismisses */}
            {showEditHint && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>
                  {language === 'pt'
                    ? 'Toque em uma transacao para editar'
                    : 'Tap a transaction to edit'}
                </span>
                <button onClick={() => setShowEditHint(false)} className="ml-auto p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Transaction List */}
            <div className={`space-y-2 ${isMobile ? '' : 'max-h-96'} overflow-y-auto`}>
              {transactions.map((trans, i) => (
                <div
                  key={i}
                  onClick={() => openEditTransaction(i)}
                  className={`rounded-xl transition-all cursor-pointer active:scale-[0.99] ${
                    trans.isDuplicate
                      ? 'bg-amber-50 dark:bg-amber-900/20 opacity-60'
                      : trans.selected
                        ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                        : 'bg-gray-50 dark:bg-gray-800/50 opacity-50'
                  } p-3`}
                >
                  {/* Unified Layout - Works for both mobile and desktop */}
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTransactionSelection(i); }}
                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors
                        ${trans.selected
                          ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
                          : trans.isDuplicate
                            ? 'border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/30'
                            : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600'
                        }`}
                    >
                      {trans.selected && (
                        <svg className="w-3 h-3 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Type Indicator */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTransactionType(i); }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors active:scale-95
                      ${trans.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-rose-100 dark:bg-rose-900/40'}`}
                    >
                      <svg className={`w-4 h-4 ${trans.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {trans.type === 'income' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                        )}
                      </svg>
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1" title={trans.description}>
                            {trans.description}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span>{new Date(trans.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
                            <span className="text-gray-300 dark:text-gray-600">-</span>
                            <span className="truncate">{trans.category}</span>
                            {trans.isInstallment && (
                              <>
                                <span className="text-gray-300 dark:text-gray-600">-</span>
                                <span className="text-blue-600 dark:text-blue-400">{trans.installmentCurrent}/{trans.installmentTotal}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <p className={`text-sm font-semibold whitespace-nowrap flex-shrink-0
                          ${trans.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {trans.type === 'income' ? '+' : '-'}{formatCurrency(trans.amount)}
                        </p>
                      </div>
                      {/* Tags */}
                      {(trans.isDuplicate || trans.autoGenerated) && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {trans.isDuplicate && (
                            <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] rounded">
                              {language === 'pt' ? 'duplicada' : 'duplicate'}
                            </span>
                          )}
                          {trans.autoGenerated && (
                            <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] rounded">
                              auto
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Edit Indicator */}
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl">
                <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('import.complete')}</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {t('import.successMessage', { count: transactions.filter(t => t.selected).length })}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-700 ${isMobile ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}`}>
        {step === 'upload' && (
          <button
            onClick={handleParse}
            disabled={!file || loading}
            className="w-full py-3.5 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl font-medium
              hover:bg-slate-800 dark:hover:bg-slate-200 hover:shadow-lg hover:shadow-slate-900/25 dark:hover:shadow-slate-50/25
              disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('import.processing')}
              </span>
            ) : t('common.continue')}
          </button>
        )}

        {step === 'preview' && (
          <button
            onClick={handleImport}
            disabled={selectedCount === 0 || importing}
            className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-medium
              hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/30
              disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {importing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('import.importing')}
              </span>
            ) : t('import.importBtn', { count: selectedCount })}
          </button>
        )}

        {step === 'done' && (
          <button
            onClick={handleClose}
            className="w-full py-3.5 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl font-medium
              hover:bg-slate-800 dark:hover:bg-slate-200 hover:shadow-lg hover:shadow-slate-900/25 dark:hover:shadow-slate-50/25
              transition-all duration-200"
          >
            {t('common.done')}
          </button>
        )}
      </div>

      {/* Edit Transaction Bottom Sheet - Full form like manual entry */}
      {editingTransaction !== null && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setEditingTransaction(null)}>
          <div
            className={`w-full bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl ${isMobile ? 'max-h-[90vh]' : 'max-w-lg max-h-[85vh]'} overflow-hidden flex flex-col`}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle (mobile) / Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              {isMobile && <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {language === 'pt' ? 'Editar Transacao' : 'Edit Transaction'}
              </h3>
              <button
                onClick={() => setEditingTransaction(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
              {/* Type Toggle */}
              <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(prev => ({ ...prev, type: 'expense' }))}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    editingTransaction.type === 'expense'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {t('transactionForm.expense')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTransaction(prev => ({ ...prev, type: 'income' }))}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    editingTransaction.type === 'income'
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
                <CurrencyInput
                  value={editingTransaction.amount}
                  onChange={(val) => setEditingTransaction(prev => ({ ...prev, amount: val }))}
                />
              </div>

              {/* Description - Always expanded */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('transactionForm.description')}
                </label>
                <textarea
                  value={editingTransaction.description}
                  onChange={(e) => setEditingTransaction(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                    text-gray-900 dark:text-white placeholder-gray-400
                    focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                    transition-all duration-200 resize-none"
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
                  value={editingTransaction.date ? editingTransaction.date.split('T')[0] : ''}
                  onChange={(e) => setEditingTransaction(prev => ({ ...prev, date: new Date(e.target.value + 'T12:00:00').toISOString() }))}
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
                  value={editingTransaction.category}
                  onChange={(e) => setEditingTransaction(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                    text-gray-900 dark:text-white
                    focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                    transition-all duration-200 appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 12px center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '20px'
                  }}
                >
                  {categories[editingTransaction.type].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Investment Type (only shown when category is Investments) */}
              {(editingTransaction.category === 'Investments' || editingTransaction.category === 'Investimentos') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('investments.type')}
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEditingTransaction(prev => ({ ...prev, investmentType: key }))}
                        className={`p-2 text-lg rounded-xl border-2 transition flex flex-col items-center gap-1 ${
                          editingTransaction.investmentType === key
                            ? 'border-gray-900 dark:border-gray-400 bg-gray-100 dark:bg-gray-700'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                        title={t(`investments.types.${key}`)}
                      >
                        <span>{info.icon}</span>
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 truncate w-full text-center">
                          {t(`investments.types.${key}`)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to Goal */}
              {availableGoals.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('goals.linkToGoal')}
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {/* No goal option */}
                    <button
                      type="button"
                      onClick={() => setEditingTransaction(prev => ({ ...prev, selectedGoalId: '', goalId: null, goalName: null }))}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                        !editingTransaction.selectedGoalId
                          ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="w-7 h-7 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center text-gray-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">{t('goals.noGoalSelected')}</span>
                    </button>

                    {/* Goal options */}
                    {availableGoals.map((goal) => {
                      const color = getGoalColor(goal.color);
                      const icon = GOAL_ICONS[goal.icon] || GOAL_ICONS.other;
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          onClick={() => setEditingTransaction(prev => ({ ...prev, selectedGoalId: goal.id, goalId: goal.id, goalName: goal.name }))}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                            editingTransaction.selectedGoalId === goal.id
                              ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <div className={`w-7 h-7 ${color.light} rounded-lg flex items-center justify-center text-sm`}>
                            {icon}
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{goal.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setEditingTransaction(null)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium
                  hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={saveEditTransaction}
                className={`flex-1 py-3 rounded-xl font-medium text-white transition-all duration-200
                  ${editingTransaction.type === 'expense'
                    ? 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700'
                    : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700'
                  }`}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Wrapper>
  );
}
