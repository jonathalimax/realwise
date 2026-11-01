import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Shimmer } from '../components/ui/shimmer';
import { useMonth } from '../contexts/MonthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';
import { useBudget } from '../contexts/BudgetContext';
import { useBills } from '../contexts/BillsContext';
import useTransactions from '../hooks/useTransactions';
import usePlannerState from './planner/usePlannerState';
import RendaTab from './planner/RendaTab';

// Order: needs · wants · savings. The stored split uses necessidades / desejos / poupanca.
const PRESETS = [
  { id: 'balanced', label: '50·30·20', alloc: { necessidades: 50, desejos: 30, poupanca: 20 } },
  { id: 'tight', label: '70·10·20', alloc: { necessidades: 70, desejos: 10, poupanca: 20 } },
];

const BUCKETS = [
  { key: 'needs', field: 'necessidades', color: 'var(--rw-needs)', pt: 'Necessidades', en: 'Needs', hintPt: 'Moradia, mercado, contas, saúde', hintEn: 'Housing, groceries, bills, health' },
  { key: 'wants', field: 'desejos', color: 'var(--rw-wants)', pt: 'Desejos', en: 'Wants', hintPt: 'Lazer, restaurantes, compras', hintEn: 'Leisure, dining, shopping' },
  { key: 'savings', field: 'poupanca', color: 'var(--rw-save)', pt: 'Poupança', en: 'Savings', hintPt: 'Reserva e investimentos', hintEn: 'Emergency fund and investments', goal: true },
];

const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-[28px] border border-b-0 border-[var(--rw-border)] bg-[var(--rw-surface)] px-4 pb-6 pt-3 text-[var(--rw-ink)]">
        <span className="mx-auto h-1 w-10 rounded-full bg-[var(--rw-border)]" />
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-[44px] px-1 text-sm font-semibold text-[var(--rw-muted)]">Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** "Quanto cai na conta?" as one field. Gross, deductions and benefits only appear when the switch is on. */
function RendaSheet({ planner, onClose, formatCurrency }) {
  const { activeVersion, liquidezFinal, updateSalarioBruto, updateSalarioDeductions, updateSalarioBenefits, state, update, copyFromPreviousMonth } = planner;
  const hasDetail = (activeVersion?.salarioDeductions?.length ?? 0) + (activeVersion?.salarioBenefits?.length ?? 0) > 0;
  const [detail, setDetail] = useState(hasDetail);
  const [value, setValue] = useState(liquidezFinal > 0 ? String(liquidezFinal).replace('.', ',') : '');

  const save = () => {
    const n = Number(String(value).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return;
    updateSalarioBruto(n);
    updateSalarioDeductions([]);
    updateSalarioBenefits([]);
    onClose();
  };

  return (
    <Sheet title="Sua renda" onClose={onClose}>
      <p className="-mt-2 text-[15px] text-[var(--rw-muted)]">Quanto cai na sua conta por mês? O orçamento divide esse valor.</p>
      {!detail && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--rw-muted)]">Quanto cai na conta (líquido)</span>
            <input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="0,00"
              className="h-[60px] rounded-[14px] border border-[var(--rw-border)] bg-[var(--rw-raised)] px-3.5 text-2xl font-bold tabular-nums outline-none"
            />
          </label>
          {liquidezFinal > 0 && <p className="text-[13px] text-[var(--rw-subtle)]">Hoje: {formatCurrency(liquidezFinal)}</p>}
        </>
      )}
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-[15px] font-semibold">Detalhar descontos e benefícios</span>
          <span className="block text-[13px] text-[var(--rw-subtle)]">Para quem quer ver bruto, INSS, vale-refeição…</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={detail}
          aria-label="Detalhar descontos e benefícios"
          onClick={() => setDetail((v) => !v)}
          className={`relative h-7 w-12 shrink-0 rounded-full ${detail ? 'bg-[var(--rw-brand)]' : 'bg-[var(--rw-border)]'}`}
        >
          <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all ${detail ? 'left-[23px]' : 'left-[3px]'}`} />
        </button>
      </div>
      {detail ? (
        <RendaTab
          state={state}
          update={update}
          activeVersion={activeVersion}
          liquidezFinal={liquidezFinal}
          updateSalarioBruto={updateSalarioBruto}
          updateSalarioDeductions={updateSalarioDeductions}
          updateSalarioBenefits={updateSalarioBenefits}
          copyFromPreviousMonth={copyFromPreviousMonth}
        />
      ) : (
        <button type="button" onClick={save} className="h-[52px] rounded-[14px] bg-[var(--rw-brand)] text-[15px] font-bold text-white">Salvar renda</button>
      )}
    </Sheet>
  );
}

function SplitSheet({ alloc, onSave, onClose }) {
  const [vals, setVals] = useState({ ...alloc });
  const sum = vals.necessidades + vals.desejos + vals.poupanca;
  const set = (field) => (e) => setVals((v) => ({ ...v, [field]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }));
  return (
    <Sheet title="Personalizar divisão" onClose={onClose}>
      <p className="-mt-2 text-[15px] text-[var(--rw-muted)]">Quanto de cada R$ 100 vai para cada grupo. A soma precisa dar 100.</p>
      {BUCKETS.map((b) => (
        <label key={b.key} className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
          <span className="flex-1 text-[15px]">{b.pt}</span>
          <input type="number" min="0" max="100" value={vals[b.field]} onChange={set(b.field)} aria-label={b.pt}
            className="h-11 w-20 rounded-[12px] border border-[var(--rw-border)] bg-[var(--rw-raised)] px-3 text-right text-[15px] tabular-nums outline-none" />
          <span className="text-sm text-[var(--rw-muted)]">%</span>
        </label>
      ))}
      <p className={`text-sm font-semibold ${sum === 100 ? 'text-[var(--rw-pos)]' : 'text-[var(--rw-warn)]'}`}>{sum === 100 ? 'Soma 100%. Pode salvar.' : `Soma ${sum}%. Ajuste para dar 100%.`}</p>
      <button type="button" disabled={sum !== 100} onClick={() => { onSave(vals); onClose(); }} className="h-[52px] rounded-[14px] bg-[var(--rw-brand)] text-[15px] font-bold text-white disabled:opacity-50">Salvar divisão</button>
    </Sheet>
  );
}

export default function PlanningPage() {
  const { selectedMonth } = useMonth();
  const { formatCurrency } = useSettings();
  const { ownerId } = useAccess();
  const { getPaymentMonthKey } = useCards();
  const { calculate50_30_20 } = useBudget();
  const { transactions } = useTransactions({}, { enabled: Boolean(ownerId) });
  const planner = usePlannerState();
  const [sheet, setSheet] = useState(null);

  const { isLoading, liquidezFinal, monthAllocation, setMonthAllocation, copyFromPreviousMonth, state } = planner;
  const money = (v) => formatCurrency(Math.abs(v)).replace(/,00(?=\D*$)/, '');

  const monthTx = useMemo(
    () => transactions.filter((t) => {
      const d = new Date(t.date);
      if (t.type === 'income' || t.investmentId) return monthKeyOf(d) === selectedMonth;
      return getPaymentMonthKey(t.date, t.bankId, t.paymentMethod) === selectedMonth;
    }),
    [transactions, selectedMonth, getPaymentMonthKey],
  );
  const spent = useMemo(() => calculate50_30_20(monthTx, 0), [calculate50_30_20, monthTx]);
  const flow = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of monthTx) {
      if (t.ignored) continue;
      if (t.type === 'income') income += t.amount; else if (t.type === 'expense') expense += t.amount;
    }
    return { income, expense };
  }, [monthTx]);
  const { bills } = useBills();
  const billsLeft = useMemo(() => {
    const [by, bm] = selectedMonth.split('-').map(Number);
    const open = bills.filter((b) => {
      const d = new Date(b.dueDate);
      return b.status !== 'paid' && d.getUTCFullYear() === by && d.getUTCMonth() + 1 === bm;
    });
    return { count: open.length, total: open.reduce((sum, b) => sum + Number(b.amount || 0), 0) };
  }, [bills, selectedMonth]);

  const rows = BUCKETS.map((b) => {
    const planned = (liquidezFinal * (monthAllocation[b.field] ?? 0)) / 100;
    const used = spent[b.key]?.spent ?? 0;
    const usedPct = planned > 0 ? (used / planned) * 100 : 0;
    const left = planned - used;
    let status;
    let tone;
    if (b.goal) {
      status = used >= planned && planned > 0 ? 'Meta batida' : `Faltam ${money(left)}`;
      tone = used >= planned && planned > 0 ? 'pos' : 'muted';
    } else if (left < 0) {
      status = `Passou ${money(left)}`;
      tone = 'neg';
    } else if (usedPct >= 85) {
      status = `Perto do limite: sobram ${money(left)}`;
      tone = 'warn';
    } else {
      status = `Sobram ${money(left)}`;
      tone = 'pos';
    }
    return { ...b, planned, used, usedPct, status, tone, pct: monthAllocation[b.field] ?? 0 };
  });

  const spendable = rows.filter((r) => !r.goal).reduce((s, r) => s + (r.planned - r.used), 0);
  const now = new Date();
  const isCurrent = selectedMonth === monthKeyOf(now);
  const daysLeft = isCurrent ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1 : 0;
  const perDay = spendable > 0 && daysLeft > 0 ? spendable / daysLeft : 0;
  const activePreset = PRESETS.find((p) => p.alloc.necessidades === monthAllocation.necessidades && p.alloc.desejos === monthAllocation.desejos && p.alloc.poupanca === monthAllocation.poupanca);
  const toneClass = { pos: 'text-[var(--rw-pos)]', warn: 'text-[var(--rw-warn)]', neg: 'text-[var(--rw-neg)]', muted: 'text-[var(--rw-muted)]' };
  const barColor = (r) => (r.goal ? r.color : r.tone === 'neg' ? 'var(--rw-neg)' : r.tone === 'warn' ? 'var(--rw-warn)' : r.color);

  const prevKey = (() => { const [y, m] = (state?.selectedPlannerMonth ?? selectedMonth).split('-').map(Number); return monthKeyOf(new Date(y, m - 2, 1)); })();
  const canCopy = Boolean(state?.plannerVersions?.some((v) => v.from === prevKey));

  return (
    <div className="min-h-screen bg-[var(--rw-bg)]">
      <PageHeader title="Orçamento" />
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pb-24 pt-2 sm:px-6">
        {isLoading ? (
          <div className="space-y-3"><Shimmer className="h-48 w-full rounded-[28px]" /><Shimmer className="h-32 w-full rounded-[20px]" /><Shimmer className="h-64 w-full rounded-[20px]" /></div>
        ) : liquidezFinal <= 0 ? (
          <section className="rw-hero rw-hero-violet flex flex-col gap-3 p-5">
            <span className="rw-eyebrow text-violet-300">PRIMEIRO PASSO</span>
            <h2 className="text-[28px] font-extrabold leading-8 tracking-tight">Quanto você recebe por mês?</h2>
            <p className="text-[15px] text-violet-100">Com a sua renda, o Elio divide o dinheiro em três grupos e mostra quanto ainda dá para gastar.</p>
            <button type="button" onClick={() => setSheet('renda')} className="h-12 rounded-[14px] bg-white text-[15px] font-extrabold text-[#2a1b5c]">Definir minha renda</button>
          </section>
        ) : (
          <>
            <section className="rw-hero rw-hero-violet flex flex-col gap-3 p-5" aria-label="Quanto ainda posso gastar">
              <span className="rw-eyebrow text-violet-300">QUANTO AINDA POSSO GASTAR</span>
              <div className="flex flex-col">
                <span className="rw-num text-5xl font-extrabold leading-[50px]">{spendable < 0 ? '-' : ''}{money(spendable)}</span>
                <span className="text-[15px] text-violet-100">{spendable >= 0 ? 'e você está dentro do plano' : 'acima do que o plano permite'}</span>
              </div>
              {isCurrent && perDay > 0 && <p className="text-[15px] text-violet-50">Faltam {daysLeft} dias para o mês acabar. Dá para gastar cerca de {money(perDay)} por dia.</p>}
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold tabular-nums text-violet-50">+ {money(flow.income)} entraram</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold tabular-nums text-violet-50">{money(flow.expense)} saíram</span>
              </div>
            </section>

            <section className="rw-card flex flex-col gap-3" aria-label="Sua renda">
              <div className="flex items-baseline justify-between"><h3 className="text-[17px] font-bold">Sua renda</h3><button type="button" onClick={() => setSheet('renda')} className="min-h-[44px] -my-2 text-sm font-semibold text-[var(--rw-brand-ink)]">Editar</button></div>
              <div className="flex items-center justify-between"><span className="text-[15px] text-[var(--rw-muted)]">Você recebe por mês</span><span className="rw-num text-2xl font-bold">{money(liquidezFinal)}</span></div>
              <p className="text-[13px] text-[var(--rw-subtle)]">Este é o valor que o orçamento divide. Já considera descontos e benefícios.</p>
            </section>

            <section className="rw-card flex flex-col gap-3" aria-label="Como seu dinheiro é dividido">
              <h3 className="text-[17px] font-bold">Como seu dinheiro é dividido</h3>
              <p className="-mt-1 text-[15px] text-[var(--rw-muted)]">Cada real da sua renda ganha um destino. Escolha um jeito para começar.</p>
              <div className="flex gap-0.5 rounded-[14px] bg-[var(--rw-raised)] p-[3px]" role="tablist" aria-label="Escolha um plano">
                {PRESETS.map((p) => (
                  <button key={p.id} role="tab" aria-selected={activePreset?.id === p.id} onClick={() => setMonthAllocation(p.alloc)}
                    className={`h-[38px] flex-1 rounded-[11px] text-sm font-semibold ${activePreset?.id === p.id ? 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]' : 'text-[var(--rw-muted)]'}`}>{p.label}</button>
                ))}
                <button role="tab" aria-selected={!activePreset} onClick={() => setSheet('split')}
                  className={`h-[38px] flex-1 rounded-[11px] text-sm font-semibold ${!activePreset ? 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]' : 'text-[var(--rw-muted)]'}`}>Meu jeito</button>
              </div>
              {rows.map((r) => (
                <div key={r.key} className="flex flex-col gap-2.5 rounded-2xl bg-[var(--rw-raised)] p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                    <div className="min-w-0 flex-1"><div className="text-[15px] font-semibold">{r.pt}</div><div className="text-[13px] text-[var(--rw-subtle)]">{r.hintPt}</div></div>
                    <div className="text-right"><div className="rw-num text-[17px] font-semibold">{money(r.planned)}</div><div className="text-[13px] text-[var(--rw-subtle)]">{r.pct}% da renda</div></div>
                  </div>
                  <div className="rw-bar"><i style={{ width: `${Math.min(100, Math.max(r.used > 0 ? 2 : 0, r.usedPct))}%`, background: barColor(r) }} /></div>
                  <span className={`text-[13px] font-medium ${toneClass[r.tone]}`}>{r.status}</span>
                </div>
              ))}
              <button type="button" onClick={() => setSheet('split')} className="self-start min-h-[44px] text-sm font-semibold text-[var(--rw-brand-ink)]">Personalizar divisão</button>
            </section>

            <Link to="/bills" className="rw-card flex items-center gap-3" aria-label="Contas a pagar">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rw-raised)] text-[var(--rw-brand-ink)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M9 16l2 2 4-4" /></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold">Contas a pagar</span>
                <span className="block text-[13px] text-[var(--rw-subtle)]">{billsLeft.count === 0 ? 'Nenhuma conta pendente neste mês' : `${billsLeft.count} ${billsLeft.count === 1 ? 'conta pendente' : 'contas pendentes'} · ${money(billsLeft.total)}`}</span>
              </span>
              <span className="text-[var(--rw-muted)]" aria-hidden="true">›</span>
            </Link>

            <section className="rw-card flex flex-col gap-3" aria-label="Categorias">
              <div className="flex items-baseline justify-between"><h3 className="text-[17px] font-bold">Categorias</h3><Link to="/planning/categories" className="min-h-[44px] -my-2 flex items-center text-sm font-semibold text-[var(--rw-brand-ink)]">Ver todas</Link></div>
              <p className="text-[13px] leading-[18px] text-[var(--rw-subtle)]">Cada categoria pertence a um grupo. É assim que o Elio sabe onde cada gasto entra no plano.</p>
              <Link to="/planning/categories" className="flex h-12 items-center justify-center rounded-[14px] bg-[var(--rw-raised)] text-[15px] font-bold">Organizar categorias</Link>
            </section>

            {canCopy && <button type="button" onClick={() => { if (window.confirm('Copiar o plano do mês anterior para este mês?')) copyFromPreviousMonth(); }} className="h-11 rounded-[14px] bg-[var(--rw-raised)] text-sm font-bold">Copiar plano do mês anterior</button>}
          </>
        )}
      </div>

      {sheet === 'renda' && <RendaSheet planner={planner} onClose={() => setSheet(null)} formatCurrency={formatCurrency} />}
      {sheet === 'split' && <SplitSheet alloc={monthAllocation} onSave={setMonthAllocation} onClose={() => setSheet(null)} />}
    </div>
  );
}
