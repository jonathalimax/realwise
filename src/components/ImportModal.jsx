import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo, Fragment } from 'react';
import { db, auth, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { parseFile } from '../services/importers';
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
import CategoryPicker from './ui/CategoryPicker';
import PlannerGoalSelect from './PlannerGoalSelect';

// Defined at module level so its reference is stable across renders.
// If defined inside ImportModal, React sees a new component type on every render
// and unmounts/remounts the entire subtree, destroying scroll position.
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

function TransactionRowContent({ trans, locale, language, formatCurrency, toggleTransactionSelection, toggleTransactionType, openCategoryPicker }) {
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

      {/* Type Indicator - Hidden on mobile to save space */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleTransactionType(trans._localId); }}
        className={`hidden sm:flex w-8 h-8 rounded-full items-center justify-center flex-shrink-0 transition-colors active:scale-95
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

      {/* Content - Mobile-first layout */}
      <div className="flex-1 min-w-0">
        {/* Mobile: Title on its own row for full visibility */}
        <div className="sm:hidden">
          <p className="text-sm font-medium text-gray-900 dark:text-white" title={trans._isGroup ? trans._baseDescription : trans.description}>
            {trans._isGroup ? trans._baseDescription : trans.description}
          </p>
          {/* Second row: date, category badge, amount */}
          <div className="flex items-center justify-between mt-1.5 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                {new Date(trans.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
              </span>
              {/* Tappable Category Badge */}
              <button
                onClick={(e) => openCategoryPicker(trans._localId, e)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition-all flex-shrink-0 active:scale-95 ${
                  !trans.category
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                    : trans.type === 'income'
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                }`}
              >
                {trans.category || (language === 'pt' ? 'Categorizar' : 'Needs Category')}
                <svg className="w-3 h-3 ml-0.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {trans.isInstallment && (
                <span className="text-[11px] text-blue-600 dark:text-blue-400 flex-shrink-0">
                  {trans._isGroup ? `${trans.installmentTotal}x` : `${trans.installmentCurrent}/${trans.installmentTotal}`}
                </span>
              )}
            </div>
            {/* Amount */}
            <p className={`font-semibold whitespace-nowrap flex-shrink-0 text-sm
              ${trans.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {trans.type === 'income' ? '+' : '-'}{formatCurrency(trans._isGroup ? trans._totalAmount : trans.amount)}
            </p>
          </div>
        </div>

        {/* Desktop: Horizontal layout */}
        <div className="hidden sm:block">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1" title={trans._isGroup ? trans._baseDescription : trans.description}>
                {trans._isGroup ? trans._baseDescription : trans.description}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span>{new Date(trans.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                {/* Tappable Category Badge - Desktop */}
                <button
                  onClick={(e) => openCategoryPicker(trans._localId, e)}
                  className={`px-2 py-0.5 text-xs font-medium rounded-full transition-all hover:opacity-80 active:scale-95 ${
                    !trans.category
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                      : trans.type === 'income'
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {trans.category || (language === 'pt' ? 'Categorizar' : 'Needs Category')}
                  <svg className="w-3 h-3 ml-0.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {trans.isInstallment && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {trans._isGroup 
                        ? (language === 'pt' ? `${trans.installmentTotal} parcelas` : `${trans.installmentTotal} installments`)
                        : `${trans.installmentCurrent}/${trans.installmentTotal}`}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold whitespace-nowrap flex-shrink-0
                ${trans.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {trans.type === 'income' ? '+' : '-'}{formatCurrency(trans._isGroup ? trans._totalAmount : trans.amount)}
              </p>
              {trans._isGroup && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  {trans.installmentTotal}x {formatCurrency(trans.amount)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        {(trans.isDuplicate || trans.autoGenerated || trans.aiCategorized || trans._isGroup) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {trans._isGroup && (
              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] rounded flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {language === 'pt' ? 'Compra parcelada' : 'Grouped purchase'}
              </span>
            )}
            {trans.isDuplicate && (
              <span className={`px-1.5 py-0.5 text-[10px] rounded flex items-center gap-0.5 ${
                trans.isAiDuplicate
                  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
              }`}>
                {trans.isAiDuplicate && '🤖 '}
                {language === 'pt' ? 'duplicada' : 'duplicate'}
              </span>
            )}
            {trans.autoGenerated && !trans._isGroup && (
              <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] rounded">
                auto
              </span>
            )}
            {trans.aiCategorized && (
              <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] rounded flex items-center gap-0.5">
                🤖 AI
              </span>
            )}
          </div>
        )}
      </div>

      {/* Edit Indicator */}
      <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
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
  const [step, setStep] = useState('upload'); // upload, preview, done, uploading, processing
  const [existingHashes, setExistingHashes] = useState(new Set());
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [installmentCount, setInstallmentCount] = useState(0);
  const [aiCount, setAiCount] = useState(0);
  const [aiDuplicateCount, setAiDuplicateCount] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showEditHint, setShowEditHint] = useState(true);
  const [pickerTransactionId, setPickerTransactionId] = useState(null);
  const [pickerAnchorEl, setPickerAnchorEl] = useState(null);
  const [previewView, setPreviewView] = useState('list'); // list | edit
  const [sortOrder, setSortOrder] = useState('desc'); // desc = most recent first
  const contentScrollRef = useRef(null);
  const transactionsListRef = useRef(null);
  const previewScrollTopRef = useRef(0);
  const previewOuterScrollTopRef = useRef(0);
  const previewWindowScrollRef = useRef(0);
  const shouldRestorePreviewScrollRef = useRef(false);

  // Background upload states
  const [uploadMode, setUploadMode] = useState('local'); // 'local' or 'background'
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
  useInvestments(); // Used for context availability

  // Only show non-completed goals for linking
  const availableGoals = goals.filter(g => !g.completed);

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const handleBankSelect = (e) => {
    const val = e.target.value;
    if (!val) { setSelectedBankId(null); setImportPaymentMethod('debit'); return; }
    if (val.endsWith(':credit')) {
      setSelectedBankId(val.replace(':credit', ''));
      setImportPaymentMethod('credit');
    } else {
      setSelectedBankId(val);
      setImportPaymentMethod('debit');
    }
  };

  // Load existing transaction hashes when modal opens
  // Use ownerId for shared accounts support
  useEffect(() => {
    if (isOpen && (ownerId || auth.currentUser?.uid)) {
      loadExistingHashes();
    }
  }, [isOpen, ownerId]);

  // Dismiss edit hint after 5 seconds
  useEffect(() => {
    if (step === 'preview' && showEditHint) {
      const timer = setTimeout(() => setShowEditHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [step, showEditHint]);

  // Restore list scroll after returning from edit flow.
  // useLayoutEffect runs synchronously after the DOM has been updated but before
  // the browser paints, ensuring the list element is already visible (no longer
  // hidden) when we assign scrollTop — so the value actually sticks.
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
      // Use ownerId for shared accounts, fallback to current user
      const userId = ownerId || auth.currentUser?.uid;
      if (!userId) return;

      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const hashes = new Set();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.hash) {
          hashes.add(data.hash);
        } else {
          // Generate hash for older transactions without hash field
          const hash = generateTransactionHash({
            date: data.date,
            description: data.description,
            amount: data.amount
          });
          hashes.add(hash);
        }
      });

      console.log(`Loaded ${hashes.size} existing transaction hashes`);
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
      // Always auto-detect bank format, pass userId for learning system
      const userId = ownerId || auth.currentUser?.uid;

      // Pass AI options if API key is available
      const aiOptions = geminiApiKey ? {
        apiKey: geminiApiKey,
        categories: categories // { expense: [...], income: [...] }
      } : {};

      const parsed = await parseFile(file, 'auto', userId, aiOptions);

      let hashDuplicates = 0;
      let installments = 0;
      let aiCategorized = 0;

      // First pass: hash-based duplicate detection
      const seenGroups = new Set();
      const afterHashFilter = parsed.map((t, index) => {
        const isDuplicate = existingHashes.has(t.hash);
        if (isDuplicate) hashDuplicates++;
        
        if (t.isInstallment && t.installmentGroupId) {
          if (!seenGroups.has(t.installmentGroupId)) {
            installments++;
            seenGroups.add(t.installmentGroupId);
          }
        }
        
        if (t.aiCategorized) aiCategorized++;

        return {
          _localId: `${t.hash || 'tx'}-${index}-${Math.random().toString(36).slice(2, 9)}`,
          ...t,
          isDuplicate,
          selected: !isDuplicate
        };
      });

      // Second pass: AI-powered duplicate detection (for non-hash duplicates)
      let aiDuplicates = 0;
      if (geminiApiKey && hashDuplicates < parsed.length) {
        try {
          // Get existing transactions for AI comparison
          const existingQ = query(
            collection(db, 'transactions'),
            where('userId', '==', userId),
            orderBy('date', 'desc'),
            limit(200)
          );
          const existingSnapshot = await getDocs(existingQ);
          const existingTransactions = existingSnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          }));

          // Only check non-duplicate transactions
          const nonDuplicates = afterHashFilter
            .map((t, idx) => ({ ...t, originalIndex: idx }))
            .filter(t => !t.isDuplicate);

          if (nonDuplicates.length > 0 && existingTransactions.length > 0) {
            const aiDuplicateIndices = await detectDuplicatesWithAI(
              nonDuplicates,
              existingTransactions,
              { apiKey: geminiApiKey, userId }
            );

            // Mark AI-detected duplicates
            nonDuplicates.forEach((t, idx) => {
              if (aiDuplicateIndices.has(idx)) {
                afterHashFilter[t.originalIndex].isAiDuplicate = true;
                afterHashFilter[t.originalIndex].isDuplicate = true;
                afterHashFilter[t.originalIndex].selected = false;
                aiDuplicates++;
              }
            });
          }
        } catch (aiErr) {
          console.error('AI duplicate detection error:', aiErr);
          // Continue without AI duplicates - not critical
        }
      }

      setDuplicateCount(hashDuplicates + aiDuplicates);
      setAiDuplicateCount(aiDuplicates);
      setInstallmentCount(installments);
      setAiCount(aiCategorized);
      setTransactions(afterHashFilter);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Failed to parse file');
      const userId = ownerId || auth.currentUser?.uid;
      analytics.importError(userId, { bankName: selectedBankId || 'unknown', errorType: err.message || 'parse_error' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const isFirstImport = existingHashes.size === 0;

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
          // New fields from edit form
          goalId: t.goalId || null,
          goalName: t.goalName || null,
          plannerGoalId: t.plannerGoalId || null,
          investmentType: t.investmentType || null,
          // Investment extra fields
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

      const userId = ownerId || auth.currentUser?.uid;
      if (isFirstImport) {
        analytics.firstImport(userId, { bankId: selectedBankId, transactionCount: toImport.length });
      }
      setStep('done');
    } catch (err) {
      setError(err.message || 'Failed to import transactions');
    } finally {
      setImporting(false);
    }
  };

  // Background upload to Firebase Storage
  const handleBackgroundUpload = async () => {
    if (!file) return;

    setStep('uploading');
    setError('');
    setUploadProgress({ status: 'uploading', message: language === 'pt' ? 'Enviando arquivo...' : 'Uploading file...' });

    try {
      const userId = ownerId || auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      // Determine bank folder from selected bank or default to 'other'
      let bankFolder = 'other';
      if (selectedBankId) {
        const selectedBank = userBanks.find(b => b.id === selectedBankId);
        if (selectedBank) {
          const bankId = selectedBank.bankId.toLowerCase();
          if (['nubank', 'itau', 'bradesco'].includes(bankId)) {
            bankFolder = bankId;
          }
        }
      }

      // B3 imports go to dedicated folder so the cloud function can detect them
      if (isB3Import) {
        bankFolder = 'b3';
      }

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const filePath = `imports/${userId}/${bankFolder}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, filePath);

      await uploadBytes(storageRef, file, {
        customMetadata: isB3Import && b3PlannerGoalId
          ? { plannerGoalId: b3PlannerGoalId }
          : undefined,
      });

      // File uploaded successfully - close modal immediately
      // User will be notified via push notification when processing completes
      setImportResult({
        success: true,
        message: language === 'pt'
          ? 'Arquivo enviado! Você receberá uma notificação quando o processamento terminar.'
          : 'File uploaded! You\'ll receive a notification when processing completes.'
      });
      setStep('done');

    } catch (err) {
      console.error('Background upload error:', err);
      setError(err.message || 'Failed to upload file');
      setStep('upload');
      setUploadProgress(null);
    }
  };

  const toggleTransactionSelection = (transactionId) => {
    const previousScrollTop = transactionsListRef.current?.scrollTop ?? 0;
    const target = transactions.find(t => t._localId === transactionId);
    const groupId = target?.installmentGroupId;

    setTransactions(prev => prev.map((t) => {
      const isTarget = t._localId === transactionId;
      const isSameGroup = groupId && t.installmentGroupId === groupId;
      
      if (isTarget || isSameGroup) {
        return { ...t, selected: !target.selected };
      }
      return t;
    }));
    
    requestAnimationFrame(() => {
      if (transactionsListRef.current) {
        transactionsListRef.current.scrollTop = previousScrollTop;
      }
    });
  };

  const toggleTransactionType = (transactionId) => {
    const previousScrollTop = transactionsListRef.current?.scrollTop ?? 0;
    const target = transactions.find(t => t._localId === transactionId);
    const groupId = target?.installmentGroupId;
    const newType = target?.type === 'income' ? 'expense' : 'income';

    setTransactions(prev => prev.map((t) => {
      const isTarget = t._localId === transactionId;
      const isSameGroup = groupId && t.installmentGroupId === groupId;
      
      if (isTarget || isSameGroup) {
        return { ...t, type: newType };
      }
      return t;
    }));
    
    requestAnimationFrame(() => {
      if (transactionsListRef.current) {
        transactionsListRef.current.scrollTop = previousScrollTop;
      }
    });
  };

  // Open category picker dropdown for a transaction
  const openCategoryPicker = (transactionId, e) => {
    e.stopPropagation();
    setPickerAnchorEl(e.currentTarget);
    setPickerTransactionId(transactionId);
  };

  // Quick category change (from picker)
  const handleQuickCategoryChange = (newCategory) => {
    if (pickerTransactionId === null) return;
    const target = transactions.find(t => t._localId === pickerTransactionId);
    const groupId = target?.installmentGroupId;

    setTransactions(prev => prev.map((t) => {
      const isTarget = t._localId === pickerTransactionId;
      const isSameGroup = groupId && t.installmentGroupId === groupId;
      
      if (isTarget || isSameGroup) {
        return { ...t, category: newCategory, autoCategory: false };
      }
      return t;
    }));
    setPickerTransactionId(null);
  };

  const selectedCount = transactions.filter(t => t.selected).length;
  const hasSelectableTransactions = transactions.some(t => !t.isDuplicate);
  const allSelectableSelected = hasSelectableTransactions && transactions.every(t => t.isDuplicate || t.selected);

  const selectAllTransactions = () => {
    const previousScrollTop = transactionsListRef.current?.scrollTop ?? 0;
    setTransactions(prev => prev.map(t => (
      t.isDuplicate ? t : { ...t, selected: true }
    )));
    requestAnimationFrame(() => {
      if (transactionsListRef.current) {
        transactionsListRef.current.scrollTop = previousScrollTop;
      }
    });
  };

  const deselectAllTransactions = () => {
    const previousScrollTop = transactionsListRef.current?.scrollTop ?? 0;
    setTransactions(prev => prev.map(t => ({ ...t, selected: false })));
    requestAnimationFrame(() => {
      if (transactionsListRef.current) {
        transactionsListRef.current.scrollTop = previousScrollTop;
      }
    });
  };

  const [isDuplicatesExpanded, setIsDuplicatesExpanded] = useState(false);

  const sortedTransactions = useMemo(() => {
    const groups = new Map();
    const result = [];
    const duplicates = [];
    
    // Sort all transactions by date ascending first to consistently pick the first installment
    const chronologicallyOrdered = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    chronologicallyOrdered.forEach(t => {
      if (t.installmentGroupId) {
        if (!groups.has(t.installmentGroupId)) {
          const groupRepresentative = {
            ...t,
            _isGroup: true,
            _groupTransactions: [t],
            _baseDescription: t.description.replace(/\s*\(\d+\/\d+\)$/, ''),
            _totalAmount: t.amount * t.installmentTotal,
          };
          groups.set(t.installmentGroupId, groupRepresentative);
          if (t.isDuplicate) {
            duplicates.push(groupRepresentative);
          } else {
            result.push(groupRepresentative);
          }
        } else {
          groups.get(t.installmentGroupId)._groupTransactions.push(t);
        }
      } else {
        if (t.isDuplicate) {
          duplicates.push(t);
        } else {
          result.push(t);
        }
      }
    });

    const sortFn = (a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA === dateB) return String(a._localId).localeCompare(String(b._localId));
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    };

    return {
      main: result.sort(sortFn),
      duplicates: duplicates.sort(sortFn)
    };
  }, [transactions, sortOrder]);

  const handleClose = () => {
    setFile(null);
    setTransactions([]);
    setStep('upload');
    setError('');
    setDuplicateCount(0);
    setAiDuplicateCount(0);
    setInstallmentCount(0);
    setAiCount(0);
    setSelectedBankId(null);
    setEditingTransaction(null);
    setShowEditHint(true);
    setPickerTransactionId(null);
    setPreviewView('list');
    setSortOrder('desc');
    setUploadMode('local');
    setUploadProgress(null);
    setImportResult(null);
    setIsB3Import(false);
    setSyncing(false);
    setSyncMessage('');
    setB3PlannerGoalId('');
    setIsDuplicatesExpanded(false);
    onClose();
  };

  const activeCategoryTransaction = useMemo(
    () => transactions.find(t => t._localId === pickerTransactionId) || null,
    [transactions, pickerTransactionId]
  );

  const openEditTransaction = (transactionId) => {
    previewOuterScrollTopRef.current = contentScrollRef.current?.scrollTop ?? 0;
    previewScrollTopRef.current = transactionsListRef.current?.scrollTop ?? 0;
    previewWindowScrollRef.current = window.scrollY;
    const transaction = transactions.find(t => t._localId === transactionId);
    if (!transaction) return;

    setEditingTransaction({
      transactionId,
      ...transaction,
      selectedGoalId: transaction.goalId || '',
      selectedPlannerGoalId: transaction.plannerGoalId || '',
      investmentType: transaction.investmentType || 'fixed_income'
    });
    setShowEditHint(false);
    setPreviewView('edit');
  };

  const saveEditTransaction = () => {
    if (editingTransaction === null) return;

    const { transactionId, selectedGoalId, selectedPlannerGoalId, ...updates } = editingTransaction;
    const groupId = updates.installmentGroupId;
    
    // Base description without installment info (e.g. "Amazon (1/10)" -> "Amazon")
    const baseDescription = updates.description.replace(/\s*\(\d+\/\d+\)$/, '');
    const editedDate = new Date(updates.date);

    setTransactions(prev => prev.map((t) => {
      const isTarget = t._localId === transactionId;
      const isSameGroup = groupId && t.installmentGroupId === groupId;

      if (isTarget || isSameGroup) {
        const newT = {
          ...t,
          category: updates.category,
          type: updates.type,
          amount: updates.amount,
          goalId: selectedGoalId || null,
          goalName: selectedGoalId ? availableGoals.find(g => g.id === selectedGoalId)?.name || null : null,
          plannerGoalId: selectedPlannerGoalId || null,
          autoCategory: false,
          investmentType: updates.investmentType,
          ticker: updates.ticker,
          platform: updates.platform,
          coinName: updates.coinName,
          fundName: updates.fundName,
          propertyDescription: updates.propertyDescription,
          expectedReturn: updates.expectedReturn,
          returnType: updates.returnType,
          maturityDate: updates.maturityDate,
        };

        if (isTarget) {
          return {
            ...newT,
            description: updates.description,
            date: updates.date,
          };
        } else {
          // Update other installments in the group
          return {
            ...newT,
            description: `${baseDescription} (${t.installmentCurrent}/${t.installmentTotal})`,
            // Shift date relative to the new target date
            date: new Date(new Date(editedDate).setMonth(
              editedDate.getMonth() + (t.installmentCurrent - updates.installmentCurrent)
            )).toISOString(),
          };
        }
      }
      return t;
    }));
    setEditingTransaction(null);
    shouldRestorePreviewScrollRef.current = true;
    setPreviewView('list');
  };

  const handleBackFromEdit = () => {
    setEditingTransaction(null);
    shouldRestorePreviewScrollRef.current = true;
    setPreviewView('list');
  };

  if (!embedded && !isOpen) return null;

  return (
    <ModalWrapper embedded={embedded} isMobile={isMobile}>
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
      <div
        ref={contentScrollRef}
        className={`flex-1 p-4 sm:p-6 ${step === 'preview' ? 'overflow-hidden' : 'overflow-y-auto'} ${isMobile ? 'bg-gray-50 dark:bg-gray-900' : ''}`}
      >
        {step === 'upload' && (
          <div className="flex flex-col h-full">
            {/* Bank Selection - Dropdown */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {language === 'pt' ? 'Vincular ao Banco' : 'Link to Bank'}
              </label>
              <select
                value={selectedBankId ? (importPaymentMethod === 'credit' ? `${selectedBankId}:credit` : selectedBankId) : ''}
                onChange={handleBankSelect}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '20px',
                  paddingRight: '2.5rem',
                }}
              >
                <option value="">💵 {language === 'pt' ? 'Dinheiro / Sem banco' : 'Cash / No bank'}</option>
                {userBanks.map((userBank) => {
                  const bankInfo = getBankInfo(userBank.bankId);
                  const displayName = getBankDisplayName(userBank);
                  return (
                    <Fragment key={userBank.id}>
                      <option value={userBank.id}>
                        {bankInfo.icon} {displayName} — {language === 'pt' ? 'Conta' : 'Account'}
                      </option>
                      {userBank.hasCredit && (
                        <option value={`${userBank.id}:credit`}>
                          💳 {displayName} — {language === 'pt' ? 'Cartão de Crédito' : 'Credit Card'}
                        </option>
                      )}
                    </Fragment>
                  );
                })}
              </select>

              {/* B3 positions import toggle — only when b3Sync feature is enabled */}
              {hasB3Sync && (
                <>
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isB3Import}
                      onClick={() => setIsB3Import(prev => !prev)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        isB3Import
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isB3Import && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <label
                      onClick={() => setIsB3Import(prev => !prev)}
                      className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                    >
                      {language === 'pt' ? 'Importar posição B3 (Posição Consolidada)' : 'Import B3 positions (Consolidated Position)'}
                    </label>
                  </div>
                  {isB3Import && (
                    <>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-8">
                        {language === 'pt'
                          ? 'Exporte em investidor.b3.com.br → Posição → Posição Consolidada → Exportar'
                          : 'Export at investidor.b3.com.br → Position → Consolidated Position → Export'}
                      </p>
                      <div className="mt-3 ml-8">
                        <PlannerGoalSelect
                          value={b3PlannerGoalId}
                          onChange={setB3PlannerGoalId}
                          label={language === 'pt' ? 'Camada para importar posições B3' : 'Sublayer for imported B3 positions'}
                          emptyLabel={language === 'pt' ? 'Sem camada' : 'No sublayer'}
                          selectClassName="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition appearance-none cursor-pointer"
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Upload Mode Toggle */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Modo de processamento' : 'Processing mode'}
              </label>
              <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => setUploadMode('local')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    uploadMode === 'local'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {language === 'pt' ? '📱 Revisar aqui' : '📱 Review here'}
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('background')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    uploadMode === 'background'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {language === 'pt' ? '☁️ Enviar e processar' : '☁️ Upload & process'}
                </button>
              </div>
              {uploadMode === 'background' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {language === 'pt'
                    ? 'Transações serão processadas automaticamente. Revise depois em "Pendente de Revisão".'
                    : 'Transactions will be auto-processed. Review later in "Pending Review".'}
                </p>
              )}
            </div>

            {/* File Selection */}
            <div>
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
          <div className={`h-full flex flex-col gap-4 ${previewView === 'list' ? '' : 'hidden'}`}>
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
                  {sortedTransactions.main.length + sortedTransactions.duplicates.length} {language === 'pt' ? 'encontradas' : 'found'}
                </span>
                {duplicateCount > 0 && (
                  <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full text-sm flex items-center gap-1">
                    {duplicateCount} {language === 'pt' ? 'duplicadas' : 'duplicates'}
                    {aiDuplicateCount > 0 && (
                      <span className="text-[10px] opacity-75">
                        ({aiDuplicateCount} AI)
                      </span>
                    )}
                  </span>
                )}
                {installmentCount > 0 && (
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                    {installmentCount} {language === 'pt' ? 'parcelas' : 'installments'}
                  </span>
                )}
                {aiCount > 0 && (
                  <span className="px-3 py-1 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-full text-sm flex items-center gap-1">
                    <span>🤖</span>
                    {aiCount} {language === 'pt' ? 'por IA' : 'by AI'}
                  </span>
                )}
              </div>
            </div>

            {/* Bulk selection actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={selectAllTransactions}
                disabled={!hasSelectableTransactions || allSelectableSelected}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {language === 'pt' ? 'Selecionar todos' : 'Select all'}
              </button>
              <button
                type="button"
                onClick={deselectAllTransactions}
                disabled={selectedCount === 0}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {language === 'pt' ? 'Desmarcar todos' : 'Deselect all'}
              </button>
              <button
                type="button"
                onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {sortOrder === 'desc'
                  ? (language === 'pt' ? 'Mais recentes' : 'Most recent')
                  : (language === 'pt' ? 'Mais antigas' : 'Oldest')}
              </button>
            </div>

            {/* Edit hint - auto-dismisses */}
            {showEditHint && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>
                  {language === 'pt'
                    ? 'Toque na categoria para alterar'
                    : 'Tap category to change'}
                </span>
                <button onClick={() => setShowEditHint(false)} className="ml-auto p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Transaction List */}
            <div ref={transactionsListRef} className="space-y-4 overflow-y-auto flex-1 min-h-0 pb-4">
              {/* Main List */}
              <div className="space-y-2">
                {sortedTransactions.main.map((trans) => (
                  <div
                    key={trans._localId}
                    onClick={() => openEditTransaction(trans._localId)}
                    className={`rounded-xl transition-all cursor-pointer active:scale-[0.99] ${
                      trans.selected
                        ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                        : 'bg-gray-50 dark:bg-gray-800/50 opacity-50'
                    } p-3 shadow-sm`}
                  >
                    <TransactionRowContent trans={trans} locale={locale} language={language} formatCurrency={formatCurrency} toggleTransactionSelection={toggleTransactionSelection} toggleTransactionType={toggleTransactionType} openCategoryPicker={openCategoryPicker} />
                  </div>
                ))}
              </div>

              {/* Duplicates Section */}
              {sortedTransactions.duplicates.length > 0 && (
                <div className="mt-6 border-t border-gray-100 dark:border-gray-700 pt-4">
                  <button
                    onClick={() => setIsDuplicatesExpanded(!isDuplicatesExpanded)}
                    className="flex items-center justify-between w-full px-4 py-3 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-xl transition-colors mb-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-amber-600 dark:text-amber-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </span>
                      <span className="text-sm font-semibold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                        {language === 'pt' ? 'Transações Duplicadas' : 'Duplicate Transactions'} ({sortedTransactions.duplicates.length})
                      </span>
                    </div>
                    <svg className={`w-5 h-5 text-amber-500 transition-transform duration-200 ${isDuplicatesExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isDuplicatesExpanded && (
                    <div className="space-y-2 mt-2">
                      <p className="px-4 text-xs text-amber-600 dark:text-amber-400 mb-3 italic">
                        {language === 'pt' 
                          ? 'Estas transações já existem no seu histórico e estão desmarcadas por padrão.' 
                          : 'These transactions already exist in your history and are deselected by default.'}
                      </p>
                      {sortedTransactions.duplicates.map((trans) => (
                        <div
                          key={trans._localId}
                          onClick={() => openEditTransaction(trans._localId)}
                          className={`rounded-xl transition-all cursor-pointer active:scale-[0.99] bg-amber-50/50 dark:bg-amber-900/10 opacity-70 p-3`}
                        >
                          <TransactionRowContent trans={trans} locale={locale} language={language} formatCurrency={formatCurrency} toggleTransactionSelection={toggleTransactionSelection} toggleTransactionType={toggleTransactionType} openCategoryPicker={openCategoryPicker} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl">
                <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className={`space-y-4 ${previewView === 'edit' && editingTransaction !== null ? '' : 'hidden'}`}>
            {editingTransaction !== null && (
              <>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackFromEdit}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('common.back')}
              </button>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {language === 'pt' ? 'Editar Transacao' : 'Edit Transaction'}
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                <button type="button" onClick={() => setEditingTransaction(prev => ({ ...prev, type: 'expense' }))}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${editingTransaction.type === 'expense' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  {t('transactionForm.expense')}
                </button>
                <button type="button" onClick={() => setEditingTransaction(prev => ({ ...prev, type: 'income' }))}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${editingTransaction.type === 'income' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  {t('transactionForm.income')}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('transactionForm.amount')}</label>
                <CurrencyInput value={editingTransaction.amount} onChange={(val) => setEditingTransaction(prev => ({ ...prev, amount: val }))} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('transactionForm.description')}</label>
                <textarea value={editingTransaction.description} onChange={(e) => setEditingTransaction(prev => ({ ...prev, description: e.target.value }))} rows={2}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 resize-none"
                  placeholder={t('transactionForm.descriptionPlaceholder')} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('transactionForm.date')}</label>
                <input type="date" value={editingTransaction.date ? editingTransaction.date.split('T')[0] : ''}
                  onChange={(e) => setEditingTransaction(prev => ({ ...prev, date: new Date(e.target.value + 'T12:00:00').toISOString() }))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('transactionForm.category')}</label>
                <select value={editingTransaction.category} onChange={(e) => setEditingTransaction(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 appearance-none cursor-pointer">
                  {categories[editingTransaction.type].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Investment Type — shown only when category is Investments */}
              {(editingTransaction.category === 'Investments' || editingTransaction.category === 'Investimentos') && (
                <>
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
                          className={`p-3 text-xl rounded-xl border-2 transition flex flex-col items-center gap-1 ${
                            editingTransaction.investmentType === key
                              ? 'border-gray-900 dark:border-gray-400 bg-gray-100 dark:bg-gray-700'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                          title={t(`investments.types.${key}`)}
                        >
                          <span>{info.icon}</span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">
                            {t(`investments.types.${key}`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Investment Fields */}
                  <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    {editingTransaction.investmentType === 'fixed_income' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {language === 'pt' ? 'Rendimento Esperado' : 'Expected Return'}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                value={editingTransaction.expectedReturn ?? ''}
                                onChange={(e) => setEditingTransaction(prev => ({ ...prev, expectedReturn: e.target.value }))}
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="w-full px-4 py-3 pr-10 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">%</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {language === 'pt' ? 'Tipo de Retorno' : 'Return Type'}
                            </label>
                            <select
                              value={editingTransaction.returnType ?? 'annual'}
                              onChange={(e) => setEditingTransaction(prev => ({ ...prev, returnType: e.target.value }))}
                              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                            >
                              <option value="cdi">CDI</option>
                              <option value="annual">{language === 'pt' ? 'Anual' : 'Annual'}</option>
                              <option value="monthly">{language === 'pt' ? 'Mensal' : 'Monthly'}</option>
                              <option value="total">Total</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {language === 'pt' ? 'Data de Vencimento (opcional)' : 'Maturity Date (optional)'}
                          </label>
                          <input
                            type="date"
                            value={editingTransaction.maturityDate ?? ''}
                            onChange={(e) => setEditingTransaction(prev => ({ ...prev, maturityDate: e.target.value }))}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </>
                    )}

                    {(editingTransaction.investmentType === 'stocks' || editingTransaction.investmentType === 'fii') && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Ticker {editingTransaction.investmentType === 'fii'
                              ? (language === 'pt' ? '(ex: HGLG11, XPML11)' : '(e.g. HGLG11, XPML11)')
                              : (language === 'pt' ? '(ex: PETR4, AAPL)' : '(e.g. PETR4, AAPL)')}
                          </label>
                          <input
                            type="text"
                            value={editingTransaction.ticker ?? ''}
                            onChange={(e) => setEditingTransaction(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                            placeholder={editingTransaction.investmentType === 'fii' ? 'HGLG11' : 'PETR4'}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {language === 'pt' ? 'Corretora' : 'Broker'}
                          </label>
                          <input
                            type="text"
                            value={editingTransaction.platform ?? ''}
                            onChange={(e) => setEditingTransaction(prev => ({ ...prev, platform: e.target.value }))}
                            placeholder={language === 'pt' ? 'Ex: XP, Clear' : 'e.g. XP, Clear'}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </>
                    )}

                    {editingTransaction.investmentType === 'crypto' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {language === 'pt' ? 'Criptomoeda' : 'Cryptocurrency'}
                          </label>
                          <input
                            type="text"
                            list="import-crypto-list"
                            value={editingTransaction.coinName ?? ''}
                            onChange={(e) => setEditingTransaction(prev => ({ ...prev, coinName: e.target.value }))}
                            placeholder="Bitcoin (BTC)"
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                          />
                          <datalist id="import-crypto-list">
                            <option value="Bitcoin (BTC)" />
                            <option value="Ethereum (ETH)" />
                            <option value="BNB" />
                            <option value="Solana (SOL)" />
                            <option value="Cardano (ADA)" />
                            <option value="XRP" />
                            <option value="Dogecoin (DOGE)" />
                          </datalist>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {language === 'pt' ? 'Exchange (ex: Binance, Coinbase)' : 'Exchange (e.g. Binance, Coinbase)'}
                          </label>
                          <input
                            type="text"
                            value={editingTransaction.platform ?? ''}
                            onChange={(e) => setEditingTransaction(prev => ({ ...prev, platform: e.target.value }))}
                            placeholder="Binance"
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </>
                    )}

                    {editingTransaction.investmentType === 'funds' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {language === 'pt' ? 'Nome do Fundo' : 'Fund Name'}
                          </label>
                          <input
                            type="text"
                            value={editingTransaction.fundName ?? ''}
                            onChange={(e) => setEditingTransaction(prev => ({ ...prev, fundName: e.target.value }))}
                            placeholder={language === 'pt' ? 'Ex: Fundo XP Ibovespa' : 'e.g. XP Ibovespa Fund'}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {language === 'pt' ? 'Plataforma' : 'Platform'}
                          </label>
                          <input
                            type="text"
                            value={editingTransaction.platform ?? ''}
                            onChange={(e) => setEditingTransaction(prev => ({ ...prev, platform: e.target.value }))}
                            placeholder={language === 'pt' ? 'Ex: XP, Rico' : 'e.g. XP, Rico'}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </>
                    )}

                    {editingTransaction.investmentType === 'real_estate' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {language === 'pt' ? 'Descrição do Imóvel' : 'Property Description'}
                        </label>
                        <input
                          type="text"
                          value={editingTransaction.propertyDescription ?? ''}
                          onChange={(e) => setEditingTransaction(prev => ({ ...prev, propertyDescription: e.target.value }))}
                          placeholder={language === 'pt' ? 'Ex: Apartamento Centro, SP' : 'e.g. Downtown Apartment, SP'}
                          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Goal Picker — shown when there are available goals */}
              {availableGoals.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('goals.linkToGoal')}
                  </label>
                  <select
                    value={editingTransaction.selectedGoalId || ''}
                    onChange={(e) => setEditingTransaction(prev => ({ ...prev, selectedGoalId: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                  >
                    <option value="">{t('goals.noGoalSelected')}</option>
                    {availableGoals.map((goal) => (
                      <option key={goal.id} value={goal.id}>{goal.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(editingTransaction.category === 'Investments' || editingTransaction.category === 'Investimentos') && (
                <PlannerGoalSelect
                  value={editingTransaction.selectedPlannerGoalId || ''}
                  onChange={(selectedPlannerGoalId) => setEditingTransaction(prev => ({ ...prev, selectedPlannerGoalId }))}
                  selectClassName="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                />
              )}
            </div>
              </>
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

            {/* Show different messages based on upload mode */}
            {importResult ? (
              <div className="space-y-2">
                {importResult.message ? (
                  <p className="text-gray-500 dark:text-gray-400">{importResult.message}</p>
                ) : (
                  <>
                    <p className="text-gray-500 dark:text-gray-400">
                      {language === 'pt'
                        ? `${importResult.importedCount} transações importadas`
                        : `${importResult.importedCount} transactions imported`}
                    </p>
                    {importResult.duplicateCount > 0 && (
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        {language === 'pt'
                          ? `${importResult.duplicateCount} duplicadas ignoradas`
                          : `${importResult.duplicateCount} duplicates skipped`}
                      </p>
                    )}
                    {importResult.pendingCategoryCount > 0 && (
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        {language === 'pt'
                          ? `${importResult.pendingCategoryCount} precisam de categoria`
                          : `${importResult.pendingCategoryCount} need categorization`}
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                {t('import.successMessage', { count: transactions.filter(t => t.selected).length })}
              </p>
            )}

            {isB3Import && (
              <>
                <button
                  onClick={async () => {
                    setSyncing(true);
                    setSyncMessage('');
                    try {
                      const fns = getFunctions();
                      const syncFn = httpsCallable(fns, 'syncB3InvestmentsCallable');
                      await syncFn();
                      setSyncMessage(language === 'pt' ? 'Preços sincronizados!' : 'Prices synced!');
                    } catch (err) {
                      console.error('Sync error:', err);
                      setSyncMessage(language === 'pt' ? 'Erro ao sincronizar. Tente novamente.' : 'Sync failed. Please try again.');
                    } finally {
                      setSyncing(false);
                    }
                  }}
                  disabled={syncing}
                  className="mt-3 w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl font-medium transition"
                >
                  {syncing
                    ? (language === 'pt' ? 'Sincronizando...' : 'Syncing...')
                    : (language === 'pt' ? 'Sincronizar preços agora' : 'Sync prices now')}
                </button>
                {syncMessage && (
                  <p className={`mt-2 text-sm text-center ${
                    syncMessage.includes('sincronizados') || syncMessage.includes('synced')
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500 dark:text-red-400'
                  }`}>
                    {syncMessage}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Processing/Uploading state content */}
        {(step === 'uploading' || step === 'processing') && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {step === 'uploading'
                ? (language === 'pt' ? 'Enviando...' : 'Uploading...')
                : (language === 'pt' ? 'Processando...' : 'Processing...')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {uploadProgress?.message || (language === 'pt' ? 'Aguarde...' : 'Please wait...')}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-700 ${isMobile ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}`}>
        {step === 'upload' && (
          <button
            onClick={uploadMode === 'local' ? handleParse : handleBackgroundUpload}
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
            ) : uploadMode === 'local' ? t('common.continue') : (language === 'pt' ? 'Enviar arquivo' : 'Upload file')}
          </button>
        )}

        {(step === 'uploading' || step === 'processing') && (
          <div className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-center">
            <span className="flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {uploadProgress?.message || (language === 'pt' ? 'Processando...' : 'Processing...')}
            </span>
          </div>
        )}

        {step === 'preview' && previewView === 'list' && (
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

        {step === 'preview' && previewView === 'edit' && (
          <button
            onClick={saveEditTransaction}
            className={`w-full py-3.5 rounded-xl font-medium text-white transition-all duration-200
              ${editingTransaction?.type === 'expense'
                ? 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700'
                : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700'
              }`}
          >
            {t('common.save')}
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

      {/* Category Picker */}
      <CategoryPicker
        isOpen={pickerTransactionId !== null}
        onClose={() => { setPickerTransactionId(null); setPickerAnchorEl(null); }}
        onSelect={handleQuickCategoryChange}
        currentCategory={activeCategoryTransaction?.category || ''}
        type={activeCategoryTransaction?.type || 'expense'}
        anchorEl={pickerAnchorEl}
      />

    </ModalWrapper>
  );
}
