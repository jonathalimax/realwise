import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useSettings } from '../contexts/SettingsContext';
import { useBudget } from '../contexts/BudgetContext';
import usePlannerState from './planner/usePlannerState';
import { CATEGORY_CATALOG, catalogEntry } from '../lib/categoryCatalog';

const GROUPS = [
  { key: 'needs', pt: 'Necessidades', color: 'var(--rw-needs)' },
  { key: 'wants', pt: 'Desejos', color: 'var(--rw-wants)' },
  { key: 'savings', pt: 'Poupança', color: 'var(--rw-save)' },
];

function GroupPicker({ value, onPick, label }) {
  const current = GROUPS.find((g) => g.key === value) ?? GROUPS[1];
  return (
    <label className="relative flex h-11 items-center gap-2.5 rounded-[12px] border border-[var(--rw-border)] bg-[var(--rw-raised)] pl-3.5 pr-9">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: current.color }} />
      <select
        value={current.key}
        onChange={(e) => onPick(e.target.value)}
        aria-label={label}
        className="h-full w-full cursor-pointer appearance-none bg-transparent text-[15px] font-semibold text-[var(--rw-ink)] outline-none"
      >
        {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.pt}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3.5 text-xs text-[var(--rw-muted)]">▾</span>
    </label>
  );
}

const brl = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** Money field: "R$" prefix, thousands separators while idle, raw digits while typing. Commits on blur. */
function LimitField({ value, onCommit, label }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? (value > 0 ? brl.format(Math.round(value)) : '');
  return (
    <label className="flex h-11 items-center gap-1.5 rounded-[12px] border border-[var(--rw-border)] bg-[var(--rw-raised)] px-3">
      <span className="text-sm font-semibold text-[var(--rw-muted)]">R$</span>
      <input
        inputMode="numeric"
        value={shown}
        placeholder="0"
        aria-label={label}
        onFocus={() => setDraft(value > 0 ? String(Math.round(value)) : '')}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={() => { if (draft !== null) onCommit(draft || '0'); setDraft(null); }}
        className="w-20 bg-transparent text-right text-[15px] font-semibold tabular-nums text-[var(--rw-ink)] outline-none placeholder:text-[var(--rw-subtle)]"
      />
    </label>
  );
}

export default function PlanningCategoriesPage() {
  const { language, categories, toggleCategory, addCategory } = useSettings();
  const { categoryRuleMapping, setCategoryRule } = useBudget();
  const { liquidezFinal, categoryBudgetsPct, updateCategoryBudgetPct } = usePlannerState();
  const pt = language === 'pt';
  const uncategorized = pt ? 'Sem categoria' : 'Uncategorized';
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('wants');
  const [showCatalog, setShowCatalog] = useState(false);

  const enabled = useMemo(() => (categories?.expense ?? []).filter((c) => c !== uncategorized), [categories, uncategorized]);
  const isMapped = (name) => Boolean(categoryRuleMapping?.[name]);
  const unassigned = enabled.filter((c) => !isMapped(c));
  const groupOf = (name) => categoryRuleMapping?.[name] ?? 'wants';

  const catalogOff = CATEGORY_CATALOG.filter((c) => c.type === 'expense' && !enabled.includes(c[language === 'pt' ? 'pt' : 'en']) && c.pt !== 'Diversos');
  const limitOf = (name) => ((categoryBudgetsPct?.[name] ?? 0) * liquidezFinal) / 100;
  const setLimit = (name, value) => {
    const n = Number(String(value).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || liquidezFinal <= 0) return;
    updateCategoryBudgetPct(name, Math.round((n / liquidezFinal) * 1000) / 10);
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const ok = await addCategory('expense', name);
    if (ok) {
      await setCategoryRule(name, newGroup);
      setNewName('');
    }
  };

  const row = (name) => {
    const entry = catalogEntry(name);
    return (
      <div key={name} className="flex flex-col gap-2.5 py-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{name}</div>
          {entry?.hint && <div className="text-[13px] text-[var(--rw-subtle)]">{entry.hint}</div>}
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <GroupPicker value={groupOf(name)} onPick={(g) => setCategoryRule(name, g)} label={`${pt ? 'Grupo de' : 'Group of'} ${name}`} />
          </div>
          {liquidezFinal > 0 && (
            <LimitField value={limitOf(name)} onCommit={(v) => setLimit(name, v)} label={`${pt ? 'Limite de' : 'Limit for'} ${name}`} />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--rw-bg)] text-[var(--rw-ink)]">
      <PageHeader title={pt ? 'Categorias' : 'Categories'} backTo="/planning" showMonth={false} />
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pb-24 pt-1 sm:px-6">
        <p className="text-[15px] text-[var(--rw-muted)]">
          {pt
            ? 'Cada categoria pertence a um grupo do plano. Você pode mudar o grupo: Assinaturas pode ser Necessidade para quem trabalha com elas, ou Desejo para quem usa para assistir filmes.'
            : 'Every category belongs to a plan group. You can move it: Subscriptions can be a Need if you use them for work, or a Want if you watch movies.'}
        </p>

        {unassigned.length > 0 && (
          <section className="rw-card flex flex-col" style={{ borderColor: 'color-mix(in srgb, var(--rw-warn) 40%, transparent)' }}>
            <div className="flex items-center justify-between"><h3 className="text-[17px] font-bold">{pt ? 'Escolha um grupo' : 'Pick a group'}</h3><span className="rounded-full bg-[#fbbf2422] px-2.5 py-1 text-xs font-bold text-[var(--rw-warn)]">{unassigned.length} {pt ? 'sem grupo' : 'without group'}</span></div>
            <div className="divide-y divide-[var(--rw-border)]">{unassigned.map(row)}</div>
          </section>
        )}

        {GROUPS.map((g) => {
          const list = enabled.filter((c) => isMapped(c) && groupOf(c) === g.key);
          return (
            <section key={g.key} className="rw-card flex flex-col" aria-label={g.pt}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} /><h3 className="text-[17px] font-bold">{g.pt}</h3></div>
                <span className="text-[13px] text-[var(--rw-subtle)]">{list.length} {pt ? 'categorias' : 'categories'}</span>
              </div>
              {list.length > 0 ? <div className="divide-y divide-[var(--rw-border)]">{list.map(row)}</div> : <p className="py-3 text-[13px] text-[var(--rw-subtle)]">{pt ? 'Nenhuma categoria aqui ainda.' : 'No categories here yet.'}</p>}
            </section>
          );
        })}

        <section className="rw-card flex flex-col gap-3" aria-label={pt ? 'Adicionar categorias' : 'Add categories'}>
          <h3 className="text-[17px] font-bold">{pt ? 'Adicionar categorias' : 'Add categories'}</h3>
          <p className="-mt-1 text-[13px] text-[var(--rw-subtle)]">{pt ? `Temos mais ${catalogOff.length} categorias prontas. Ligue as que fazem sentido para você.` : `We have ${catalogOff.length} more ready-made categories. Turn on the ones that fit you.`}</p>
          <button type="button" onClick={() => setShowCatalog((v) => !v)} aria-expanded={showCatalog} className="h-11 rounded-[14px] bg-[var(--rw-raised)] text-sm font-bold">
            {showCatalog ? (pt ? 'Esconder lista' : 'Hide list') : (pt ? 'Ver categorias prontas' : 'See ready-made categories')}
          </button>
          {showCatalog && (
            <div className="flex flex-col divide-y divide-[var(--rw-border)]">
              {catalogOff.map((c) => (
                <button key={c.pt} type="button" onClick={() => toggleCategory('expense', c[pt ? 'pt' : 'en'])} className="flex items-center gap-3 py-3 text-left">
                  <span className="flex-1"><span className="block text-[15px] font-semibold">{c[pt ? 'pt' : 'en']}</span><span className="block text-[13px] text-[var(--rw-subtle)]">{c.hint}</span></span>
                  <span className="rounded-full bg-[var(--rw-brand-soft)] px-3 py-1.5 text-xs font-bold text-[var(--rw-brand-ink)]">{pt ? 'Ligar' : 'Add'}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 border-t border-[var(--rw-border)] pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--rw-muted)]">{pt ? 'Criar a minha' : 'Create my own'}</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={pt ? 'Nome da categoria' : 'Category name'} aria-label={pt ? 'Nome da categoria' : 'Category name'}
              className="h-[52px] rounded-[14px] border border-[var(--rw-border)] bg-[var(--rw-raised)] px-3.5 text-[15px] outline-none" />
            <GroupPicker value={newGroup} onPick={setNewGroup} label={pt ? 'Grupo da nova categoria' : 'Group of the new category'} />
            <button type="button" onClick={add} disabled={!newName.trim()} className="h-12 rounded-[14px] bg-[var(--rw-brand)] text-[15px] font-bold text-white disabled:opacity-50">{pt ? 'Adicionar' : 'Add'}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
