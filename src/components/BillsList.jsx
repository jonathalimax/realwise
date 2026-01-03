import { useState } from 'react';
import { useBills } from '../contexts/BillsContext';
import { useSettings } from '../contexts/SettingsContext';
import BillModal from './BillModal';
import { BellIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function BillsList({ compact = false }) {
  const { bills, loading, markBillAsPaid, getUpcomingBills, getOverdueBills } = useBills();
  const { language } = useSettings();
  const [editingBill, setEditingBill] = useState(null);
  const [showAllBills, setShowAllBills] = useState(false);

  const upcomingBills = getUpcomingBills();
  const overdueBills = getOverdueBills();
  const paidBills = bills.filter(b => b.status === 'paid');


  const handleMarkPaid = async (billId) => {
    await markBillAsPaid(billId);
  };

  const getBillStatus = (bill) => {
    if (bill.status === 'paid') {
      return {
        label: language === 'pt' ? 'Pago' : 'Paid',
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
        icon: CheckCircleIcon
      };
    }

    const dueDate = new Date(bill.dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return {
        label: language === 'pt' ? 'Vencida' : 'Overdue',
        color: 'text-rose-600 dark:text-rose-400',
        bgColor: 'bg-rose-50 dark:bg-rose-900/30',
        icon: XCircleIcon
      };
    } else if (daysUntilDue <= 3) {
      return {
        label: language === 'pt' ? `Vence em ${daysUntilDue}d` : `Due in ${daysUntilDue}d`,
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-900/30',
        icon: BellIcon
      };
    } else {
      return {
        label: language === 'pt' ? `Vence em ${daysUntilDue}d` : `Due in ${daysUntilDue}d`,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/30',
        icon: ClockIcon
      };
    }
  };

  const formatDueDate = (dateString) => {
    const date = new Date(dateString);
    const locale = language === 'pt' ? 'pt-BR' : 'en-US';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };



  const BillItem = ({ bill }) => {
    const status = getBillStatus(bill);
    const StatusIcon = status.icon;

    return (
      <div
        onClick={() => setEditingBill(bill)}
        className="group flex items-center gap-2 sm:gap-3 p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
      >
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${status.bgColor} flex items-center justify-center flex-shrink-0`}>
          <StatusIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${status.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <p className="font-medium text-gray-900 dark:text-white truncate text-xs sm:text-sm">
              {bill.name}
            </p>
            {bill.recurrence !== 'none' && (
              <span className="hidden sm:inline-flex flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 rounded">
                {bill.recurrence === 'monthly' ? (language === 'pt' ? 'Mensal' : 'Monthly') :
                 bill.recurrence === 'weekly' ? (language === 'pt' ? 'Semanal' : 'Weekly') :
                 (language === 'pt' ? 'Anual' : 'Yearly')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
            <span className={`${status.color} font-medium`}>{status.label}</span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="truncate">{formatDueDate(bill.dueDate)}</span>
          </div>
        </div>

        {bill.status !== 'paid' && (
          <button
            onClick={(e) => { e.stopPropagation(); handleMarkPaid(bill.id); }}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 sm:p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all flex-shrink-0"
            title={language === 'pt' ? 'Marcar como pago' : 'Mark as paid'}
          >
            <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`${compact ? '' : 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm'}`}>
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin w-6 h-6 text-gray-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </div>
    );
  }

  console.log('BillsList - Before compact view logic. Loading:', loading, 'Bills:', bills, 'Upcoming:', upcomingBills, 'Overdue:', overdueBills);

  if (compact) {
    // Compact view for dashboard
        const allBills = [...overdueBills, ...upcomingBills];
    const displayBills = allBills.slice(0, 3);

    if (displayBills.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            {language === 'pt' ? 'Contas a Pagar' : 'Bills to Pay'}
          </h3>
          <div className="text-center py-6 sm:py-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {language === 'pt' ? 'Nenhuma conta pendente' : 'No pending bills'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              {language === 'pt' ? 'Contas a Pagar' : 'Bills to Pay'}
            </h3>
            {allBills.length > 3 && (
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {allBills.length} {language === 'pt' ? 'contas' : 'bills'}
              </span>
            )}
          </div>

          <div className="space-y-1 sm:space-y-2">
            {displayBills.map((bill) => (
              <BillItem key={bill.id} bill={bill} />
            ))}
          </div>

          {allBills.length > 3 && (
            <button
              onClick={() => setShowAllBills(true)}
              className="mt-2 sm:mt-3 w-full py-2 text-xs sm:text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
            >
              {language === 'pt' ? `Ver todas (${allBills.length})` : `See all (${allBills.length})`}
            </button>
          )}
        </div>

        {/* Edit Bill Modal */}
        <BillModal
          isOpen={!!editingBill}
          onClose={() => setEditingBill(null)}
          bill={editingBill}
        />

        {/* Full Bills Modal */}
        {showAllBills && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowAllBills(false)} />
            <div className="absolute inset-4 sm:inset-8 lg:inset-16 bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 sm:p-6 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                  {language === 'pt' ? 'Todas as Contas' : 'All Bills'}
                </h2>
                <button
                  onClick={() => setShowAllBills(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
                  <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wide mb-1">
                      {language === 'pt' ? 'Vencidas' : 'Overdue'}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">{overdueBills.length}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
                      {language === 'pt' ? 'Próximas' : 'Upcoming'}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{upcomingBills.length}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
                      {language === 'pt' ? 'Pagas' : 'Paid'}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{paidBills.length}</p>
                  </div>
                </div>

                {/* Bills list */}
                <div className="space-y-4">
                  {overdueBills.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-2 uppercase tracking-wide">
                        {language === 'pt' ? 'Vencidas' : 'Overdue'}
                      </h3>
                      <div className="space-y-1 bg-white dark:bg-gray-800 rounded-xl p-2">
                        {overdueBills.map((bill) => (
                          <BillItem key={bill.id} bill={bill} />
                        ))}
                      </div>
                    </div>
                  )}

                  {upcomingBills.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">
                        {language === 'pt' ? 'Próximas (7 dias)' : 'Upcoming (7 days)'}
                      </h3>
                      <div className="space-y-1 bg-white dark:bg-gray-800 rounded-xl p-2">
                        {upcomingBills.map((bill) => (
                          <BillItem key={bill.id} bill={bill} />
                        ))}
                      </div>
                    </div>
                  )}

                  {paidBills.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide">
                        {language === 'pt' ? 'Pagas recentemente' : 'Recently Paid'}
                      </h3>
                      <div className="space-y-1 bg-white dark:bg-gray-800 rounded-xl p-2">
                        {paidBills.slice(0, 10).map((bill) => (
                          <BillItem key={bill.id} bill={bill} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Full view
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {language === 'pt' ? 'Gerenciar Contas' : 'Manage Bills'}
        </h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wide mb-1">
            {language === 'pt' ? 'Vencidas' : 'Overdue'}
          </p>
          <p className="text-lg sm:text-2xl font-bold text-rose-600 dark:text-rose-400">{overdueBills.length}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
            {language === 'pt' ? 'Próximas' : 'Upcoming'}
          </p>
          <p className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{upcomingBills.length}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
            {language === 'pt' ? 'Pagas' : 'Paid'}
          </p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{paidBills.length}</p>
        </div>
      </div>

      {/* Bills list */}
      <div className="space-y-4">
        {overdueBills.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-2 uppercase tracking-wide">
              {language === 'pt' ? 'Vencidas' : 'Overdue'}
            </h3>
            <div className="space-y-1">
              {overdueBills.map((bill) => (
                <BillItem key={bill.id} bill={bill} />
              ))}
            </div>
          </div>
        )}

        {upcomingBills.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">
              {language === 'pt' ? 'Próximas (7 dias)' : 'Upcoming (7 days)'}
            </h3>
            <div className="space-y-1">
              {upcomingBills.map((bill) => (
                <BillItem key={bill.id} bill={bill} />
              ))}
            </div>
          </div>
        )}

        {paidBills.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide">
              {language === 'pt' ? 'Pagas recentemente' : 'Recently Paid'}
            </h3>
            <div className="space-y-1">
              {paidBills.slice(0, 5).map((bill) => (
                <BillItem key={bill.id} bill={bill} />
              ))}
            </div>
          </div>
        )}

        {bills.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {language === 'pt' ? 'Nenhuma conta cadastrada' : 'No bills registered'}
            </p>
          </div>
        )}
      </div>

      {/* Edit Bill Modal */}
      <BillModal
        isOpen={!!editingBill}
        onClose={() => setEditingBill(null)}
        bill={editingBill}
      />
    </div>
  );
}