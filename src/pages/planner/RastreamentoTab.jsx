import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useCards } from '@/contexts/CardsContext';
import SpendingChart from '@/components/charts/SpendingChart';
import CategoryTrendChart from './CategoryTrendChart';

export default function RastreamentoTab({ selectedMonth }) {
  const { ownerId } = useAccess();
  const { getPaymentMonthKey } = useCards();
  const navigate = useNavigate();
  const [allTx, setAllTx] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', ownerId));
    const unsub = onSnapshot(q, snap => {
      setAllTx(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [ownerId]);

  const monthTx = useMemo(() => allTx.filter(tx => {
    if (tx.type !== 'expense' || tx.ignored) return false;
    const key = getPaymentMonthKey(tx.date, tx.bankId, tx.paymentMethod);
    return key === selectedMonth;
  }), [allTx, selectedMonth, getPaymentMonthKey]);

  const last6Months = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${selectedMonth}-01`);
    d.setMonth(d.getMonth() - (5 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }), [selectedMonth]);

  const handleCategoryClick = (category) => {
    sessionStorage.setItem('expenses_categoryFilter', category);
    sessionStorage.removeItem('expenses_bankFilter');
    sessionStorage.removeItem('expenses_paymentMethodFilter');
    sessionStorage.setItem('expenses_viewMode', 'payment');
    navigate('/expenses');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Gastos por categoria — {selectedMonth}
        </h3>
        <SpendingChart transactions={monthTx} onCategoryClick={handleCategoryClick} />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Tendência — últimos 6 meses por categoria
        </h3>
        <CategoryTrendChart allTx={allTx} last6Months={last6Months} getMonthKey={getPaymentMonthKey} />
      </div>
    </div>
  );
}
