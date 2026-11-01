import PageHeader from '../components/PageHeader';
import { useMemo } from 'react';
import {
  BellIcon,
  BellSlashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '../contexts/SettingsContext';
import { useBills } from '../contexts/BillsContext';

export default function NotificationsPage() {
  const { language } = useSettings();
  const { bills } = useBills();

  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

  const billsWithReminders = useMemo(
    () => bills.filter((bill) => bill.status === 'pending' && bill.dueDate),
    [bills]
  );

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const locale = language === 'pt' ? 'pt-BR' : 'en-US';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  return (
    <div className="min-h-screen bg-[var(--rw-bg)] transition-colors">
      <PageHeader title={language === 'pt' ? 'Notificações' : 'Notifications'} showMonth={false} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* Push notification status card */}
        <div className="bg-[var(--rw-surface)] rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 sm:p-6 border-b border-[var(--rw-border)]">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${permission === 'granted' ? 'bg-[var(--rw-brand-soft)]' : 'bg-[var(--rw-raised)]'}`}>
                {permission === 'granted'
                  ? <BellIcon className="w-6 h-6 text-[var(--rw-brand-ink)]" />
                  : <BellSlashIcon className="w-6 h-6 text-gray-400" />}
              </div>
              <div>
                <h2 className="font-bold text-[var(--rw-ink)]">
                  {language === 'pt' ? 'Notificações Push' : 'Push Notifications'}
                </h2>
                <p className="text-sm text-[var(--rw-muted)]">
                  {permission === 'granted'
                    ? (language === 'pt' ? 'Notificações ativas' : 'Notifications enabled')
                    : permission === 'denied'
                      ? (language === 'pt' ? 'Permissão negada pelo navegador' : 'Permission denied by browser')
                      : (language === 'pt' ? 'Permissão não concedida ainda' : 'Permission not granted yet')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-[var(--rw-brand-soft)] border border-violet-200 dark:border-violet-800 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <BellIcon className="w-5 h-5 text-[var(--rw-brand-ink)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-violet-800 dark:text-violet-200">
                {language === 'pt' ? 'Como funciona?' : 'How does it work?'}
              </p>
              <p className="text-xs text-[var(--rw-brand-ink)] mt-1">
                {language === 'pt'
                  ? 'Todos os dias às 9h (horário de Brasília), você receberá uma notificação push sobre as contas próximas do vencimento ou atrasadas.'
                  : 'Every day at 9 AM (Brazil time), you will receive a push notification about bills that are due soon or overdue.'}
              </p>
            </div>
          </div>
        </div>

        {/* Pending bills list */}
        <div className="bg-[var(--rw-surface)] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--rw-border)]">
            <h3 className="font-bold text-[var(--rw-ink)]">
              {language === 'pt' ? 'Contas pendentes' : 'Pending bills'}
              <span className="ml-2 text-sm font-normal text-[var(--rw-muted)]">
                ({billsWithReminders.length})
              </span>
            </h3>
            <p className="text-xs text-[var(--rw-muted)] mt-1">
              {language === 'pt' ? 'Estas contas serão incluídas nos lembretes' : 'These bills will be included in reminders'}
            </p>
          </div>

          <div className="divide-y divide-[var(--rw-border)]">
            {billsWithReminders.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-medium text-[var(--rw-ink)]">
                  {language === 'pt' ? 'Nenhuma conta pendente' : 'No pending bills'}
                </p>
                <p className="text-sm text-[var(--rw-muted)] mt-1">
                  {language === 'pt' ? 'Todas as suas contas estão em dia!' : 'All your bills are up to date!'}
                </p>
              </div>
            ) : (
              billsWithReminders.slice(0, 10).map((bill) => {
                const dueDate = new Date(bill.dueDate);
                const today = new Date();
                const isOverdue = dueDate < today;
                const isDueSoon = !isOverdue && (dueDate - today) / (1000 * 60 * 60 * 24) <= 3;

                return (
                  <div key={bill.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-[var(--rw-ink)] text-sm">{bill.name}</p>
                      <p className={`text-xs ${
                        isOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : isDueSoon
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[var(--rw-muted)]'
                      }`}>
                        {isOverdue
                          ? (language === 'pt' ? 'Atrasada - ' : 'Overdue - ')
                          : isDueSoon
                            ? (language === 'pt' ? 'Vence em breve - ' : 'Due soon - ')
                            : ''}
                        {formatDate(bill.dueDate)}
                      </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      isOverdue ? 'bg-red-500' : isDueSoon ? 'bg-amber-500' : 'bg-[var(--rw-track)]'
                    }`} />
                  </div>
                );
              })
            )}
            {billsWithReminders.length > 10 && (
              <div className="p-4 text-center text-sm text-[var(--rw-muted)]">
                {language === 'pt'
                  ? `+${billsWithReminders.length - 10} outras contas`
                  : `+${billsWithReminders.length - 10} more bills`}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
