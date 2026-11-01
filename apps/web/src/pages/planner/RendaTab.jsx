import { useState } from 'react';
import { NumericFormat } from 'react-number-format';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { formatBRL } from './usePlannerState';
import { computeDeductionTotal, computeBenefitsTotal } from './rendaCalc.js';
import { useFeature } from '@/contexts/ClientConfigContext';

function SummaryRow({ label, value, highlight, negative }) {
  return (
    <div className={`flex justify-between items-center py-2 ${highlight ? 'border-t-2 border-violet-500 mt-2 pt-3' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-bold text-[var(--rw-ink)]' : 'text-[var(--rw-muted)]'}`}>
        {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${
        highlight
          ? 'text-violet-600 dark:text-violet-400 text-base'
          : negative
            ? 'text-red-500 dark:text-red-400'
            : 'text-[var(--rw-ink)]'
      }`}>
        {negative ? '- ' : ''}{formatBRL.format(value)}
      </span>
    </div>
  );
}

const EMPTY_ENTRY = { label: '', type: 'value', amount: 0 };

export default function RendaTab({ state, update, liquidezFinal, activeVersion, updateSalarioBruto, updateSalarioDeductions, updateSalarioBenefits, copyFromPreviousMonth }) {
  const hasSalaryBreakdown = useFeature('salaryBreakdown');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [benefitEditingId, setBenefitEditingId] = useState(null);
  const [benefitDraft, setBenefitDraft] = useState(null);

  const salarioBruto = activeVersion?.salarioBruto ?? 0;
  const deductions = activeVersion?.salarioDeductions ?? [];
  const deductionTotal = computeDeductionTotal(salarioBruto, deductions);
  const benefits = activeVersion?.salarioBenefits ?? [];
  const benefitsTotal = computeBenefitsTotal(salarioBruto, benefits);

  function startAdd() {
    const id = `custom-${Date.now()}`;
    setDraft({ id, ...EMPTY_ENTRY });
    setEditingId(id);
  }

  function startEdit(d) {
    setDraft({ ...d });
    setEditingId(d.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEdit() {
    if (!draft) return;
    const exists = deductions.some(d => d.id === draft.id);
    const next = exists
      ? deductions.map(d => d.id === draft.id ? draft : d)
      : [...deductions, draft];
    updateSalarioDeductions(next);
    setEditingId(null);
    setDraft(null);
  }

  function removeDeduction(id) {
    updateSalarioDeductions(deductions.filter(d => d.id !== id));
  }

  function startAddBenefit() {
    const id = `custom-${Date.now()}`;
    setBenefitDraft({ id, ...EMPTY_ENTRY });
    setBenefitEditingId(id);
  }

  function startEditBenefit(b) {
    setBenefitDraft({ ...b });
    setBenefitEditingId(b.id);
  }

  function cancelEditBenefit() {
    setBenefitEditingId(null);
    setBenefitDraft(null);
  }

  function saveEditBenefit() {
    if (!benefitDraft) return;
    const exists = benefits.some(b => b.id === benefitDraft.id);
    const next = exists
      ? benefits.map(b => b.id === benefitDraft.id ? benefitDraft : b)
      : [...benefits, benefitDraft];
    updateSalarioBenefits(next);
    setBenefitEditingId(null);
    setBenefitDraft(null);
  }

  function removeBenefit(id) {
    updateSalarioBenefits(benefits.filter(b => b.id !== id));
  }

  /* When salaryBreakdown is off, show a single net salary input (CLT mode). */
  if (!hasSalaryBreakdown) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={copyFromPreviousMonth}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--rw-surface)] text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-900/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors shadow-sm"
          >
            📥 Copiar do mês anterior
          </button>
        </div>
        <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
          <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide mb-3">
            Salário Líquido
          </h3>
          <CurrencyInput
            value={salarioBruto}
            onChange={v => updateSalarioBruto(v)}
            className="px-3 py-3 text-lg font-bold"
          />
          <p className="text-xs text-[var(--rw-subtle)] mt-2">
            Este valor será usado como base de alocação no planejador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (window.confirm('Deseja copiar o salário e as deduções do mês anterior para este mês? Isso substituirá os valores atuais.')) {
              copyFromPreviousMonth();
            }
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--rw-surface)] text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-900/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors shadow-sm"
        >
          📥 Copiar do mês anterior
        </button>
      </div>

      {/* Salário Bruto */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide mb-3">
          Salário / Renda Bruta
        </h3>
        <CurrencyInput
          value={salarioBruto}
          onChange={v => updateSalarioBruto(v)}
          className="px-3 py-3 text-lg font-bold"
        />
      </div>

      {/* Deductions */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)] overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide">
            Deduções
          </h3>
          <button
            onClick={startAdd}
            className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
          >
            + Adicionar
          </button>
        </div>

        <div className="space-y-2">
          {deductions.map(d => (
            <div key={d.id}>
              {editingId === d.id ? (
                <DeductionEditRow
                  draft={draft}
                  setDraft={setDraft}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                  salarioBruto={salarioBruto}
                />
              ) : (
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--rw-ink)] truncate block">{d.label || '—'}</span>
                    <span className="text-xs text-[var(--rw-subtle)]">
                      {d.type === 'pct' ? `${d.amount}%` : formatBRL.format(d.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    <span className="text-sm font-medium tabular-nums text-red-500 dark:text-red-400">
                      - {formatBRL.format(
                        d.type === 'pct'
                          ? salarioBruto * d.amount / 100
                          : d.amount
                      )}
                    </span>
                    <button
                      onClick={() => startEdit(d)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      aria-label="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => removeDeduction(d.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                      aria-label="Remover"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Inline form for new deduction */}
          {editingId && !deductions.some(d => d.id === editingId) && (
            <DeductionEditRow
              draft={draft}
              setDraft={setDraft}
              onSave={saveEdit}
              onCancel={cancelEdit}
              salarioBruto={salarioBruto}
            />
          )}

          {deductions.length === 0 && !editingId && (
            <p className="text-sm text-[var(--rw-subtle)] text-center py-2">
              Nenhuma dedução cadastrada.
            </p>
          )}
        </div>
      </div>

      {/* Benefits */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)] overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide">
            Benefícios
          </h3>
          <button
            onClick={startAddBenefit}
            className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
          >
            + Adicionar
          </button>
        </div>
        <p className="text-xs text-[var(--rw-subtle)] mb-3">
          Valores adicionados após o salário líquido, sem incidência de descontos (ex.: vale-refeição, vale-transporte).
        </p>

        <div className="space-y-2">
          {benefits.map(b => (
            <div key={b.id}>
              {benefitEditingId === b.id ? (
                <DeductionEditRow
                  draft={benefitDraft}
                  setDraft={setBenefitDraft}
                  onSave={saveEditBenefit}
                  onCancel={cancelEditBenefit}
                  salarioBruto={salarioBruto}
                />
              ) : (
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--rw-ink)] truncate block">{b.label || '—'}</span>
                    <span className="text-xs text-[var(--rw-subtle)]">
                      {b.type === 'pct' ? `${b.amount}%` : formatBRL.format(b.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    <span className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      + {formatBRL.format(
                        b.type === 'pct'
                          ? salarioBruto * b.amount / 100
                          : b.amount
                      )}
                    </span>
                    <button
                      onClick={() => startEditBenefit(b)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      aria-label="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => removeBenefit(b.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                      aria-label="Remover"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {benefitEditingId && !benefits.some(b => b.id === benefitEditingId) && (
            <DeductionEditRow
              draft={benefitDraft}
              setDraft={setBenefitDraft}
              onSave={saveEditBenefit}
              onCancel={cancelEditBenefit}
              salarioBruto={salarioBruto}
            />
          )}

          {benefits.length === 0 && !benefitEditingId && (
            <p className="text-sm text-[var(--rw-subtle)] text-center py-2">
              Nenhum benefício cadastrado.
            </p>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide mb-1">
          Resumo
        </h3>
        <SummaryRow label="Renda Bruta" value={salarioBruto} />
        <SummaryRow label="Total de Deduções" value={deductionTotal} negative />
        <SummaryRow label="Total de Benefícios" value={benefitsTotal} />
        <SummaryRow label="Renda Líquida" value={liquidezFinal} highlight />
      </div>
    </div>
  );
}

function DeductionEditRow({ draft, setDraft, onSave, onCancel, salarioBruto }) {
  return (
    <div className="bg-[var(--rw-raised)]/60 rounded-xl p-3 space-y-2">
      <input
        type="text"
        placeholder="Nome da dedução"
        value={draft.label}
        onChange={e => setDraft(prev => ({ ...prev, label: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg border border-[var(--rw-border)] bg-[var(--rw-raised)] text-[var(--rw-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
      <div className="flex gap-2 overflow-hidden">
        <select
          value={draft.type}
          onChange={e => setDraft(prev => ({ ...prev, type: e.target.value }))}
          className="flex-shrink-0 px-2 py-2 rounded-lg border border-[var(--rw-border)] bg-[var(--rw-raised)] text-[var(--rw-ink)] focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="value">R$ fixo</option>
          <option value="pct">% do bruto</option>
        </select>
        <NumericFormat
          value={draft.amount}
          onValueChange={vals => setDraft(prev => ({ ...prev, amount: vals.floatValue ?? 0 }))}
          decimalSeparator=","
          thousandSeparator={draft.type === 'value' ? '.' : ''}
          decimalScale={2}
          suffix={draft.type === 'pct' ? ' %' : ''}
          prefix={draft.type === 'value' ? 'R$ ' : ''}
          allowNegative={false}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[var(--rw-border)] bg-[var(--rw-raised)] text-[var(--rw-ink)] focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
      {draft.type === 'pct' && draft.amount > 0 && (
        <p className="text-xs text-[var(--rw-subtle)]">
          = {formatBRL.format(salarioBruto * draft.amount / 100)} / mês
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--rw-muted)] hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={!draft.label.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
