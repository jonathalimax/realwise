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
  const [hiddenCats, setHiddenCats] = useState(() => new Set());
  const [catSearch, setCatSearch] = useState('');

  const toggleCat = (cat) => {
    setHiddenCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

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

  const CAT_COLORS = ['#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#EF4444'];

  const topCats = useMemo(() => {
    const catTotals = {};
    for (const tx of allTx) {
      if (tx.type !== 'expense' || tx.ignored) continue;
      catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
    }
    return Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat], i) => ({ cat, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [allTx]);

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
        {/* Card header with title + search */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Tendência — últimos 6 meses
          </h3>
          <input
            type="text"
            value={catSearch}
            onChange={e => setCatSearch(e.target.value)}
            placeholder="Buscar categoria…"
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-400 w-40"
          />
        </div>
        {/* Category toggle chips */}
        <div className="flex flex-wrap gap-x-2 gap-y-1.5 mb-3">
          {topCats.map(({ cat, color }) => {
            const hidden = hiddenCats.has(cat);
            const dimmed = catSearch.length > 0 && !cat.toLowerCase().includes(catSearch.toLowerCase());
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCat(cat)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  hidden || dimmed ? 'opacity-40' : 'opacity-100'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ background: hidden ? 'transparent' : color, border: `1.5px solid ${color}` }}
                />
                <span className={`text-xs ${hidden ? 'line-through text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                  {cat}
                </span>
              </button>
            );
          })}
        </div>
        <CategoryTrendChart
          allTx={allTx}
          last6Months={last6Months}
          getMonthKey={getPaymentMonthKey}
          hiddenCats={hiddenCats}
          onToggleCat={toggleCat}
        />
      </div>
    </div>
  );
}
