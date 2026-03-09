import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useMonth } from '@/contexts/MonthContext';
import SpendingChart from '@/components/charts/SpendingChart';
import CategoryTrendChart from './CategoryTrendChart';

function MonthNav({ selectedMonth, setSelectedMonth }) {
  const [y, m] = selectedMonth.split('-').map(Number);

  const prev = () => {
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const next = () => {
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={prev}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
      >
        ‹
      </button>
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[140px] text-center capitalize">
        {label}
      </span>
      <button
        onClick={next}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
      >
        ›
      </button>
    </div>
  );
}

export default function GastosTab() {
  const { ownerId } = useAccess();
  const { selectedMonth: contextMonth } = useMonth();
  const [selectedMonth, setSelectedMonth] = useState(contextMonth);
  const [allTx, setAllTx] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to all transactions for this user
  useEffect(() => {
    if (!ownerId) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', ownerId));
    const unsub = onSnapshot(q, snap => {
      setAllTx(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [ownerId]);

  // Filter to selected month expenses
  const monthTx = useMemo(() => allTx.filter(tx => {
    if (tx.type !== 'expense' || tx.ignored) return false;
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return key === selectedMonth;
  }), [allTx, selectedMonth]);

  // Last 6 months array (from 5 months ago to selectedMonth)
  const last6Months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(`${selectedMonth}-01`);
      d.setMonth(d.getMonth() - (5 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, [selectedMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Gastos por Categoria
        </h3>
        <MonthNav selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
      </div>

      {/* Donut spending chart */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <SpendingChart transactions={monthTx} />
      </div>

      {/* Category trend (last 6 months) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Tendência — últimos 6 meses por categoria
        </h3>
        <CategoryTrendChart allTx={allTx} last6Months={last6Months} />
      </div>
    </div>
  );
}
