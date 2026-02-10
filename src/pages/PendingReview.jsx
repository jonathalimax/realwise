import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { CheckIcon, ChevronRightIcon, XMarkIcon, ArrowPathIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import { saveUserCategorizationRule, getSuggestions } from '../services/categorizationService';

export default function PendingReview() {
  const navigate = useNavigate();
  const { formatCurrency, categories, language } = useSettings();
  const { ownerId, canWrite } = useAccess();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedCategory, setEditedCategory] = useState('');
  const [editedType, setEditedType] = useState('expense');
  const [suggestions, setSuggestions] = useState([]);

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  // Load transactions that need review
  useEffect(() => {
    if (!ownerId) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', ownerId),
      where('needsReview', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by date descending
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
      setLoading(false);

      // Set initial values for first transaction
      if (data.length > 0 && currentIndex === 0) {
        setEditedType(data[0].type || 'expense');
        setEditedCategory(data[0].category || categories[data[0].type || 'expense'][0] || '');
      }
    });

    return () => unsubscribe();
  }, [ownerId]);

  // Update edited values when current transaction changes
  useEffect(() => {
    const current = transactions[currentIndex];
    if (current) {
      setEditedType(current.type || 'expense');
      setEditedCategory(current.category || categories[current.type || 'expense'][0] || '');

      // Load suggestions from learning system
      if (ownerId && current.description) {
        getSuggestions(ownerId, current.description)
          .then(s => setSuggestions(s))
          .catch(err => console.error('Error loading suggestions:', err));
      } else {
        setSuggestions([]);
      }
    }
  }, [currentIndex, transactions, ownerId]);

  const currentTransaction = transactions[currentIndex];
  // eslint-disable-next-line no-unused-vars
  const progress = transactions.length > 0 ? Math.round(((transactions.length - (transactions.length - currentIndex)) / transactions.length) * 100) : 0;

  // Group transactions by source file for overview (reserved for future use)
  // eslint-disable-next-line no-unused-vars
  const groupedBySource = useMemo(() => {
    const groups = {};
    transactions.forEach(t => {
      const source = t.sourceFile || 'Manual Entry';
      if (!groups[source]) {
        groups[source] = [];
      }
      groups[source].push(t);
    });
    return groups;
  }, [transactions]);

  const handleSave = async () => {
    if (!currentTransaction || !canWrite) return;

    setSaving(true);
    try {
      // Update the transaction
      await updateDoc(doc(db, 'transactions', currentTransaction.id), {
        category: editedCategory,
        type: editedType,
        needsReview: false,
        reviewedAt: serverTimestamp(),
        reviewedBy: ownerId
      });

      // Save the categorization rule for learning (fire and forget)
      saveUserCategorizationRule(ownerId, {
        description: currentTransaction.description,
        category: editedCategory,
        type: editedType
      }).catch(err => console.error('Error saving categorization rule:', err));

      // Move to next transaction
      if (currentIndex < transactions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < transactions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleApplyToSimilar = async () => {
    if (!currentTransaction || !canWrite) return;

    setSaving(true);
    try {
      // Find similar transactions (same description pattern)
      const descWords = currentTransaction.description.toLowerCase().split(' ').filter(w => w.length > 3);
      const similar = transactions.filter(t =>
        t.id !== currentTransaction.id &&
        descWords.some(word => t.description.toLowerCase().includes(word))
      );

      // Update current transaction
      await updateDoc(doc(db, 'transactions', currentTransaction.id), {
        category: editedCategory,
        type: editedType,
        needsReview: false,
        reviewedAt: serverTimestamp(),
        reviewedBy: ownerId
      });

      // Save the categorization rule for learning
      saveUserCategorizationRule(ownerId, {
        description: currentTransaction.description,
        category: editedCategory,
        type: editedType
      }).catch(err => console.error('Error saving categorization rule:', err));

      // Update similar transactions
      for (const t of similar) {
        await updateDoc(doc(db, 'transactions', t.id), {
          category: editedCategory,
          type: editedType,
          needsReview: false,
          reviewedAt: serverTimestamp(),
          reviewedBy: ownerId
        });

        // Also save learning rules for similar transactions
        saveUserCategorizationRule(ownerId, {
          description: t.description,
          category: editedCategory,
          type: editedType
        }).catch(err => console.error('Error saving categorization rule:', err));
      }

      // Move to next non-reviewed transaction
      const nextIndex = transactions.findIndex((t, i) =>
        i > currentIndex && t.needsReview && !similar.find(s => s.id === t.id)
      );
      if (nextIndex !== -1) {
        setCurrentIndex(nextIndex);
      }
    } catch (error) {
      console.error('Error applying to similar:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 md:ml-64">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {language === 'pt' ? 'Revisão de Categorias' : 'Category Review'}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {language === 'pt' ? 'Categorize transações importadas' : 'Categorize imported transactions'}
              </p>
            </div>
          </div>

          {/* Empty State */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {language === 'pt' ? 'Tudo em dia!' : 'All caught up!'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {language === 'pt'
                ? 'Não há transações pendentes de categorização.'
                : 'No transactions pending categorization.'}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-colors"
            >
              {language === 'pt' ? 'Voltar ao Painel' : 'Back to Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 md:ml-64">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {language === 'pt' ? 'Revisão de Categorias' : 'Category Review'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {currentIndex + 1} {language === 'pt' ? 'de' : 'of'} {transactions.length}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-3">
            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / transactions.length) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {Math.round(((currentIndex + 1) / transactions.length) * 100)}%
            </span>
          </div>
        </div>

        {/* Current Transaction Card */}
        {currentTransaction && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-4">
            {/* Transaction Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {currentTransaction.description}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      {new Date(currentTransaction.date).toLocaleDateString(locale, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                    {currentTransaction.sourceFile && (
                      <>
                        <span>•</span>
                        <span className="truncate">{currentTransaction.sourceFile}</span>
                      </>
                    )}
                  </div>
                </div>
                <p className={`text-xl font-bold whitespace-nowrap ${
                  editedType === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {editedType === 'income' ? '+' : '-'}{formatCurrency(currentTransaction.amount)}
                </p>
              </div>
            </div>

            {/* Edit Form */}
            <div className="p-6 space-y-4">
              {/* Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Tipo' : 'Type'}
                </label>
                <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setEditedType('expense');
                      setEditedCategory(categories.expense[0] || '');
                    }}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      editedType === 'expense'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {language === 'pt' ? 'Despesa' : 'Expense'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditedType('income');
                      setEditedCategory(categories.income[0] || '');
                    }}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      editedType === 'income'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {language === 'pt' ? 'Receita' : 'Income'}
                  </button>
                </div>
              </div>

              {/* AI Suggestions from Learning */}
              {suggestions.length > 0 && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <LightBulbIcon className="w-4 h-4 text-amber-500" />
                    {language === 'pt' ? 'Sugestoes (baseado no seu historico)' : 'Suggestions (based on your history)'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setEditedType(suggestion.type);
                          setEditedCategory(suggestion.category);
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all border-2 ${
                          editedCategory === suggestion.category && editedType === suggestion.type
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:border-amber-400'
                        }`}
                      >
                        {suggestion.category}
                        <span className="ml-1 text-xs opacity-60">
                          ({Math.round(suggestion.confidence * 100)}%)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Categoria' : 'Category'}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {categories[editedType]?.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditedCategory(cat)}
                      className={`px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                        editedCategory === cat
                          ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Navigation */}
                <div className="flex gap-2">
                  <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium
                      hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    {language === 'pt' ? 'Anterior' : 'Previous'}
                  </button>
                  <button
                    onClick={handleSkip}
                    disabled={currentIndex === transactions.length - 1}
                    className="px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium
                      hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    {language === 'pt' ? 'Pular' : 'Skip'}
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-1 sm:justify-end">
                  <button
                    onClick={handleApplyToSimilar}
                    disabled={saving || !canWrite}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl font-medium
                      hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    title={language === 'pt' ? 'Aplicar categoria a transações similares' : 'Apply category to similar transactions'}
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">{language === 'pt' ? 'Aplicar a similares' : 'Apply to similar'}</span>
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !canWrite}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-violet-500 text-white rounded-xl font-medium
                      hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckIcon className="w-4 h-4" />
                        <span>{language === 'pt' ? 'Salvar' : 'Save'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Remaining Transactions Preview */}
        {transactions.length > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {language === 'pt' ? 'Próximas na fila' : 'Coming up next'}
            </h3>
            <div className="space-y-2">
              {transactions.slice(currentIndex + 1, currentIndex + 4).map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setCurrentIndex(currentIndex + 1 + i)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    t.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-rose-100 dark:bg-rose-900/40'
                  }`}>
                    <svg className={`w-4 h-4 ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {t.type === 'income' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      )}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(t.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold whitespace-nowrap ${
                    t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {formatCurrency(t.amount)}
                  </p>
                  <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
              ))}
              {transactions.length > currentIndex + 4 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  +{transactions.length - currentIndex - 4} {language === 'pt' ? 'mais' : 'more'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
