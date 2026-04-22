import { useState, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import PageHelp from '@/components/ui/PageHelp';
import { useBills } from '../contexts/BillsContext';
import { useAccess } from '../contexts/AccessContext';
import { useMonth } from '../contexts/MonthContext';
import BillsList from '../components/BillsList';
import BillModal from '../components/BillModal';
import PageHeader from '../components/PageHeader';
import { PlusIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function BillsPage() {
  const { language, billReminders, updateBillReminders } = useSettings();
  const { bills } = useBills();
  const { canWrite } = useAccess();
  const { selectedMonth } = useMonth();
  const [showBillModal, setShowBillModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <PageHeader title={language === 'pt' ? 'Contas a Pagar' : 'Bills'} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* Filters + Email reminder toggle */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
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

          <div className="flex items-center gap-2 shrink-0">
            <svg className={`w-4 h-4 ${billReminders ? 'text-violet-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {language === 'pt' ? 'Lembretes' : 'Reminders'}
            </span>
            <button
              role="switch"
              aria-checked={billReminders}
              onClick={() => updateBillReminders(!billReminders)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${billReminders ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${billReminders ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

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
      <PageHelp
        title="Contas"
        text="Controle suas contas a pagar. Marque como paga quando quitar e receba lembretes por e-mail antes do vencimento. Contas recorrentes se repetem automaticamente."
        hasFab={true}
      />
    </div>
  );
}
