import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import PageHelp from '@/components/ui/PageHelp';
import { useBills } from '../contexts/BillsContext';
import { useAccess } from '../contexts/AccessContext';
import { useMonth } from '../contexts/MonthContext';
import BillsList from '../components/BillsList';
import PageHeader from '../components/PageHeader';
import { SparklesIcon } from '@heroicons/react/24/outline';

export default function BillsPage() {
  const { language, billReminders, updateBillReminders, formatCurrency } = useSettings();
  const { bills } = useBills();
  const { canWrite } = useAccess();
  const { selectedMonth } = useMonth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState(() => {
    const s = searchParams.get('status');
    return ['all', 'pending', 'paid', 'overdue'].includes(s) ? s : 'all';
  });

  const pt = language === 'pt';
  // "Falta pagar": what is still unpaid among the bills that fall due in the selected month, and how many are late.
  const hero = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const inMonth = bills.filter((b) => {
      const d = new Date(b.dueDate);
      return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m;
    });
    const unpaid = inMonth.filter((b) => b.status !== 'paid');
    const now = new Date();
    const late = unpaid.filter((b) => new Date(b.dueDate) < now);
    return {
      total: unpaid.reduce((s, b) => s + Number(b.amount || 0), 0),
      unpaid: unpaid.length,
      late: late.length,
      paid: inMonth.length - unpaid.length,
      all: inMonth.length,
    };
  }, [bills, selectedMonth]);

  return (
    <div className="min-h-screen bg-[var(--rw-bg)] transition-colors">
      <PageHeader title={language === 'pt' ? 'Contas' : 'Bills'} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-4 pb-24">
        <section className="rw-hero rw-hero-violet mb-3 flex flex-col gap-3 p-5" aria-label={pt ? 'Falta pagar' : 'Left to pay'}>
          <span className="rw-eyebrow text-violet-300">{pt ? 'FALTA PAGAR NESTE MÊS' : 'LEFT TO PAY THIS MONTH'}</span>
          <div className="flex flex-col">
            <span className="rw-num text-5xl font-extrabold leading-[50px]">{formatCurrency(hero.total).replace(/,00(?=\D*$)/, '')}</span>
            <span className="text-[15px] text-violet-100">
              {hero.all === 0
                ? (pt ? 'nenhuma conta neste mês' : 'no bills this month')
                : `${pt ? 'em' : 'in'} ${hero.unpaid} ${pt ? (hero.unpaid === 1 ? 'conta' : 'contas') : (hero.unpaid === 1 ? 'bill' : 'bills')}${hero.late > 0 ? (pt ? `. ${hero.late} ${hero.late === 1 ? 'está atrasada' : 'estão atrasadas'}.` : `. ${hero.late} overdue.`) : '.'}`}
            </span>
          </div>
          {hero.all > 0 && (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-white/10"><i className="block h-full rounded-full bg-violet-300" style={{ width: `${(hero.paid / hero.all) * 100}%` }} /></div>
              <span className="text-[13px] text-violet-200">{pt ? `Você já pagou ${hero.paid} de ${hero.all} contas este mês.` : `You paid ${hero.paid} of ${hero.all} bills this month.`}</span>
            </>
          )}
        </section>

        {/* Filters + Email reminder toggle */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--rw-border)] bg-[var(--rw-surface)] p-3">
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
                className={`px-3 h-9 rounded-full text-sm font-semibold transition-colors ${
                  statusFilter === option.value
                    ? 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]'
                    : 'bg-[var(--rw-raised)] text-[var(--rw-muted)]'
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
            <span className="text-sm text-[var(--rw-muted)]">
              {language === 'pt' ? 'Lembretes' : 'Reminders'}
            </span>
            <button
              role="switch"
              aria-checked={billReminders}
              onClick={() => updateBillReminders(!billReminders)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${billReminders ? 'bg-[var(--rw-brand)]' : 'bg-[var(--rw-track)]'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${billReminders ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Bills List */}
        <div className="rounded-[20px] border border-[var(--rw-border)] bg-[var(--rw-surface)] overflow-hidden">
          <BillsList selectedMonth={selectedMonth} statusFilter={statusFilter} />
        </div>
      </main>

      {/* Bills are added through the assistant */}
      {canWrite && (
        <button
          onClick={() => navigate('/chat')}
          className="hidden lg:flex fixed bottom-6 right-6 z-50 w-14 h-14 bg-[var(--rw-brand)] hover:opacity-90 text-white rounded-full shadow-lg items-center justify-center transition-colors"
          aria-label={language === 'pt' ? 'Adicionar pelo assistente' : 'Add with the assistant'}
        >
          <SparklesIcon className="w-7 h-7" />
        </button>
      )}
      <PageHelp
        title="Contas"
        text="Controle suas contas a pagar. Marque como paga quando quitar e receba lembretes por e-mail antes do vencimento. Contas recorrentes se repetem automaticamente."
        hasFab={false}
      />
    </div>
  );
}
