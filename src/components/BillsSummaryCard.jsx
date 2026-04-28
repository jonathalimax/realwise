import { useBills } from '../contexts/BillsContext';
import { useSettings } from '../contexts/SettingsContext';
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function BillsSummaryCard({ selectedMonth }) {
  const { bills, loading } = useBills();
  const { language } = useSettings();

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
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        {language === 'pt' ? 'Contas do Mês' : 'Monthly Bills'}
      </h3>

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
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  {language === 'pt' ? 'Total' : 'Total'}
                </p>
              </div>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{totalBills}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {language === 'pt' ? 'contas' : 'bills'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClockIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                  {language === 'pt' ? 'A Pagar' : 'To Pay'}
                </p>
              </div>
              <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{pendingBills}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                {language === 'pt' ? 'pendentes' : 'pending'}
              </p>
            </div>
          </div>

          {paidBills > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
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
              <div className="mt-2 h-2 bg-emerald-200 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${(paidBills / totalBills) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
