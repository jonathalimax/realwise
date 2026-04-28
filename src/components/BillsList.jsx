import { useState } from 'react';
import { useBills } from '../contexts/BillsContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import useCardBillAmounts from '../hooks/useCardBillAmounts';
import BillModal from './BillModal';
import { BellIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function BillsList({ compact = false, selectedMonth, statusFilter = 'all' }) {
  const { bills, loading, markBillAsPaid } = useBills();
  const { language, formatCurrency } = useSettings();
  const { canWrite } = useAccess();
  const [editingBill, setEditingBill] = useState(null);
  const [showAllBills, setShowAllBills] = useState(false);
  const [confirmPayBillId, setConfirmPayBillId] = useState(null);

  const cardAmounts = useCardBillAmounts(bills, selectedMonth);

  const getBillAmount = (bill) => cardAmounts.get(bill.id) ?? bill.amount ?? 0;

  // Parse selectedMonth for filtering (format: "YYYY-MM")
  const [selectedYear, selectedMonthNum] = selectedMonth
    ? selectedMonth.split('-').map(Number)
    : [new Date().getFullYear(), new Date().getMonth() + 1];

  // Expand recurring bills to show virtual instances for the selected month
  const expandRecurringBills = (billsList) => {
    const expandedBills = [];

    billsList.forEach(bill => {
      const originalDueDate = new Date(bill.dueDate);
      // Use UTC methods to avoid timezone issues
      const originalYear = originalDueDate.getUTCFullYear();
      const originalMonth = originalDueDate.getUTCMonth() + 1;

      // If bill is in the selected month, add it as-is
      if (originalYear === selectedYear && originalMonth === selectedMonthNum) {
        expandedBills.push(bill);
        return;
      }

      // For non-recurring bills not in selected month, skip
      if (!bill.recurrence || bill.recurrence === 'none') {
        // Still add it for overdue checking
        expandedBills.push(bill);
        return;
      }

      // Check if recurrence has ended
      if (bill.recurrenceEndDate) {
        const endDate = new Date(bill.recurrenceEndDate);
        const selectedDateUTC = Date.UTC(selectedYear, selectedMonthNum - 1, 1);
        if (selectedDateUTC > endDate.getTime()) {
          return; // Recurrence ended before selected month
        }
      }

      // For recurring bills, calculate the due date for the selected month
      if (bill.recurrence === 'monthly') {
        // Only generate instance if selected month is >= original month
        const selectedDateUTC = Date.UTC(selectedYear, selectedMonthNum - 1, 1);
        const originalDateUTC = Date.UTC(originalYear, originalMonth - 1, 1);

        if (selectedDateUTC >= originalDateUTC) {
          // Create virtual instance for the selected month using UTC
          const day = originalDueDate.getUTCDate();
          // Handle months with fewer days (e.g., Feb 30 -> Feb 28)
          const lastDayOfMonth = new Date(Date.UTC(selectedYear, selectedMonthNum, 0)).getUTCDate();
          const adjustedDay = Math.min(day, lastDayOfMonth);
          const virtualDueDate = new Date(Date.UTC(selectedYear, selectedMonthNum - 1, adjustedDay));

          expandedBills.push({
            ...bill,
            dueDate: virtualDueDate.toISOString(),
            originalDueDate: bill.dueDate,
            isRecurringInstance: true,
            status: bill.status === 'paid' ? 'pending' : bill.status // Reset status for future instances
          });
        }
      } else if (bill.recurrence === 'yearly') {
        // For yearly, only show if it's the same month as original
        if (originalMonth === selectedMonthNum && selectedYear >= originalYear) {
          const day = originalDueDate.getUTCDate();
          const lastDayOfMonth = new Date(Date.UTC(selectedYear, selectedMonthNum, 0)).getUTCDate();
          const adjustedDay = Math.min(day, lastDayOfMonth);
          const virtualDueDate = new Date(Date.UTC(selectedYear, selectedMonthNum - 1, adjustedDay));

          expandedBills.push({
            ...bill,
            dueDate: virtualDueDate.toISOString(),
            originalDueDate: bill.dueDate,
            isRecurringInstance: true,
            status: bill.status === 'paid' ? 'pending' : bill.status
          });
        }
      }
      // Weekly bills are handled differently - we'd need to check each week
      // For simplicity, we'll show them if they started before selected month
      else if (bill.recurrence === 'weekly') {
        // Add original bill for reference
        expandedBills.push(bill);
      }
    });

    return expandedBills;
  };

  // Expand bills to include recurring instances for selected month
  const expandedBills = expandRecurringBills(bills);

  const isInSelectedMonth = (bill) => {
    const dueDate = new Date(bill.dueDate);
    return dueDate.getUTCFullYear() === selectedYear &&
           (dueDate.getUTCMonth() + 1) === selectedMonthNum;
  };

  const isOverdueFromPreviousMonth = (bill) => {
    if (bill.status === 'paid') return false;
    if (bill.isRecurringInstance) return false; // Don't show recurring instances as overdue from previous months
    const dueDate = new Date(bill.dueDate);
    const now = new Date();
    return dueDate < now && (
      dueDate.getUTCFullYear() < selectedYear ||
      (dueDate.getUTCFullYear() === selectedYear && (dueDate.getUTCMonth() + 1) < selectedMonthNum)
    );
  };

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Filter bills from expandedBills (which includes recurring instances for selected month)
  const monthlyBills = expandedBills.filter(isInSelectedMonth);

  // Upcoming: pending bills due within 7 days from now AND in selected month
  const upcomingBills = monthlyBills
    .filter(bill => {
      if (bill.status === 'paid') return false;
      const dueDate = new Date(bill.dueDate);
      return dueDate >= now && dueDate <= nextWeek;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // Overdue: pending bills past due (in selected month or from previous months)
  const overdueBills = expandedBills
    .filter(bill => {
      if (bill.status === 'paid') return false;
      const dueDate = new Date(bill.dueDate);
      const isOverdue = dueDate < now;
      return isOverdue && (isInSelectedMonth(bill) || isOverdueFromPreviousMonth(bill));
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // Paid bills in selected month
  const paidBills = monthlyBills.filter(b => b.status === 'paid');

  // Pending bills due more than 7 days away in selected month
  const otherPendingBills = monthlyBills
    .filter(bill => {
      if (bill.status === 'paid') return false;
      const dueDate = new Date(bill.dueDate);
      return dueDate > nextWeek;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));


  const handleMarkPaid = async (billId) => {
    await markBillAsPaid(billId);
    setConfirmPayBillId(null);
  };

  const handleConfirmPayClick = (billId, event) => {
    event.stopPropagation();
    setConfirmPayBillId(billId);
  };

  const handleCancelPay = (event) => {
    event.stopPropagation();
    setConfirmPayBillId(null);
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
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };



  const BillItem = ({ bill }) => {
    const status = getBillStatus(bill);
    const StatusIcon = status.icon;
    const isConfirming = confirmPayBillId === bill.id;

    return (
      <div className="relative">
        <div
          onClick={() => canWrite && !isConfirming && setEditingBill(bill)}
          className={`group flex items-center gap-2 sm:gap-3 p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg ${canWrite && !isConfirming ? 'cursor-pointer' : ''} transition-colors`}
        >
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${status.bgColor} flex items-center justify-center flex-shrink-0`}>
            <StatusIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${status.color}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2">
              <p className="font-medium text-gray-900 dark:text-white truncate text-xs sm:text-sm">
                {bill.name}
              </p>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
              <span className={`${status.color} font-medium`}>{status.label}</span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span className="truncate">{formatDueDate(bill.dueDate)}</span>
            </div>
            {getBillAmount(bill) > 0 && (
              <p className="text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-200 mt-0.5">
                {formatCurrency(getBillAmount(bill))}
              </p>
            )}
          </div>

          {/* Mark as paid button - only for write access */}
          {canWrite && bill.status !== 'paid' && !isConfirming && (
            <button
              onClick={(e) => handleConfirmPayClick(bill.id, e)}
              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 sm:p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all flex-shrink-0"
              title={language === 'pt' ? 'Marcar como pago' : 'Mark as paid'}
            >
              <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>

        {/* Confirmation overlay */}
        {isConfirming && (
          <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-900 rounded-lg p-2 sm:p-3 flex items-center gap-2 z-10">
            <span className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 font-medium flex-1">
              {language === 'pt' ? 'Marcar como pago?' : 'Mark as paid?'}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleMarkPaid(bill.id); }}
              className="px-2 sm:px-3 py-1 bg-emerald-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
            >
              {language === 'pt' ? 'Sim' : 'Yes'}
            </button>
            <button
              onClick={handleCancelPay}
              className="px-2 sm:px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              {language === 'pt' ? 'Não' : 'No'}
            </button>
          </div>
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


  if (compact) {
    // Filter expanded bills for the selected month (unpaid bills with dueDate in selected month)
    const monthBills = expandedBills.filter(bill => {
      if (bill.status === 'paid') return false;
      return isInSelectedMonth(bill);
    });

    // Also include overdue bills from previous months that are still unpaid (non-recurring only)
    const overdueFromPreviousMonths = expandedBills.filter(bill => {
      if (bill.status === 'paid') return false;
      if (bill.isRecurringInstance) return false;
      const dueDate = new Date(bill.dueDate);
      const now = new Date();
      // Bill is overdue (past due date) and from a previous month
      return dueDate < now && (dueDate.getUTCFullYear() < selectedYear ||
        (dueDate.getUTCFullYear() === selectedYear && (dueDate.getUTCMonth() + 1) < selectedMonthNum));
    });

    // Combine and sort by due date (no limit - show all)
    const displayBills = [...overdueFromPreviousMonths, ...monthBills].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const totalBillsCount = expandedBills.filter(b => isInSelectedMonth(b)).length; // Count for selected month

    if (displayBills.length === 0 && totalBillsCount === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
            {language === 'pt' ? 'Contas a Pagar' : 'Bills to Pay'}
          </h3>
          <div className="text-center py-6 sm:py-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {language === 'pt' ? 'Nenhuma conta cadastrada' : 'No bills registered'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {language === 'pt' ? 'Contas a Pagar' : 'Bills to Pay'}
            </h3>
            {displayBills.length > 0 && (
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {displayBills.length} {language === 'pt' ? 'pendentes' : 'pending'}
              </span>
            )}
          </div>

          {displayBills.length > 0 ? (
            <>
              {/* Scrollable container with max height to prevent layout breaking */}
              <div className="space-y-1 sm:space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {displayBills.map((bill) => (
                  <BillItem key={bill.id} bill={bill} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {language === 'pt' ? 'Nenhuma conta pendente' : 'No pending bills'}
              </p>
            </div>
          )}

          {totalBillsCount > 0 && (
            <button
              onClick={() => setShowAllBills(true)}
              className="mt-2 sm:mt-3 w-full py-2 text-xs sm:text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
            >
              {language === 'pt' ? `Ver todas (${totalBillsCount})` : `See all (${totalBillsCount})`}
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
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
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
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                      {language === 'pt' ? 'Outras' : 'Other'}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{otherPendingBills.length}</p>
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
                      <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-2 uppercase tracking-wide">
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
                      <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">
                        {language === 'pt' ? 'Próximas (7 dias)' : 'Upcoming (7 days)'}
                      </h3>
                      <div className="space-y-1 bg-white dark:bg-gray-800 rounded-xl p-2">
                        {upcomingBills.map((bill) => (
                          <BillItem key={bill.id} bill={bill} />
                        ))}
                      </div>
                    </div>
                  )}

                  {otherPendingBills.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">
                        {language === 'pt' ? 'Outras Pendentes' : 'Other Pending'}
                      </h3>
                      <div className="space-y-1 bg-white dark:bg-gray-800 rounded-xl p-2">
                        {otherPendingBills.map((bill) => (
                          <BillItem key={bill.id} bill={bill} />
                        ))}
                      </div>
                    </div>
                  )}

                  {paidBills.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide">
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {language === 'pt' ? 'Gerenciar Contas' : 'Manage Bills'}
        </h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-6">
        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wide mb-1">
            {language === 'pt' ? 'Vencidas' : 'Overdue'}
          </p>
          <p className="text-lg sm:text-2xl font-bold text-rose-600 dark:text-rose-400">{overdueBills.length}</p>
          <p className="text-[10px] sm:text-xs text-rose-500 dark:text-rose-400 mt-0.5 truncate">{formatCurrency(overdueBills.reduce((s, b) => s + getBillAmount(b), 0))}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
            {language === 'pt' ? 'Próximas' : 'Upcoming'}
          </p>
          <p className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{upcomingBills.length}</p>
          <p className="text-[10px] sm:text-xs text-amber-500 dark:text-amber-400 mt-0.5 truncate">{formatCurrency(upcomingBills.reduce((s, b) => s + getBillAmount(b), 0))}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
            {language === 'pt' ? 'Pendentes' : 'Pending'}
          </p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{otherPendingBills.length}</p>
          <p className="text-[10px] sm:text-xs text-blue-500 dark:text-blue-400 mt-0.5 truncate">{formatCurrency(otherPendingBills.reduce((s, b) => s + getBillAmount(b), 0))}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2 sm:p-4">
          <p className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
            {language === 'pt' ? 'Pagas' : 'Paid'}
          </p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{paidBills.length}</p>
          <p className="text-[10px] sm:text-xs text-emerald-500 dark:text-emerald-400 mt-0.5 truncate">{formatCurrency(paidBills.reduce((s, b) => s + getBillAmount(b), 0))}</p>
        </div>
      </div>

      {/* Bills list */}
      <div className="space-y-4">
        {(statusFilter === 'all' || statusFilter === 'overdue') && overdueBills.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-2 uppercase tracking-wide">
              {language === 'pt' ? 'Vencidas' : 'Overdue'}
            </h3>
            <div className="space-y-1">
              {overdueBills.map((bill) => (
                <BillItem key={bill.id} bill={bill} />
              ))}
            </div>
          </div>
        )}

        {(statusFilter === 'all' || statusFilter === 'pending') && upcomingBills.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">
              {language === 'pt' ? 'Próximas (7 dias)' : 'Upcoming (7 days)'}
            </h3>
            <div className="space-y-1">
              {upcomingBills.map((bill) => (
                <BillItem key={bill.id} bill={bill} />
              ))}
            </div>
          </div>
        )}

        {(statusFilter === 'all' || statusFilter === 'pending') && otherPendingBills.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">
              {language === 'pt' ? 'Pendentes' : 'Pending'}
            </h3>
            <div className="space-y-1">
              {otherPendingBills.map((bill) => (
                <BillItem key={bill.id} bill={bill} />
              ))}
            </div>
          </div>
        )}

        {(statusFilter === 'all' || statusFilter === 'paid') && paidBills.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide">
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