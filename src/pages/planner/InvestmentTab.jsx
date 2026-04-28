import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { useSettings } from '@/contexts/SettingsContext';
import { formatBRL } from './usePlannerState';
import PercentInput from '@/components/ui/PercentInput';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ── Savings section sub-components ─────────────────────────────────────────

function AmountCell({ value, onChange, highlight }) {
  return (
    <CurrencyInput
      value={value}
      onChange={onChange}
      className={`px-2 py-1 text-sm text-right
        ${highlight === 'casa'
          ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 font-bold'
          : ''
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

// ── Investment section sub-components ──────────────────────────────────────

function ClassRow({ cls, index, onChange, onRemove }) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700">
      <td className="px-3 py-2">
        <input
          type="text"
          value={cls.name}
          onChange={e => onChange(index, 'name', e.target.value)}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </td>
      <td className="px-3 py-2 w-24">
        <PercentInput
          value={cls.pct}
          onChange={v => onChange(index, 'pct', v)}
          decimalScale={0}
          placeholder="0 %"
          className="w-full text-sm"
        />
      </td>
      <td className="px-3 py-2 w-32">
        <PercentInput
          value={cls.returnPct}
          onChange={v => onChange(index, 'returnPct', v)}
          decimalScale={2}
          placeholder="0,00 %"
          className="w-full text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={cls.vehicle}
          onChange={e => onChange(index, 'vehicle', e.target.value)}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function InvestmentTab({
  state,
  update,
  poupancaValue,
  savingsComputed,
  savingsRowsFV,
  isPhase2ForSelectedMonth,
  selectedMonthOffset,
  livresPhase2,
  investmentProjections,
  liquidezFinal,
}) {
  const { geminiApiKey } = useSettings();
  const [geminiSuggestion, setGeminiSuggestion] = useState(null);
  const [geminiRawFallback, setGeminiRawFallback] = useState('');
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState('');

  const { poupancaPhase1, poupancaPhase2, livresPhase1 } = savingsComputed;
  const { savingsRows, carInitialBoleto, carMonthlyPayment } = state;

  const totalPct = state.investmentClasses.reduce((a, c) => a + c.pct, 0);
  const pctValid = totalPct === 100;

  // ── Savings row handlers ────────────────────────────────────────────────
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

  // ── Investment class handlers ───────────────────────────────────────────
  const handleClassChange = (index, field, value) => {
    const updated = state.investmentClasses.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    );
    update('investmentClasses', updated);
  };

  const handleAddClass = () => {
    update('investmentClasses', [
      ...state.investmentClasses,
      { name: 'Nova classe', pct: 0, returnPct: 0.8, vehicle: '' },
    ]);
  };

  const handleRemoveClass = (index) => {
    update('investmentClasses', state.investmentClasses.filter((_, i) => i !== index));
  };

  // ── Gemini AI handlers ─────────────────────────────────────────────────
  const handleGeminiAnalysis = async () => {
    if (!geminiApiKey) return;
    setGeminiLoading(true);
    setGeminiError('');
    setGeminiSuggestion(null);
    setGeminiRawFallback('');

    const prompt = `Você é um consultor financeiro brasileiro. Analise a carteira e retorne SOMENTE JSON válido sem markdown.

CONTEXTO:
- Liquidez mensal: ${formatBRL.format(liquidezFinal)}
- Investimentos livres (Fase 2): ${formatBRL.format(livresPhase2)}/mês
- Fase atual: ${isPhase2ForSelectedMonth ? 'Fase 2 (carro quitado)' : 'Fase 1'}

CARTEIRA ATUAL:
${JSON.stringify(state.investmentClasses)}

Retorne este schema exato:
{
  "analysis": "avaliação em 2-3 frases",
  "risks": ["risco 1", "risco 2"],
  "suggestions": [
    { "name": "...", "currentPct": 25, "suggestedPct": 30, "returnPct": 1.0, "vehicle": "...", "reason": "..." }
  ],
  "summary": "conclusão"
}

suggestions deve incluir TODAS as classes. suggestedPct deve somar 100.`;

    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!raw) throw new Error('Resposta vazia do Gemini');

      const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      try {
        setGeminiSuggestion(JSON.parse(cleaned));
      } catch {
        setGeminiRawFallback(raw);
      }
    } catch (e) {
      setGeminiError(e.message || 'Erro desconhecido');
    } finally {
      setGeminiLoading(false);
    }
  };

  const handleAcceptSuggestion = () => {
    const newClasses = geminiSuggestion.suggestions.map(s => {
      const existing = state.investmentClasses.find(c => c.name === s.name);
      return {
        name: s.name,
        pct: s.suggestedPct,
        returnPct: s.returnPct ?? existing?.returnPct ?? 0.8,
        vehicle: s.vehicle ?? existing?.vehicle ?? '',
      };
    });
    update('investmentClasses', newClasses);
    setGeminiSuggestion(null);
  };

  if (liquidezFinal <= 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          Preencha o Dashboard Financeiro para ver as projeções de investimento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── SECTION 1: RESERVAS ─────────────────────────────────────────── */}
      <div className="bg-violet-900 dark:bg-violet-950 rounded-2xl p-4 text-white">
        <h2 className="text-base font-bold mb-1">
          POUPANÇA &amp; RESERVAS — FASE 1 vs FASE 2
        </h2>
        <p className="text-sm text-violet-200 leading-relaxed">
          <span className="text-amber-300 font-bold">FASE 1:</span> antecipação carro = {formatBRL.format(carInitialBoleto)}/mês → carro quitado.{' '}
          <span className="text-emerald-300 font-bold">FASE 2:</span> parcela do carro ({formatBRL.format(carMonthlyPayment)}) migra 100% para poupança.
          Aposentadoria começa desde o início — nunca pausar.
        </p>
      </div>

      {/* Phase banner */}
      <div className={`rounded-xl p-3 border text-xs font-bold ${
        isPhase2ForSelectedMonth
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-400'
      }`}>
        Mês {selectedMonthOffset} do plano —{' '}
        {isPhase2ForSelectedMonth ? 'FASE 2 ativa' : 'FASE 1 ativa'}
        {' '}— Coluna em destaque abaixo
      </div>

      {/* Reserves table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700 dark:bg-slate-800 text-white">
                <th className="px-4 py-3 text-left font-bold">Destino</th>
                <th className={`px-4 py-3 text-right font-bold whitespace-nowrap ${!isPhase2ForSelectedMonth ? 'ring-2 ring-inset ring-amber-400' : 'opacity-60'}`}>
                  FASE 1
                </th>
                <th className={`px-4 py-3 text-right font-bold whitespace-nowrap ${isPhase2ForSelectedMonth ? 'ring-2 ring-inset ring-emerald-400' : 'opacity-60'}`}>
                  FASE 2
                </th>
                <th className="px-4 py-3 text-right font-bold whitespace-nowrap hidden sm:table-cell">Retorno/mês</th>
                <th className="px-4 py-3 text-left font-bold hidden md:table-cell">Tipo</th>
                <th className="px-4 py-3 text-left font-bold hidden lg:table-cell">Onde Guardar</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {/* Carro (auto-computed, read-only) */}
              <tr className="border-t border-gray-100 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/10">
                <td className="px-4 py-2.5">
                  <span className="font-bold text-red-600 dark:text-red-400">
                    Amortização Extra Carro (boleto)
                  </span>
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-bold text-red-600 dark:text-red-400 ${!isPhase2ForSelectedMonth ? '' : 'opacity-40'}`}>
                  {formatBRL.format(carInitialBoleto)}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums text-gray-400 dark:text-gray-500 ${isPhase2ForSelectedMonth ? '' : 'opacity-40'}`}>
                  —
                </td>
                <td className="px-4 py-2.5 text-right text-gray-400 dark:text-gray-500 text-xs hidden sm:table-cell">—</td>
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
                    <TextCell value={row.label} onChange={v => updateRow(row.id, 'label', v)} />
                  </td>
                  <td className={`px-3 py-2 w-36 ${!isPhase2ForSelectedMonth ? '' : 'opacity-50'}`}>
                    <AmountCell
                      value={row.phase1}
                      onChange={v => updateRow(row.id, 'phase1', v)}
                      highlight={row.id === 'casa' ? 'casa' : null}
                    />
                  </td>
                  <td className={`px-3 py-2 w-36 ${isPhase2ForSelectedMonth ? '' : 'opacity-50'}`}>
                    <AmountCell
                      value={row.phase2}
                      onChange={v => updateRow(row.id, 'phase2', v)}
                      highlight={row.id === 'casa' ? 'casa' : null}
                    />
                  </td>
                  <td className="px-3 py-2 w-28 hidden sm:table-cell">
                    <PercentInput
                      value={row.returnPct ?? 1.0}
                      onChange={v => updateRow(row.id, 'returnPct', v)}
                      decimalScale={2}
                      placeholder="1,00 %"
                      className="w-full text-sm text-right"
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
                    <button onClick={() => removeRow(row.id)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
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
                } ${!isPhase2ForSelectedMonth ? '' : 'opacity-50'}`}>
                  {formatBRL.format(livresPhase1)}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${
                  (livresPhase2 ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                } ${isPhase2ForSelectedMonth ? '' : 'opacity-50'}`}>
                  {formatBRL.format(livresPhase2 ?? 0)}
                </td>
                <td className="px-4 py-2.5 text-gray-400 italic text-xs hidden sm:table-cell" />
                <td className="px-4 py-2.5 text-gray-400 italic text-xs hidden md:table-cell">Restante</td>
                <td className="px-4 py-2.5 text-gray-400 italic text-xs hidden lg:table-cell">Ver abaixo</td>
                <td />
              </tr>

              {/* Total */}
              <tr className="border-t-2 border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50">
                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                  TOTAL POUPANÇA ({state.poupanca}%)
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-bold text-gray-900 dark:text-white ${!isPhase2ForSelectedMonth ? '' : 'opacity-50'}`}>
                  {formatBRL.format(poupancaPhase1)}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-bold text-gray-900 dark:text-white ${isPhase2ForSelectedMonth ? '' : 'opacity-50'}`}>
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
          <button onClick={addRow} className="text-sm text-violet-600 dark:text-violet-400 hover:underline font-medium">
            + Adicionar linha
          </button>
        </div>
      </div>

      {/* Phase summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`rounded-2xl p-4 border ${
          !isPhase2ForSelectedMonth
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 ring-2 ring-amber-400'
            : 'bg-amber-50/40 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900'
        }`}>
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-2">Fase 1 — durante quitação do carro</p>
          <p className="text-xl font-bold text-amber-800 dark:text-amber-300 tabular-nums">{formatBRL.format(poupancaPhase1)}/mês</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
            Inclui boleto {formatBRL.format(carInitialBoleto)} no mês 1
          </p>
        </div>
        <div className={`rounded-2xl p-4 border ${
          isPhase2ForSelectedMonth
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 ring-2 ring-emerald-400'
            : 'bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900'
        }`}>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-2">Fase 2 — carro quitado</p>
          <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">{formatBRL.format(poupancaPhase2)}/mês</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
            +{formatBRL.format(carMonthlyPayment)} da parcela liberada
          </p>
        </div>
      </div>

      {/* ── SECTION 2: FREE INVESTMENT CLASSES ──────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Classes de Ativos — Investimentos Livres</h3>
            {pctValid ? (
              <Badge variant="default">✓ 100%</Badge>
            ) : (
              <Badge variant="destructive">Soma: {totalPct}%</Badge>
            )}
          </div>
          <button
            onClick={handleAddClass}
            className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium"
          >
            + Adicionar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400">Classe</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400">% Carteira</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400">Retorno</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400">Veículo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {state.investmentClasses.map((cls, i) => (
                <ClassRow
                  key={i}
                  cls={cls}
                  index={i}
                  onChange={handleClassChange}
                  onRemove={handleRemoveClass}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Projections */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Projeções de Patrimônio (Invest. Livres: {formatBRL.format(livresPhase2 ?? poupancaValue)}/mês)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {investmentProjections.map(p => (
            <div key={p.years} className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-3 border border-violet-100 dark:border-violet-800 text-center">
              <p className="text-xs font-bold text-violet-500 uppercase">{p.years} anos</p>
              <p className="text-base font-bold text-violet-700 dark:text-violet-300 tabular-nums">
                {formatBRL.format(p.FV)}
              </p>
              <p className="text-xs text-violet-400 mt-0.5">
                ~{p.annualEquivalent.toFixed(1)}% a.a.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 3: GEMINI AI WITH JSON DIFF ─────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">✨</span>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Análise com Gemini AI</h3>
        </div>

        {!geminiApiKey ? (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800">
            Configure sua API key do Gemini nas{' '}
            <a href="/settings" className="underline font-medium">Configurações</a>.
          </div>
        ) : (
          <>
            <button
              onClick={handleGeminiAnalysis}
              disabled={geminiLoading || !pctValid}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
            >
              {geminiLoading ? 'Analisando...' : 'Analisar com Gemini'}
            </button>
            {!pctValid && (
              <p className="text-xs text-red-500 mt-1">Ajuste a soma da carteira para 100% antes de analisar.</p>
            )}

            {geminiError && (
              <div className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-100 dark:border-red-800">
                Erro: {geminiError}
              </div>
            )}

            {/* JSON Diff UI */}
            {geminiSuggestion && (
              <div className="mt-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-violet-200 dark:border-violet-800">
                  <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase mb-1">Sugestão Gemini AI</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{geminiSuggestion.analysis}</p>
                </div>

                {geminiSuggestion.risks?.length > 0 && (
                  <div className="px-4 py-2 border-b border-violet-200 dark:border-violet-800">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Riscos identificados:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {geminiSuggestion.risks.map((r, i) => (
                        <span key={i} className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Diff table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-violet-100 dark:bg-violet-900/40">
                        <th className="px-4 py-2 text-left text-xs font-bold text-violet-700 dark:text-violet-300">Classe</th>
                        <th className="px-4 py-2 text-center text-xs font-bold text-violet-700 dark:text-violet-300">Atual</th>
                        <th className="px-4 py-2 text-center text-xs font-bold text-violet-700 dark:text-violet-300">Sugerido</th>
                        <th className="px-4 py-2 text-center text-xs font-bold text-violet-700 dark:text-violet-300">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {geminiSuggestion.suggestions.map((s, i) => {
                        const delta = s.suggestedPct - s.currentPct;
                        return (
                          <tr key={i} className="border-t border-violet-100 dark:border-violet-800">
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                              <div>{s.name}</div>
                              {s.reason && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.reason}</div>}
                            </td>
                            <td className="px-4 py-2 text-center tabular-nums text-gray-600 dark:text-gray-400">
                              {s.currentPct}%
                            </td>
                            <td className="px-4 py-2 text-center tabular-nums font-bold text-gray-700 dark:text-gray-300">
                              {s.suggestedPct}%
                            </td>
                            <td className={`px-4 py-2 text-center tabular-nums font-bold ${
                              delta > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                              delta < 0 ? 'text-red-500 dark:text-red-400' :
                              'text-gray-400'
                            }`}>
                              {delta > 0 ? `+${delta}% ▲` : delta < 0 ? `${delta}% ▼` : '0'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {geminiSuggestion.summary && (
                  <div className="px-4 py-3 border-t border-violet-200 dark:border-violet-800">
                    <p className="text-xs text-gray-600 dark:text-gray-400 italic">{geminiSuggestion.summary}</p>
                  </div>
                )}

                <div className="px-4 py-3 border-t border-violet-200 dark:border-violet-800 flex gap-3">
                  <button
                    onClick={handleAcceptSuggestion}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    Aplicar sugestão
                  </button>
                  <button
                    onClick={() => setGeminiSuggestion(null)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            {/* Raw fallback if JSON parse fails */}
            {geminiRawFallback && (
              <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Análise Gemini</p>
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {geminiRawFallback}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
