import { useState } from 'react';
import { NumericFormat } from 'react-number-format';
import { formatBRL } from './usePlannerState';
import { computeDeductionTotal } from './rendaCalc.js';
import { useFeature } from '@/contexts/ClientConfigContext';

function SummaryRow({ label, value, highlight, negative }) {
  return (
    <div className={`flex justify-between items-center py-2 ${highlight ? 'border-t-2 border-violet-500 mt-2 pt-3' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${
        highlight
          ? 'text-violet-600 dark:text-violet-400 text-base'
          : negative
            ? 'text-red-500 dark:text-red-400'
            : 'text-gray-900 dark:text-white'
      }`}>
        {negative ? '- ' : ''}{formatBRL.format(value)}
      </span>
    </div>
  );
}

const EMPTY_DEDUCTION = { label: '', type: 'value', amount: 0 };

export default function RendaTab({ state, update, liquidezFinal }) {
  const hasSalaryBreakdown = useFeature('salaryBreakdown');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const deductions = state.salarioDeductions ?? [];
  const deductionTotal = computeDeductionTotal(state.salarioBruto, deductions);

  function startAdd() {
    const id = `custom-${Date.now()}`;
    setDraft({ id, ...EMPTY_DEDUCTION });
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
    update('salarioDeductions', next);
    setEditingId(null);
    setDraft(null);
  }

  function removeDeduction(id) {
    update('salarioDeductions', deductions.filter(d => d.id !== id));
  }

  /* When salaryBreakdown is off, show a single net salary input (CLT mode). */
  if (!hasSalaryBreakdown) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Salário Líquido
          </h3>
          <NumericFormat
            value={state.salarioBruto}
            onValueChange={vals => update('salarioBruto', vals.floatValue ?? 0)}
            prefix="R$ "
            decimalSeparator=","
            thousandSeparator="."
            decimalScale={2}
            allowNegative={false}
            className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-lg font-semibold"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Este valor será usado como base de alocação no planejador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Salário Bruto */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Salário / Renda Bruta
        </h3>
        <NumericFormat
          value={state.salarioBruto}
          onValueChange={vals => update('salarioBruto', vals.floatValue ?? 0)}
          prefix="R$ "
          decimalSeparator=","
          thousandSeparator="."
          decimalScale={2}
          allowNegative={false}
          className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-lg font-semibold"
        />
      </div>

      {/* Deductions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Deduções
          </h3>
          <button
            onClick={startAdd}
            className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
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
                  salarioBruto={state.salarioBruto}
                />
              ) : (
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate block">{d.label || '—'}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {d.type === 'pct' ? `${d.amount}%` : formatBRL.format(d.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    <span className="text-sm font-medium tabular-nums text-red-500 dark:text-red-400">
                      - {formatBRL.format(
                        d.type === 'pct'
                          ? state.salarioBruto * d.amount / 100
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
              salarioBruto={state.salarioBruto}
            />
          )}

          {deductions.length === 0 && !editingId && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
              Nenhuma dedução cadastrada.
            </p>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Resumo
        </h3>
        <SummaryRow label="Renda Bruta" value={state.salarioBruto} />
        <SummaryRow label="Total de Deduções" value={deductionTotal} negative />
        <SummaryRow label="Renda Líquida" value={liquidezFinal} highlight />
      </div>
    </div>
  );
}

function DeductionEditRow({ draft, setDraft, onSave, onCancel, salarioBruto }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/60 rounded-xl p-3 space-y-2">
      <input
        type="text"
        placeholder="Nome da dedução"
        value={draft.label}
        onChange={e => setDraft(prev => ({ ...prev, label: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
      <div className="flex gap-2">
        <select
          value={draft.type}
          onChange={e => setDraft(prev => ({ ...prev, type: e.target.value }))}
          className="flex-shrink-0 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="value">R$ fixo</option>
          <option value="pct">% do bruto</option>
        </select>
        <NumericFormat
          value={draft.amount}
          onValueChange={vals => setDraft(prev => ({ ...prev, amount: vals.floatValue ?? 0 }))}
          decimalSeparator=","
          thousandSeparator={draft.type === 'value' ? '.' : ''}
          decimalScale={draft.type === 'pct' ? 2 : 2}
          suffix={draft.type === 'pct' ? ' %' : ''}
          prefix={draft.type === 'value' ? 'R$ ' : ''}
          allowNegative={false}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
      {draft.type === 'pct' && draft.amount > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          = {formatBRL.format(salarioBruto * draft.amount / 100)} / mês
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={!draft.label.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
