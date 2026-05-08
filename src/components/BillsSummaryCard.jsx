import { useNavigate } from 'react-router-dom';
import { useBills } from '../contexts/BillsContext';
import { useSettings } from '../contexts/SettingsContext';
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function BillsSummaryCard({ selectedMonth }) {
  const { bills, loading } = useBills();
  const { language } = useSettings();
  const navigate = useNavigate();

  // Parse selectedMonth for filtering (format: "YYYY-MM")
  const [selectedYear, selectedMonthNum] = selectedMonth
    ? selectedMonth.split('-').map(Number)
    : [new Date().getFullYear(), new Date().getMonth() + 1];

  const isInSelectedMonth = (bill) => {
    const dueDate = new Date(bill.dueDate);
    return dueDate.getUTCFullYear() === selectedYear &&
           (dueDate.getUTCMonth() + 1) === selectedMonthNum;
  };

  // Expand recurring bills for the selected month
  const expandRecurringBills = (billsList) => {
    const expandedBills = [];

    billsList.forEach(bill => {
      const originalDueDate = new Date(bill.dueDate);
      const originalYear = originalDueDate.getUTCFullYear();
      const originalMonth = originalDueDate.getUTCMonth() + 1;

      if (originalYear === selectedYear && originalMonth === selectedMonthNum) {
        expandedBills.push(bill);
        return;
      }

      if (!bill.recurrence || bill.recurrence === 'none') {
        expandedBills.push(bill);
        return;
      }

      if (bill.recurrenceEndDate) {
        const endDate = new Date(bill.recurrenceEndDate);
        const selectedDateUTC = Date.UTC(selectedYear, selectedMonthNum - 1, 1);
        if (selectedDateUTC > endDate.getTime()) {
          return;
        }
      }

      if (bill.recurrence === 'monthly') {
        const selectedDateUTC = Date.UTC(selectedYear, selectedMonthNum - 1, 1);
        const originalDateUTC = Date.UTC(originalYear, originalMonth - 1, 1);

        if (selectedDateUTC >= originalDateUTC) {
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
      } else if (bill.recurrence === 'yearly') {
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
    });

    return expandedBills;
  };

  const expandedBills = expandRecurringBills(bills);
  const monthBills = expandedBills.filter(isInSelectedMonth);
  const totalBills = monthBills.length;
  const paidBills = monthBills.filter(b => b.status === 'paid').length;
  const pendingBills = totalBills - paidBills;

  const handlePendingClick = () => navigate('/bills?status=pending');
  const handlePaidClick = () => navigate('/bills?status=paid');
  const handleTotalClick = () => navigate('/bills');

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {language === 'pt' ? 'Contas do Mês' : 'Monthly Bills'}
        </h3>
        <button
          onClick={handleTotalClick}
          className="p-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label={language === 'pt' ? 'Ver todas as contas' : 'View all bills'}
        >
          <svg className="w-5 h-5 text-gray-400 hover:text-violet-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {totalBills === 0 ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">📄</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {language === 'pt' ? 'Nenhuma conta neste mês' : 'No bills this month'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={handlePendingClick}
            className="w-full text-left bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/30 rounded-xl p-4 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                  {language === 'pt' ? 'A Pagar' : 'To Pay'}
                </p>
              </div>
              <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{pendingBills}</p>
            </div>
          </button>

          {paidBills > 0 && (
            <button
              onClick={handlePaidClick}
              className="w-full text-left bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    {language === 'pt' ? 'Pagas' : 'Paid'}
                  </span>
                </div>
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {paidBills}
                </span>
              </div>
              <div className="h-2 bg-emerald-200 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${(paidBills / totalBills) * 100}%` }}
                />
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
