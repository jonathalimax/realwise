import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAccess } from '../contexts/AccessContext';
import { useSettings } from '../contexts/SettingsContext';

export default function PendingCategorizationCard() {
  const navigate = useNavigate();
  const { ownerId } = useAccess();
  const { language } = useSettings();
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;

    // Listen to importStats for real-time updates
    const unsubscribe = onSnapshot(
      doc(db, 'importStats', ownerId),
      (snapshot) => {
        if (snapshot.exists()) {
          setPendingCount(snapshot.data().pendingReviewCount || 0);
        } else {
          setPendingCount(0);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error loading import stats:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ownerId]);

  // Don't render if no pending items
  if (loading || pendingCount === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm border-l-4 border-amber-500">
      <div className="flex items-start gap-4">
        {/* Icon with pulse animation */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          {/* Pulse indicator */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[10px] text-white font-bold items-center justify-center">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {language === 'pt' ? 'Categorização Pendente' : 'Pending Categorization'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === 'pt'
              ? `${pendingCount} ${pendingCount === 1 ? 'transação precisa' : 'transações precisam'} de categoria`
              : `${pendingCount} ${pendingCount === 1 ? 'transaction needs' : 'transactions need'} categorization`}
          </p>

          {/* Action Button */}
          <button
            onClick={() => navigate('/pending-review')}
            className="mt-3 w-full py-2.5 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>{language === 'pt' ? 'Revisar Agora' : 'Review Now'}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
