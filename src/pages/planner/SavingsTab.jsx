import { NumericFormat } from 'react-number-format';
import { formatBRL } from './usePlannerState';

function AmountCell({ value, onChange, highlight }) {
  return (
    <NumericFormat
      value={value === 0 ? '' : value}
      onValueChange={vals => onChange(vals.floatValue ?? 0)}
      thousandSeparator="."
      decimalSeparator=","
      prefix="R$ "
      decimalScale={2}
      allowNegative={false}
      placeholder="R$ 0,00"
      className={`w-full px-2 py-1 rounded-lg border text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-violet-500
        ${highlight === 'casa'
          ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 font-bold'
          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'
        }`}
    />
  );
}

function TextCell({ value, onChange, className = '' }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 ${className}`}
    />
  );
}

export default function SavingsTab({ state, update, savingsComputed, poupancaValue }) {
  const { poupancaPhase1, poupancaPhase2, livresPhase1, livresPhase2 } = savingsComputed;
  const { savingsRows, carInitialBoleto } = state;

  const updateRow = (id, field, value) => {
    update('savingsRows', savingsRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    update('savingsRows', [
      ...savingsRows,
      { id: `custom_${Date.now()}`, label: 'Nova reserva', phase1: 0, phase2: 0, tipo: '', onde: '', returnPct: 1.0 },
    ]);
  };

  const removeRow = (id) => {
    update('savingsRows', savingsRows.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="bg-violet-900 dark:bg-violet-950 rounded-2xl p-4 text-white">
        <h2 className="text-base font-bold mb-1">
          POUPANÇA &amp; RESERVAS — FASE 1 vs FASE 2
        </h2>
        <p className="text-sm text-violet-200 leading-relaxed">
          <span className="text-amber-300 font-semibold">FASE 1:</span> antecipação carro = {formatBRL.format(carInitialBoleto)}/mês → carro quitado.{' '}
          <span className="text-emerald-300 font-semibold">FASE 2:</span> parcela do carro ({formatBRL.format(state.carMonthlyPayment)}) migra 100% para poupança.
          Aposentadoria começa desde o início — nunca pausar.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700 dark:bg-slate-800 text-white">
                <th className="px-4 py-3 text-left font-semibold">Destino</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">FASE 1 — Mês 1</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">FASE 2 — Mês 19+</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap hidden sm:table-cell">Retorno/mês</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Onde Guardar</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {/* Carro (auto-computed, read-only) */}
              <tr className="border-t border-gray-100 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/10">
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    Amortização Extra Carro (boleto)
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-bold text-red-600 dark:text-red-400">
                  {formatBRL.format(carInitialBoleto)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-400 dark:text-gray-500">
                  —
                </td>
                <td className="px-4 py-2.5 text-right text-gray-400 dark:text-gray-500 text-xs hidden sm:table-cell">
                  —
                </td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 italic text-xs hidden md:table-cell">
                  Sobe ao longo do tempo — ver Carro
                </td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 italic text-xs hidden lg:table-cell">
                  Bradesco — app Antecipar Parcelas
                </td>
                <td className="px-4 py-2.5" />
              </tr>

              {/* User-configured rows */}
              {savingsRows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-t border-gray-100 dark:border-gray-700 ${
                    row.id === 'casa'
                      ? 'bg-yellow-50/60 dark:bg-yellow-900/10'
                      : i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/20'
                  }`}
                >
                  <td className="px-3 py-2">
                    <TextCell
                      value={row.label}
                      onChange={v => updateRow(row.id, 'label', v)}
                    />
                  </td>
                  <td className="px-3 py-2 w-36">
                    <AmountCell
                      value={row.phase1}
                      onChange={v => updateRow(row.id, 'phase1', v)}
                      highlight={row.id === 'casa' ? 'casa' : null}
                    />
                  </td>
                  <td className="px-3 py-2 w-36">
                    <AmountCell
                      value={row.phase2}
                      onChange={v => updateRow(row.id, 'phase2', v)}
                      highlight={row.id === 'casa' ? 'casa' : null}
                    />
                  </td>
                  <td className="px-3 py-2 w-28 hidden sm:table-cell">
                    <NumericFormat
                      value={row.returnPct ?? 1.0}
                      onValueChange={vals => updateRow(row.id, 'returnPct', vals.floatValue ?? 0)}
                      decimalSeparator=","
                      decimalScale={2}
                      suffix=" %/mês"
                      allowNegative={false}
                      className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <TextCell
                      value={row.tipo}
                      onChange={v => updateRow(row.id, 'tipo', v)}
                      className="text-gray-500 dark:text-gray-400 italic"
                    />
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    <TextCell
                      value={row.onde}
                      onChange={v => updateRow(row.id, 'onde', v)}
                      className="text-gray-500 dark:text-gray-400 italic"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-red-300 hover:text-red-500 text-xs"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}

              {/* Investimentos Livres (computed remainder) */}
              <tr className="border-t border-gray-100 dark:border-gray-700 bg-emerald-50/60 dark:bg-emerald-900/10">
                <td className="px-4 py-2.5 font-bold text-emerald-700 dark:text-emerald-400">
                  Investimentos Livres
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${
                  livresPhase1 < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {formatBRL.format(livresPhase1)}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${
                  livresPhase2 < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {formatBRL.format(livresPhase2)}
                </td>
                <td className="px-4 py-2.5 text-gray-400 italic text-xs hidden sm:table-cell" />
                <td className="px-4 py-2.5 text-gray-400 italic text-xs hidden md:table-cell">Restante</td>
                <td className="px-4 py-2.5 text-gray-400 italic text-xs hidden lg:table-cell">Ver Investimentos</td>
                <td />
              </tr>

              {/* Total */}
              <tr className="border-t-2 border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50">
                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                  TOTAL POUPANÇA ({state.poupanca}%)
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900 dark:text-white">
                  {formatBRL.format(poupancaPhase1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900 dark:text-white">
                  {formatBRL.format(poupancaPhase2)}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell" />
                <td className="px-4 py-3 text-xs text-gray-500 italic hidden md:table-cell">
                  Fase 1 ≈ {state.poupanca}% do disponível
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 italic hidden lg:table-cell">
                  Fase 2 ≈ {state.poupanca}% + parcela do carro
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Add row button */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={addRow}
            className="text-sm text-violet-600 dark:text-violet-400 hover:underline font-medium"
          >
            + Adicionar linha
          </button>
        </div>
      </div>

      {/* Phase summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-800">
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-2">Fase 1 — durante quitação do carro</p>
          <p className="text-xl font-bold text-amber-800 dark:text-amber-300 tabular-nums">{formatBRL.format(poupancaPhase1)}/mês</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
            Inclui boleto {formatBRL.format(carInitialBoleto)} no mês 1
          </p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800">
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-2">Fase 2 — carro quitado</p>
          <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">{formatBRL.format(poupancaPhase2)}/mês</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
            +{formatBRL.format(state.carMonthlyPayment)} da parcela liberada
          </p>
        </div>
      </div>
    </div>
  );
}
