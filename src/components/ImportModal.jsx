import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { db, auth, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { parseFile, BANK_OPTIONS } from '../services/importers';
import { useSettings } from '../contexts/SettingsContext';
import { useCards, BANKS } from '../contexts/CardsContext';
import { useGoals } from '../contexts/GoalsContext';
import { useInvestments, INVESTMENT_TYPES } from '../contexts/InvestmentContext';
import { useAccess } from '../contexts/AccessContext';
import { generateTransactionHash } from '../services/installments';
import { detectDuplicatesWithAI } from '../services/aiCategorizationService';
import { analytics } from '../services/analyticsService';
import { useIsMobile } from '../hooks/useIsMobile';
import { useFeature } from '../contexts/ClientConfigContext';
import CurrencyInput from './ui/CurrencyInput';
import PlannerGoalSelect from './PlannerGoalSelect';
import ImportIssueReport from './ImportIssueReport';

function ModalWrapper({ embedded, isMobile, children }) {
  if (embedded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {children}
        </div>
      </div>
    );
  }

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
}

function TransactionRowContent({
  trans, locale, language, formatCurrency,
  toggleTransactionSelection, toggleTransactionType,
  handleQuickCategoryChange, categories
}) {
  return (
    <div className="flex items-start gap-3">
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleTransactionSelection(trans._localId); }}
        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors mt-0.5
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

      {/* Type Indicator - Always visible but smaller on mobile */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleTransactionType(trans._localId); }}
        className={`flex w-7 h-7 sm:w-8 sm:h-8 rounded-full items-center justify-center flex-shrink-0 transition-colors active:scale-95 mt-0.5
        ${trans.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-rose-100 dark:bg-rose-900/40'}`}
      >
        <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${trans.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {trans.type === 'income' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          )}
        </svg>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={trans._isGroup ? trans._baseDescription : trans.description}>
              {trans._isGroup ? trans._baseDescription : trans.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1 min-w-0">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
                {new Date(trans.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
              </span>
              <span className="text-gray-300 dark:text-gray-600 text-[10px]">•</span>

              {/* Native Category Selector Styled as Badge */}
              <div className="relative inline-flex items-center min-w-0" onClick={e => e.stopPropagation()}>
                <select
                  value={trans.category || ''}
                  onChange={(e) => handleQuickCategoryChange(trans._localId, e.target.value)}
                  className={`appearance-none pl-2 pr-6 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-tight transition-colors cursor-pointer border-0 ring-0 focus:ring-2 focus:ring-violet-500 max-w-[120px] truncate ${
                    !trans.category || trans.category === 'Sem categoria'
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                      : trans.type === 'income'
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  <option value="" disabled>{language === 'pt' ? 'CATEGORIZAR' : 'CATEGORIZE'}</option>
                  {(categories[trans.type] || []).map(cat => (
                    <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                  ))}
                </select>
                <svg className="absolute right-1.5 w-3 h-3 pointer-events-none text-current opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {trans.isInstallment && (
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
                  {trans._isGroup ? `${trans.installmentTotal}x` : `${trans.installmentCurrent}/${trans.installmentTotal}`}
                </span>
              )}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <p className={`text-sm font-bold whitespace-nowrap
              ${trans.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {trans.type === 'income' ? '+' : '-'}{formatCurrency(trans._isGroup ? trans._totalAmount : trans.amount)}
            </p>
            {trans._isGroup && (
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                {trans.installmentTotal}x {formatCurrency(trans.amount)}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        {(trans.isDuplicate || trans.autoGenerated || trans.aiCategorized || trans._isGroup) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {trans._isGroup && (
              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {language === 'pt' ? 'PARCELADO' : 'GROUPED'}
              </span>
            )}
            {trans.isDuplicate && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex items-center gap-0.5 ${
                trans.isAiDuplicate
                  ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              }`}>
                {trans.isAiDuplicate && '🤖 '}
                {language === 'pt' ? 'DUPLICADA' : 'DUPLICATE'}
              </span>
            )}
            {trans.autoGenerated && !trans._isGroup && (
              <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded">
                AUTO
              </span>
            )}
            {trans.aiCategorized && (
              <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-bold rounded flex items-center gap-0.5">
                🤖 AI
              </span>
            )}
          </div>
        )}
      </div>

      {/* Edit Indicator */}
      <div className="flex items-center self-stretch">
        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

export default function ImportModal({ isOpen = true, onClose, embedded = false }) {
  const hasB3Sync = useFeature('b3Sync');
  const isMobile = useIsMobile();
  const [file, setFile] = useState(null);
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [importPaymentMethod, setImportPaymentMethod] = useState('debit');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');
  const [requiresPdfPassword, setRequiresPdfPassword] = useState(false);
  const [step, setStep] = useState('upload'); // upload, preview, done, uploading, processing
  const [existingHashes, setExistingHashes] = useState(new Set());
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [installmentCount, setInstallmentCount] = useState(0);
  const [aiCount, setAiCount] = useState(0);
  const [aiDuplicateCount, setAiDuplicateCount] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [previewView, setPreviewView] = useState('list'); // list | edit
  const [sortOrder, setSortOrder] = useState('desc'); // desc = most recent first
  const contentScrollRef = useRef(null);
  const transactionsListRef = useRef(null);
  const previewScrollTopRef = useRef(0);
  const previewOuterScrollTopRef = useRef(0);
  const previewWindowScrollRef = useRef(0);
  const shouldRestorePreviewScrollRef = useRef(false);

  const [bankType, setBankType] = useState('auto');
  const [showReport, setShowReport] = useState(false);
  const [reportThanks, setReportThanks] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [detectedHeaders, setDetectedHeaders] = useState([]);

  const [uploadProgress, setUploadProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [isB3Import, setIsB3Import] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [b3PlannerGoalId, setB3PlannerGoalId] = useState('');

  const { formatCurrency, categories, t, language, geminiApiKey } = useSettings();
  const { userBanks, getBankInfo, getBankDisplayName } = useCards();
  const { goals } = useGoals();
  const { ownerId } = useAccess();

  const availableGoals = goals.filter(g => !g.completed);
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const handleBankSelect = (e) => {
    const val = e.target.value;
    if (!val) { setSelectedBankId(null); setImportPaymentMethod('debit'); setShowReport(false); setReportThanks(false); setParseError(null); return; }
    setSelectedBankId(val);
    setShowReport(false);
    setReportThanks(false);
    setParseError(null);
    const bank = userBanks.find(b => b.id === val);
    if (!bank?.hasCredit) setImportPaymentMethod('debit');
  };

  useEffect(() => {
    if (isOpen && (ownerId || auth.currentUser?.uid)) {
      loadExistingHashes();
    }
  }, [isOpen, ownerId]);

  useLayoutEffect(() => {
    if (step !== 'preview' || previewView !== 'list' || !shouldRestorePreviewScrollRef.current) return;
    shouldRestorePreviewScrollRef.current = false;

    if (transactionsListRef.current) {
      transactionsListRef.current.scrollTop = previewScrollTopRef.current;
    }
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = previewOuterScrollTopRef.current;
    }
    window.scrollTo(0, previewWindowScrollRef.current);
  }, [step, previewView]);

  const loadExistingHashes = async () => {
    try {
      const userId = ownerId || auth.currentUser?.uid;
      if (!userId) return;

      const q = query(collection(db, 'transactions'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const hashes = new Set();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.hash) hashes.add(data.hash);
        else hashes.add(generateTransactionHash({ date: data.date, description: data.description, amount: data.amount }));
      });
      setExistingHashes(hashes);
    } catch (err) {
      console.error('Error loading existing hashes:', err);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setPdfPassword('');
      setRequiresPdfPassword(false);
      setShowReport(false);
      setReportThanks(false);
      setParseError(null);
    }
  };

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const userId = ownerId || auth.currentUser?.uid;
      const aiOptions = geminiApiKey ? { apiKey: geminiApiKey, categories } : {};
      if (pdfPassword) aiOptions.pdfPassword = pdfPassword;

      const parsed = await parseFile(file, bankType, userId, aiOptions);

      let hashDuplicates = 0;
      let installments = 0;
      let aiCategorized = 0;

      const seenGroups = new Set();
      const afterHashFilter = parsed.map((t, index) => {
        const isDuplicate = existingHashes.has(t.hash);
        if (isDuplicate) hashDuplicates++;
        if (t.isInstallment && t.installmentGroupId && !seenGroups.has(t.installmentGroupId)) {
          installments++;
          seenGroups.add(t.installmentGroupId);
        }
        if (t.aiCategorized) aiCategorized++;
        return {
          _localId: `${t.hash || 'tx'}-${index}-${Math.random().toString(36).slice(2, 9)}`,
          ...t,
          isDuplicate,
          selected: !isDuplicate
        };
      });

      setDuplicateCount(hashDuplicates);
      setInstallmentCount(installments);
      setAiCount(aiCategorized);
      setTransactions(afterHashFilter);

      if (afterHashFilter.length === 0) {
        const selectedOpt = BANK_OPTIONS.find((o) => o.value === bankType);
        if (selectedOpt?.status === 'manual') {
          setParseError(new Error(`Banco "${selectedOpt.label}" ainda não tem parser automático. Envie o arquivo para o time analisar.`));
        }
        setShowReport(true);
      } else {
        setStep('preview');
      }
    } catch (err) {
      if (err.code === 'PDF_PASSWORD_REQUIRED') {
        setRequiresPdfPassword(true);
        setLoading(false);
        return;
      }
      setParseError(err);
      setShowReport(true);
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
          paymentMethod: selectedBankId ? importPaymentMethod : null,
          isInstallment: t.isInstallment || false,
          installmentCurrent: t.installmentCurrent || null,
          installmentTotal: t.installmentTotal || null,
          installmentGroupId: t.installmentGroupId || null,
          autoGenerated: t.autoGenerated || false,
          goalId: t.goalId || null,
          goalName: t.goalName || null,
          plannerGoalId: t.plannerGoalId || null,
          investmentType: t.investmentType || null,
          ticker: t.ticker || null,
          platform: t.platform || null,
          coinName: t.coinName || null,
          fundName: t.fundName || null,
          propertyDescription: t.propertyDescription || null,
          expectedReturn: t.expectedReturn != null ? parseFloat(t.expectedReturn) / 100 : null,
          returnType: t.returnType || null,
          maturityDate: t.maturityDate || null,
          metadata: t.metadata || null
        });
      }
      setStep('done');
    } catch (err) {
      setError(err.message || 'Failed to import transactions');
    } finally {
      setImporting(false);
    }
  };

  const toggleTransactionSelection = (transactionId) => {
    const target = transactions.find(t => t._localId === transactionId);
    const groupId = target?.installmentGroupId;
    setTransactions(prev => prev.map((t) => {
      if (t._localId === transactionId || (groupId && t.installmentGroupId === groupId)) {
        return { ...t, selected: !target.selected };
      }
      return t;
    }));
  };

  const toggleTransactionType = (transactionId) => {
    const target = transactions.find(t => t._localId === transactionId);
    const groupId = target?.installmentGroupId;
    const newType = target?.type === 'income' ? 'expense' : 'income';
    setTransactions(prev => prev.map((t) => {
      if (t._localId === transactionId || (groupId && t.installmentGroupId === groupId)) {
        return { ...t, type: newType, category: 'Sem categoria' };
      }
      return t;
    }));
  };

  const handleQuickCategoryChange = (transactionId, newCategory) => {
    const target = transactions.find(t => t._localId === transactionId);
    const groupId = target?.installmentGroupId;
    setTransactions(prev => prev.map((t) => {
      if (t._localId === transactionId || (groupId && t.installmentGroupId === groupId)) {
        return { ...t, category: newCategory, autoCategory: false };
      }
      return t;
    }));
  };

  const selectedCount = transactions.filter(t => t.selected).length;
  const hasSelectableTransactions = transactions.some(t => !t.isDuplicate);
  const allSelectableSelected = hasSelectableTransactions && transactions.every(t => t.isDuplicate || t.selected);

  const selectAllTransactions = () => setTransactions(prev => prev.map(t => (t.isDuplicate ? t : { ...t, selected: true })));
  const deselectAllTransactions = () => setTransactions(prev => prev.map(t => ({ ...t, selected: false })));

  const [isDuplicatesExpanded, setIsDuplicatesExpanded] = useState(false);

  const sortedTransactions = useMemo(() => {
    const groups = new Map();
    const main = [];
    const duplicates = [];
    
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sorted.forEach(t => {
      if (t.installmentGroupId) {
        if (!groups.has(t.installmentGroupId)) {
          const rep = { ...t, _isGroup: true, _groupTransactions: [t], _baseDescription: t.description.replace(/\s*\(\d+\/\d+\)$/, ''), _totalAmount: t.amount * t.installmentTotal };
          groups.set(t.installmentGroupId, rep);
          if (t.isDuplicate) duplicates.push(rep); else main.push(rep);
        } else {
          groups.get(t.installmentGroupId)._groupTransactions.push(t);
        }
      } else {
        if (t.isDuplicate) duplicates.push(t); else main.push(t);
      }
    });

    const sortFn = (a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    };

    return { main: main.sort(sortFn), duplicates: duplicates.sort(sortFn) };
  }, [transactions, sortOrder]);

  const openEditTransaction = (transactionId) => {
    previewOuterScrollTopRef.current = contentScrollRef.current?.scrollTop ?? 0;
    previewScrollTopRef.current = transactionsListRef.current?.scrollTop ?? 0;
    previewWindowScrollRef.current = window.scrollY;
    const transaction = transactions.find(t => t._localId === transactionId);
    if (!transaction) return;
    setEditingTransaction({ ...transaction, transactionId, selectedGoalId: transaction.goalId || '', selectedPlannerGoalId: transaction.plannerGoalId || '', investmentType: transaction.investmentType || 'fixed_income' });
    setPreviewView('edit');
  };

  const saveEditTransaction = () => {
    if (editingTransaction === null) return;
    const { transactionId, selectedGoalId, selectedPlannerGoalId, ...updates } = editingTransaction;
    const groupId = updates.installmentGroupId;
    const baseDescription = updates.description.replace(/\s*\(\d+\/\d+\)$/, '');
    const editedDate = new Date(updates.date);

    setTransactions(prev => prev.map((t) => {
      if (t._localId === transactionId || (groupId && t.installmentGroupId === groupId)) {
        const newT = {
          ...t, category: updates.category, type: updates.type, amount: updates.amount,
          goalId: selectedGoalId || null, goalName: selectedGoalId ? availableGoals.find(g => g.id === selectedGoalId)?.name || null : null,
          plannerGoalId: selectedPlannerGoalId || null, autoCategory: false, investmentType: updates.investmentType,
          ticker: updates.ticker, platform: updates.platform, coinName: updates.coinName, fundName: updates.fundName,
          propertyDescription: updates.propertyDescription, expectedReturn: updates.expectedReturn, returnType: updates.returnType, maturityDate: updates.maturityDate,
        };
        if (t._localId === transactionId) return { ...newT, description: updates.description, date: updates.date };
        return { ...newT, description: `${baseDescription} (${t.installmentCurrent}/${t.installmentTotal})`, date: new Date(new Date(editedDate).setMonth(editedDate.getMonth() + (t.installmentCurrent - updates.installmentCurrent))).toISOString() };
      }
      return t;
    }));
    setEditingTransaction(null);
    shouldRestorePreviewScrollRef.current = true;
    setPreviewView('list');
  };

  const handleClose = () => {
    setFile(null); setTransactions([]); setStep('upload'); setError('');
    setDuplicateCount(0); setAiDuplicateCount(0); setInstallmentCount(0); setAiCount(0);
    setPreviewView('list'); setShowReport(false); setReportThanks(false); setParseError(null); setDetectedHeaders([]); setBankType('auto');
    onClose();
  };

  if (!embedded && !isOpen) return null;

  return (
    <ModalWrapper embedded={embedded} isMobile={isMobile}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 ${isMobile ? 'bg-white dark:bg-gray-800' : ''}`}>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{t('import.title')}</h2>
        <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Content */}
      <div ref={contentScrollRef} className={`flex-1 p-4 sm:p-6 ${step === 'preview' ? 'overflow-hidden' : 'overflow-y-auto'} ${isMobile ? 'bg-gray-50 dark:bg-gray-900' : ''}`}>
        {step === 'upload' && (
          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-xs font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">{language === 'pt' ? 'Banco de Destino' : 'Target Bank'}</label>
              <select value={selectedBankId || ''} onChange={handleBankSelect} className="w-full px-4 py-3 bg-white dark:bg-gray-800 text-slate-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-violet-500 appearance-none shadow-sm">
                <option value="">💵 {language === 'pt' ? 'Dinheiro / Sem banco' : 'Cash / No bank'}</option>
                {userBanks.map((ub) => <option key={ub.id} value={ub.id}>{getBankInfo(ub.bankId).icon} {getBankDisplayName(ub)}</option>)}
              </select>
              {selectedBankId && userBanks.find(b => b.id === selectedBankId)?.hasCredit && (
                <div className="mt-3 flex p-1 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
                  <button onClick={() => setImportPaymentMethod('debit')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${importPaymentMethod !== 'credit' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'}`}>🏦 CONTA</button>
                  <button onClick={() => setImportPaymentMethod('credit')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${importPaymentMethod === 'credit' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'}`}>💳 CARTÃO</button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">{language === 'pt' ? 'Banco do Arquivo' : 'File Bank'}</label>
              <div className="relative">
                <select
                  value={bankType}
                  onChange={(e) => { setBankType(e.target.value); setShowReport(false); setReportThanks(false); setParseError(null); }}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 text-slate-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-violet-500 appearance-none shadow-sm"
                >
                  {BANK_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}{opt.status === 'manual' ? '  ·  Manual' : ''}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">{language === 'pt' ? 'Selecionar Arquivo' : 'Select File'}</label>
              <label className="block cursor-pointer">
                <div className="w-full py-8 px-4 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl text-center hover:border-violet-400 transition-colors shadow-sm">
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="text-sm font-bold truncate max-w-full px-4">{file.name}</p>
                      <button onClick={(e) => {e.preventDefault(); setFile(null); setPdfPassword(''); setRequiresPdfPassword(false);}} className="text-xs text-rose-500 font-bold uppercase underline">remover</button>
                    </div>
                  ) : (
                    <>
                      <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">CSV, XLS, XLSX ou PDF</p>
                    </>
                  )}
                </div>
                <input type="file" accept=".csv,.xlsx,.xls,.pdf" onChange={handleFileSelect} className="hidden" />
              </label>
            </div>

            {requiresPdfPassword && (
              <div className="mt-3 p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                  Esse PDF é protegido por senha.
                </p>
                <input
                  type="password"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  placeholder="Senha do PDF"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  A senha não é armazenada — usada apenas para abrir o arquivo.
                </p>
              </div>
            )}

            {showReport && !reportThanks && (
              <ImportIssueReport
                file={file}
                bankType={selectedBankId || 'auto'}
                parserUsed={selectedBankId || 'auto'}
                detectedHeaders={detectedHeaders}
                errorMessage={parseError?.message}
                onDone={(res) => {
                  if (res?.ok) {
                    setReportThanks(true);
                  } else if (res?.dismissed) {
                    setShowReport(false);
                  }
                }}
              />
            )}
            {reportThanks && (
              <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                Obrigado! Recebemos seu arquivo, vamos olhar com carinho.
              </div>
            )}
          </div>
        )}

        {step === 'preview' && previewView === 'list' && (
          <div className="h-full flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setStep('upload')} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-tight">← {t('common.back')}</button>
              <span className="px-3 py-1.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-xs font-bold uppercase">{sortedTransactions.main.length + sortedTransactions.duplicates.length} {language === 'pt' ? 'transações' : 'transactions'}</span>
            </div>

            <div ref={transactionsListRef} className="flex-1 overflow-y-auto min-h-0 space-y-2 pb-20">
              {sortedTransactions.main.map(trans => (
                <div key={trans._localId} onClick={() => openEditTransaction(trans._localId)} className={`p-3 rounded-2xl transition-all shadow-sm ${trans.selected ? 'bg-white dark:bg-gray-800' : 'bg-gray-100 dark:bg-gray-900/50 opacity-60'}`}>
                  <TransactionRowContent
                    trans={trans} locale={locale} language={language} formatCurrency={formatCurrency}
                    toggleTransactionSelection={toggleTransactionSelection} toggleTransactionType={toggleTransactionType}
                    handleQuickCategoryChange={handleQuickCategoryChange} categories={categories}
                  />
                </div>
              ))}
              
              {sortedTransactions.duplicates.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button onClick={() => setIsDuplicatesExpanded(!isDuplicatesExpanded)} className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Duplicadas ({sortedTransactions.duplicates.length})</span>
                    <svg className={`w-4 h-4 text-amber-500 transition-transform ${isDuplicatesExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {isDuplicatesExpanded && (
                    <div className="mt-2 space-y-2">
                      {sortedTransactions.duplicates.map(trans => (
                        <div key={trans._localId} onClick={() => openEditTransaction(trans._localId)} className="p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl opacity-70">
                          <TransactionRowContent
                            trans={trans} locale={locale} language={language} formatCurrency={formatCurrency}
                            toggleTransactionSelection={toggleTransactionSelection} toggleTransactionType={toggleTransactionType}
                            handleQuickCategoryChange={handleQuickCategoryChange} categories={categories}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'preview' && previewView === 'edit' && editingTransaction && (
          <div className="space-y-6 pb-20">
            <button onClick={() => setPreviewView('list')} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-tight">← Cancelar</button>
            <div className="space-y-4 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
                <button onClick={() => setEditingTransaction(prev => ({ ...prev, type: 'expense' }))} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${editingTransaction.type === 'expense' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'}`}>SAÍDA</button>
                <button onClick={() => setEditingTransaction(prev => ({ ...prev, type: 'income' }))} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${editingTransaction.type === 'income' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'}`}>ENTRADA</button>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('transactionForm.amount')}</label>
                <CurrencyInput value={editingTransaction.amount} onChange={(v) => setEditingTransaction(prev => ({ ...prev, amount: v }))} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('transactionForm.description')}</label>
                <input type="text" value={editingTransaction.description} onChange={(e) => setEditingTransaction(prev => ({ ...prev, description: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 text-slate-900 dark:text-white border-0 rounded-xl text-sm font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('transactionForm.category')}</label>
                <select value={editingTransaction.category} onChange={(e) => setEditingTransaction(prev => ({ ...prev, category: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 text-slate-900 dark:text-white border-0 rounded-xl text-sm font-semibold appearance-none">
                  {categories[editingTransaction.type].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('import.complete')}</h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">Tudo pronto! Seus dados foram importados.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-700 ${isMobile ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}`}>
        {step === 'upload' && (
          <button onClick={handleParse} disabled={!file || loading} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50 transition-all shadow-xl shadow-slate-900/20 active:scale-95">
            {loading ? 'PROCESSANDO...' : t('common.continue')}
          </button>
        )}
        {step === 'preview' && previewView === 'list' && (
          <button onClick={handleImport} disabled={selectedCount === 0 || importing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50 transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
            {importing ? 'IMPORTANDO...' : t('import.importBtn', { count: selectedCount })}
          </button>
        )}
        {step === 'preview' && previewView === 'edit' && (
          <button onClick={saveEditTransaction} className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-violet-600/20 active:scale-95">
            SALVAR ALTERAÇÕES
          </button>
        )}
        {step === 'done' && (
          <button onClick={handleClose} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95">
            FECHAR
          </button>
        )}
      </div>
    </ModalWrapper>
  );
}
