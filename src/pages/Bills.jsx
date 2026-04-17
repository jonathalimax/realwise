import { useState, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBills } from '../contexts/BillsContext';
import { useAccess } from '../contexts/AccessContext';
import { useMonth } from '../contexts/MonthContext';
import BillsList from '../components/BillsList';
import BillModal from '../components/BillModal';
import PageHeader from '../components/PageHeader';
import { PlusIcon, AdjustmentsHorizontalIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function BillsPage() {
  const { language } = useSettings();
  const { bills } = useBills();
  const { canWrite } = useAccess();
  const { selectedMonth } = useMonth();
  const [showBillModal, setShowBillModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';


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
      <PageHeader title={language === 'pt' ? 'Contas a Pagar' : 'Bills'} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Filters */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl shadow-sm transition-all ${
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

      {/* FAB */}
      {canWrite && (
        <button
          onClick={() => setShowBillModal(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          aria-label={language === 'pt' ? 'Nova Conta' : 'New Bill'}
        >
          <PlusIcon className="w-7 h-7" />
        </button>
      )}
    </div>
  );
}
