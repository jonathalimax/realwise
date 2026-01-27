import { useState, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBills } from '../contexts/BillsContext';
import { useAccess } from '../contexts/AccessContext';
import BillsList from '../components/BillsList';
import BillModal from '../components/BillModal';
import MonthSelector from '../components/MonthSelector';
import { PlusIcon, AdjustmentsHorizontalIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function BillsPage() {
  const { language } = useSettings();
  const { bills, loading } = useBills();
  const { canWrite } = useAccess();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showBillModal, setShowBillModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const availableMonths = useMemo(() => {
    const months = new Set();
    bills.forEach(bill => {
      if (bill.dueDate) {
        const date = new Date(bill.dueDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(key);
      }
    });
    // Add current month and next 3 months
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(months).sort().reverse();
  }, [bills]);

  const billsStats = useMemo(() => {
    const monthBills = bills.filter(bill => {
      if (!bill.dueDate) return false;
      const date = new Date(bill.dueDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });

    const paid = monthBills.filter(b => b.status === 'paid');
    const pending = monthBills.filter(b => b.status === 'pending');
    const overdue = monthBills.filter(b => {
      if (b.status === 'paid') return false;
      const dueDate = new Date(b.dueDate);
      return dueDate < new Date();
    });

    const totalAmount = monthBills.reduce((sum, b) => sum + (b.amount || 0), 0);
    const paidAmount = paid.reduce((sum, b) => sum + (b.amount || 0), 0);
    const pendingAmount = pending.reduce((sum, b) => sum + (b.amount || 0), 0);

    return { paid, pending, overdue, totalAmount, paidAmount, pendingAmount, total: monthBills.length };
  }, [bills, selectedMonth]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: language === 'pt' ? 'BRL' : 'USD'
    }).format(amount);
  };

  const activeFiltersCount = statusFilter !== 'all' ? 1 : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pl-12 md:pl-0">
              {language === 'pt' ? 'Contas a Pagar' : 'Bills'}
            </h1>
            {canWrite && (
              <button
                onClick={() => setShowBillModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                <span className="hidden sm:inline">{language === 'pt' ? 'Nova Conta' : 'New Bill'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Month Selector */}
        <div className="flex items-center justify-between gap-2 mb-6">
          <MonthSelector
            selectedMonth={selectedMonth}
            availableMonths={availableMonths}
            onMonthChange={setSelectedMonth}
            locale={locale}
          />

          {/* Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl shadow-sm transition-all flex-shrink-0 ${
              showFilters || activeFiltersCount > 0
                ? 'bg-orange-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
            <span className="font-medium text-sm hidden sm:inline">{language === 'pt' ? 'Filtros' : 'Filters'}</span>
            {activeFiltersCount > 0 && (
              <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                showFilters ? 'bg-white/20' : 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400'
              }`}>
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
              {language === 'pt' ? 'Status' : 'Status'}
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: language === 'pt' ? 'Todas' : 'All' },
                { value: 'pending', label: language === 'pt' ? 'Pendentes' : 'Pending' },
                { value: 'paid', label: language === 'pt' ? 'Pagas' : 'Paid' },
                { value: 'overdue', label: language === 'pt' ? 'Atrasadas' : 'Overdue' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === option.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <ClockIcon className="w-4 h-4 text-gray-500" />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'pt' ? 'Total' : 'Total'}
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{billsStats.total}</p>
            <p className="text-xs text-gray-500">{formatCurrency(billsStats.totalAmount)}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <ClockIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'pt' ? 'Pendentes' : 'Pending'}
              </span>
            </div>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{billsStats.pending.length}</p>
            <p className="text-xs text-gray-500">{formatCurrency(billsStats.pendingAmount)}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'pt' ? 'Pagas' : 'Paid'}
              </span>
            </div>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{billsStats.paid.length}</p>
            <p className="text-xs text-gray-500">{formatCurrency(billsStats.paidAmount)}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <ExclamationTriangleIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'pt' ? 'Atrasadas' : 'Overdue'}
              </span>
            </div>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{billsStats.overdue.length}</p>
          </div>
        </div>

        {/* Bills List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <BillsList selectedMonth={selectedMonth} statusFilter={statusFilter} />
        </div>
      </main>

      {/* Bill Modal */}
      <BillModal
        isOpen={showBillModal}
        onClose={() => setShowBillModal(false)}
      />
    </div>
  );
}
