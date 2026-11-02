import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { parseFile, BANK_OPTIONS, detectBankFromFile, BANK_LABELS } from '../services/importers';
import { useSettings } from '../contexts/SettingsContext';
import { useCards, BANKS } from '../contexts/CardsContext';
import { useGoals } from '../contexts/GoalsContext';
import { useInvestments, INVESTMENT_TYPES } from '../contexts/InvestmentContext';
import { useAccess } from '../contexts/AccessContext';
import { transactionsResource } from '../lib/api/resources/transactions';
import { generateTransactionHash } from '../services/installments';
import { detectDuplicatesWithAI } from '../services/aiCategorizationService';
import { analytics } from '../services/analyticsService';
import { useIsMobile } from '../hooks/useIsMobile';
import { useFeature, useClientConfig } from '../contexts/ClientConfigContext';
import CurrencyInput from './ui/CurrencyInput';
import PlannerGoalSelect from './PlannerGoalSelect';
import ImportIssueReport from './ImportIssueReport';
import ImportSwipeSheet from './ImportSwipeSheet';
import PageHeader from './PageHeader';
import { groupByDate } from '../utils/groupByDate';
import { requireOwnerId } from '../lib/auth/ownerSession';

function ModalWrapper({ embedded, isMobile, children }) {
  if (embedded) {
    return (
      <div className="min-h-screen bg-[var(--rw-bg)] flex flex-col">
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--rw-bg)] flex flex-col">
        {children}
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[var(--rw-surface)] rounded-2xl w-full max-w-4xl max-h-[90dvh] flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function ImportTransactionCard({ trans, language, formatCurrency, onToggleSelect, onOpen }) {
  const isUncategorized = !trans.category || trans.category === 'Sem categoria';

  return (
    <div className="flex items-center gap-2.5">
      {/* Checkbox — outside card */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(trans._localId); }}
        className={`w-[22px] h-[22px] rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
          trans.selected
            ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
            : trans.isDuplicate
              ? 'border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/30'
              : 'border-gray-300 dark:border-gray-500 bg-[var(--rw-raised)]'
        }`}
      >
        {trans.selected && (
          <svg className="w-3 h-3 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Card — tapping opens edit */}
      <div
        onClick={() => onOpen(trans._localId)}
        className={`flex-1 p-3.5 rounded-2xl shadow-sm cursor-pointer transition-all active:scale-[.99] ${
          !trans.selected
            ? 'bg-gray-100 dark:bg-gray-900/50 opacity-60'
            : isUncategorized
              ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700'
              : 'bg-[var(--rw-surface)]'
        }`}
      >
        {/* Title row: type dot + title + value */}
        <div className="flex items-start gap-2.5">
          {/* Type dot — display only */}
          <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
            trans.type === 'income'
              ? 'bg-emerald-100 dark:bg-emerald-900/40'
              : 'bg-rose-100 dark:bg-rose-900/40'
          }`}>
            <svg className={`w-3 h-3 ${
              trans.type === 'income'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {trans.type === 'income' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              )}
            </svg>
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[var(--rw-ink)] line-clamp-2 leading-snug">
              {trans._isGroup ? trans._baseDescription : trans.description}
            </p>
          </div>

          {/* Value */}
          <div className="flex-shrink-0 min-w-[72px] text-right">
            <p className={`text-sm font-black whitespace-nowrap ${
              trans.type === 'income'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              {trans.type === 'income' ? '+' : '-'}
              {formatCurrency(trans._isGroup ? trans._totalAmount : trans.amount)}
            </p>
          </div>
        </div>

        {/* Second row: dupe/AI badges left, category badge right under value */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {trans.isDuplicate && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                trans.isAiDuplicate
                  ? 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              }`}>
                {trans.isAiDuplicate && '🤖 '}
                {language === 'pt' ? 'DUPLICADA' : 'DUPLICATE'}
              </span>
            )}
            {trans._isGroup && (
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                {trans.installmentTotal}x
              </span>
            )}
            {trans.aiCategorized && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)] rounded">
                🤖 AI
              </span>
            )}
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight flex-shrink-0 ${
            isUncategorized
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
              : trans.type === 'income'
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
          }`}>
            {trans.category || (language === 'pt' ? 'Sem categoria' : 'Uncategorized')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ImportModal({ isOpen = true, onClose, embedded = false }) {
  const hasB3Sync = useFeature('b3Sync');
  const clientConfig = useClientConfig();
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
  const [skippedRowCount, setSkippedRowCount] = useState(0);
  const [swipeSheetIndex, setSwipeSheetIndex] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc'); // desc = most recent first
  const contentScrollRef = useRef(null);
  const transactionsListRef = useRef(null);
  const previewScrollTopRef = useRef(0);
  const previewOuterScrollTopRef = useRef(0);
  const previewWindowScrollRef = useRef(0);
  const shouldRestorePreviewScrollRef = useRef(false);

  const [bankType, setBankType] = useState('auto');
  const [detectedBank, setDetectedBank] = useState(null);
  const [bankMismatch, setBankMismatch] = useState(false);
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
  const { addInvestment } = useInvestments();
  const { ownerId } = useAccess();

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
    if (isOpen && ownerId) {
      loadExistingHashes();
    }
  }, [isOpen, ownerId]);

  useLayoutEffect(() => {
    if (step !== 'preview' || !shouldRestorePreviewScrollRef.current) return;
    shouldRestorePreviewScrollRef.current = false;

    if (transactionsListRef.current) {
      transactionsListRef.current.scrollTop = previewScrollTopRef.current;
    }
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = previewOuterScrollTopRef.current;
    }
    window.scrollTo(0, previewWindowScrollRef.current);
  }, [step]);

  const loadExistingHashes = async () => {
    try {
      requireOwnerId(ownerId);
      const rows = await transactionsResource.list();
      const hashes = new Set();

      rows.forEach((data) => {
        if (data.dedupHash) hashes.add(data.dedupHash);
        else if (data.hash) hashes.add(data.hash);
      });
      setExistingHashes(hashes);
    } catch (err) {
      console.error('Error loading existing hashes:', err);
    }
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setPdfPassword('');
      setRequiresPdfPassword(false);
      setShowReport(false);
      setReportThanks(false);
      setParseError(null);
      setDetectedBank(null);
      setBankMismatch(false);
      try {
        const detected = await detectBankFromFile(selectedFile);
        setDetectedBank(detected);
        if (bankType !== 'auto' && bankType !== detected && detected !== 'unknown' && detected !== 'generic') {
          setBankMismatch(true);
        }
      } catch {
        // Detection failure is non-fatal
      }
    }
  };

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setSkippedRowCount(0);
    try {
      const userId = requireOwnerId(ownerId);
      const aiOptions = geminiApiKey ? { apiKey: geminiApiKey, categories } : {};
      if (pdfPassword) aiOptions.pdfPassword = pdfPassword;
      aiOptions.clientConfig = clientConfig;

      const parsed = await parseFile(file, bankType, userId, aiOptions);
      setSkippedRowCount(parsed.skippedCount || 0);

      let hashDuplicates = 0;
      let installments = 0;
      let aiCategorized = 0;

      const seenGroups = new Set();
      const afterHashFilter = parsed.map((t, index) => {
        const isDuplicate = existingHashes.has(t.dedupHash) || existingHashes.has(t.hash);
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
      const userId = requireOwnerId(ownerId);
      const toImport = transactions.filter(t => t.selected);
      for (const t of toImport) {
        const isInvestment = t.category === 'Investimentos' || t.category === 'Investments';
        const tx = await transactionsResource.create({
          userId,
          type: t.type,
          description: t.description,
          amount: t.amount,
          ignored: Boolean(t.ignored),
          category: t.category,
          date: t.date,
          imported: true,
          hash: t.hash,
          dedupHash: t.dedupHash || null,
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

        if (isInvestment && !t.ignored) {
          // createTransaction:false — the transaction already exists above; just link to it.
          await addInvestment({
            name: t.ticker || t.fundName || t.coinName || t.description,
            type: t.investmentType || 'fixed_income',
            bank: t.platform || selectedBankId || '',
            initialAmount: t.amount,
            currentAmount: t.amount,
            expectedReturn: t.expectedReturn != null ? parseFloat(t.expectedReturn) / 100 : 0,
            returnType: t.returnType || 'annual',
            purchaseDate: t.date ? t.date.split('T')[0] : undefined,
            maturityDate: t.maturityDate || null,
            goalId: t.goalId || null,
            plannerGoalId: t.plannerGoalId || null,
            ticker: t.ticker || null,
            platform: t.platform || null,
            coinName: t.coinName || null,
            fundName: t.fundName || null,
            transactionId: tx?.id,
          }, false);
        }
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

  const selectedCount = transactions.filter(t => t.selected).length;

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

  const openSwipeSheet = (localId) => {
    const index = sortedTransactions.main.findIndex(t => t._localId === localId);
    if (index !== -1) setSwipeSheetIndex(index);
  };

  const patchDraftTransaction = (localId, patch) => {
    setTransactions(prev => {
      const target = prev.find(t => t._localId === localId);
      const groupId = target?.installmentGroupId;
      return prev.map(t => {
        if (t._localId === localId) return { ...t, ...patch };
        if (groupId && t.installmentGroupId === groupId) {
          const groupPatch = {};
          if ('category' in patch) groupPatch.category = patch.category;
          if ('type' in patch) { groupPatch.type = patch.type; groupPatch.category = 'Sem categoria'; }
          if ('selected' in patch) groupPatch.selected = patch.selected;
          return Object.keys(groupPatch).length ? { ...t, ...groupPatch } : t;
        }
        return t;
      });
    });
  };

  const handleClose = () => {
    setFile(null); setTransactions([]); setStep('upload'); setError('');
    setDuplicateCount(0); setAiDuplicateCount(0); setInstallmentCount(0); setAiCount(0);
    setShowReport(false); setReportThanks(false); setParseError(null); setDetectedHeaders([]); setBankType('auto');
    setDetectedBank(null); setBankMismatch(false);
    onClose();
  };

  if (!embedded && !isOpen) return null;

  return (
    <ModalWrapper embedded={embedded} isMobile={isMobile}>
      {/* Header */}
      {embedded ? (
        <PageHeader title={t('import.title')} showMonth={false} backTo="/dashboard" />
      ) : (
        <div className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--rw-border)] ${isMobile ? 'bg-[var(--rw-surface)]' : ''}`}>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--rw-ink)]">{t('import.title')}</h2>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Content */}
      <div ref={contentScrollRef} className={`flex-1 ${embedded ? 'max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6' : `p-4 sm:p-6 ${isMobile ? 'bg-[var(--rw-bg)]' : ''}`} ${step === 'preview' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {step === 'upload' && (
          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-xs font-black text-[var(--rw-muted)] mb-2 uppercase tracking-widest">{language === 'pt' ? 'Banco de Destino' : 'Target Bank'}</label>
              <select value={selectedBankId || ''} onChange={handleBankSelect} className="w-full px-4 py-3 bg-[var(--rw-surface)] text-[var(--rw-ink)] border border-[var(--rw-border)] rounded-2xl text-sm focus:ring-2 focus:ring-[var(--rw-brand)] appearance-none shadow-sm">
                <option value="">💵 {language === 'pt' ? 'Dinheiro / Sem banco' : 'Cash / No bank'}</option>
                {userBanks.map((ub) => <option key={ub.id} value={ub.id}>{getBankInfo(ub.bankId).icon} {getBankDisplayName(ub)}</option>)}
              </select>
              {selectedBankId && userBanks.find(b => b.id === selectedBankId)?.hasCredit && (
                <div className="mt-3 flex p-1 bg-[var(--rw-raised)] rounded-xl shadow-inner">
                  <button onClick={() => setImportPaymentMethod('debit')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${importPaymentMethod !== 'credit' ? 'bg-[var(--rw-raised)] shadow-sm' : 'text-gray-500'}`}>🏦 CONTA</button>
                  <button onClick={() => setImportPaymentMethod('credit')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${importPaymentMethod === 'credit' ? 'bg-[var(--rw-raised)] shadow-sm' : 'text-gray-500'}`}>💳 CARTÃO</button>
                </div>
              )}
            </div>

            {detectedBank && bankType === 'auto' && (
              <p className="text-sm text-[var(--rw-muted)] -mt-2">
                Banco detectado: <span className="font-medium text-[var(--rw-ink)]">{BANK_LABELS[detectedBank] || detectedBank}</span>
              </p>
            )}
            {bankMismatch && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Este arquivo parece ser do <strong>{BANK_LABELS[detectedBank]}</strong>, não do <strong>{BANK_LABELS[bankType]}</strong>.
                </p>
                <div className="mt-2 flex gap-2">
                  <button className="text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    onClick={() => { setBankType(detectedBank); setBankMismatch(false); }}>
                    Usar {BANK_LABELS[detectedBank]}
                  </button>
                  <button className="text-xs px-2 py-1 text-yellow-700 dark:text-yellow-300 underline"
                    onClick={() => setBankMismatch(false)}>
                    Manter {BANK_LABELS[bankType]}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-[var(--rw-muted)] mb-2 uppercase tracking-widest">{language === 'pt' ? 'Selecionar Arquivo' : 'Select File'}</label>
              <label className="block cursor-pointer">
                <div className="w-full py-8 px-4 bg-[var(--rw-surface)] border-2 border-dashed border-[var(--rw-border)] rounded-2xl text-center hover:border-violet-400 transition-colors shadow-sm">
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="text-sm font-bold truncate max-w-full px-4 text-[var(--rw-ink)]">{file.name}</p>
                      <button onClick={(e) => {e.preventDefault(); setFile(null); setPdfPassword(''); setRequiresPdfPassword(false);}} className="text-xs text-rose-500 font-bold uppercase underline">remover</button>
                    </div>
                  ) : (
                    <>
                      <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      <p className="text-sm font-bold text-[var(--rw-ink)]">CSV ou PDF</p>
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
                  className="w-full rounded-lg border border-[var(--rw-border)] bg-[var(--rw-surface)] px-3 py-2 text-sm text-[var(--rw-ink)]"
                  autoFocus
                />
                <p className="text-xs text-[var(--rw-muted)] mt-1">
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

        {step === 'preview' && (
          <div className="h-full flex flex-col gap-4">
            {/* Top bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('upload')}
                  className="px-3 py-2 bg-[var(--rw-raised)] text-[var(--rw-ink)] rounded-xl text-xs font-bold uppercase tracking-tight"
                >
                  ← {t('common.back')}
                </button>
                <span className="px-3 py-1.5 bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)] rounded-full text-xs font-bold uppercase">
                  {sortedTransactions.main.length + sortedTransactions.duplicates.length}{' '}
                  {language === 'pt' ? 'transações' : 'transactions'}
                </span>
              </div>
              {/* Select all / Clear */}
              <div className="flex gap-1.5">
                <button
                  onClick={selectAllTransactions}
                  className="px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-[11px] font-black uppercase tracking-tight"
                >
                  {language === 'pt' ? 'Selecionar tudo' : 'Select all'}
                </button>
                <button
                  onClick={deselectAllTransactions}
                  className="px-3 py-1.5 border border-[var(--rw-border)] rounded-lg text-[11px] font-black uppercase tracking-tight text-[var(--rw-ink)]"
                >
                  {language === 'pt' ? 'Limpar' : 'Clear'}
                </button>
              </div>
            </div>

            {skippedRowCount > 0 && (
              <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-xs font-bold text-amber-800 dark:text-amber-200">
                {language === 'pt'
                  ? `${skippedRowCount} linha(s) do arquivo foram ignoradas por não corresponderem ao período do extrato. Confira o arquivo se o número de transações parecer menor que o esperado.`
                  : `${skippedRowCount} row(s) in the file were skipped because they didn't match the statement period. Double-check the file if the transaction count looks lower than expected.`}
              </div>
            )}

            <div ref={transactionsListRef} className="flex-1 overflow-y-auto min-h-0 pb-20">
              {groupByDate(sortedTransactions.main).map(({ date, transactions: group }) => (
                <div key={date} className="mb-4">
                  {/* Date header */}
                  <div className="text-xs font-black uppercase tracking-widest text-[var(--rw-subtle)] px-1 pb-2">
                    {new Date(date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div className="flex flex-col gap-2">
                    {group.map(trans => (
                      <ImportTransactionCard
                        key={trans._localId}
                        trans={trans}
                        language={language}
                        formatCurrency={formatCurrency}
                        onToggleSelect={toggleTransactionSelection}
                        onOpen={openSwipeSheet}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Duplicates section */}
              {sortedTransactions.duplicates.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--rw-border)]">
                  <button
                    onClick={() => setIsDuplicatesExpanded(!isDuplicatesExpanded)}
                    className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl mb-2"
                  >
                    <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                      {language === 'pt' ? 'Duplicadas' : 'Duplicates'} ({sortedTransactions.duplicates.length})
                    </span>
                    <svg
                      className={`w-4 h-4 text-amber-500 transition-transform ${isDuplicatesExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isDuplicatesExpanded && (
                    <div className="flex flex-col gap-2">
                      {sortedTransactions.duplicates.map(trans => (
                        <ImportTransactionCard
                          key={trans._localId}
                          trans={trans}
                          locale={locale}
                          language={language}
                          formatCurrency={formatCurrency}
                          onToggleSelect={toggleTransactionSelection}
                          onOpen={openSwipeSheet}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-black text-[var(--rw-ink)] uppercase tracking-tight">{t('import.complete')}</h3>
            <p className="mt-2 text-[var(--rw-muted)] font-medium">Tudo pronto! Seus dados foram importados.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={embedded
        ? 'sticky bottom-0 z-10 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-[var(--rw-border)] px-4 sm:px-6 py-4'
        : `px-4 sm:px-6 py-4 border-t border-[var(--rw-border)] ${isMobile ? 'bg-[var(--rw-surface)]' : 'bg-[var(--rw-bg)]'}`
      }>
        <div className={embedded ? 'max-w-7xl mx-auto' : ''}>
          {step === 'upload' && (
            <button onClick={handleParse} disabled={!file || loading} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50 transition-all shadow-xl shadow-slate-900/20 active:scale-95">
              {loading ? 'PROCESSANDO...' : t('common.continue')}
            </button>
          )}
          {step === 'preview' && (
            <button onClick={handleImport} disabled={selectedCount === 0 || importing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50 transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
              {importing ? 'IMPORTANDO...' : t('import.importBtn', { count: selectedCount })}
            </button>
          )}
          {step === 'done' && (
            <button onClick={handleClose} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95">
              FECHAR
            </button>
          )}
        </div>
      </div>

      {swipeSheetIndex !== null && (
        <ImportSwipeSheet
          transactions={sortedTransactions.main}
          initialIndex={swipeSheetIndex}
          isCreditCard={importPaymentMethod === 'credit'}
          onUpdate={patchDraftTransaction}
          onClose={() => setSwipeSheetIndex(null)}
        />
      )}
    </ModalWrapper>
  );
}
