// src/pages/planner/carteira/AnalysePanel.jsx
import { useState } from 'react';
import GoalPriorityModal from './GoalPriorityModal';

const TYPE_BADGE = {
  allocation:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  instrument:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  sublayer:    'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
};

export default function AnalysePanel({ layers, poupancaValue, onApplySuggestions, readOnly }) {
  const [showModal, setShowModal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [accepted, setAccepted] = useState(new Set());
  const [rejected, setRejected] = useState(new Set());

  const handleSuggestions = (list) => {
    setSuggestions(list);
    setAccepted(new Set());
    setRejected(new Set());
  };

  const toggle = (i, type) => {
    if (type === 'accept') {
      setAccepted(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
      setRejected(prev => { const s = new Set(prev); s.delete(i); return s; });
    } else {
      setRejected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
      setAccepted(prev => { const s = new Set(prev); s.delete(i); return s; });
    }
  };

  const handleSave = () => {
    const toApply = suggestions.filter((_, i) => accepted.has(i));
    onApplySuggestions(toApply);
    setSuggestions([]);
    setAccepted(new Set());
    setRejected(new Set());
  };

  const pending = suggestions.filter((_, i) => !accepted.has(i) && !rejected.has(i)).length;

  return (
    <div className="space-y-3">
      {/* CTA button */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">✨ Analisar Carteira</p>
          <p className="text-xs text-indigo-200 mt-0.5">IA analisa seus objetivos e sugere rebalanceamento completo</p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowModal(true)}
            className="shrink-0 bg-white/20 hover:bg-white/30 text-white rounded-xl px-3 py-2 text-xs font-bold transition-colors"
          >
            Analisar →
          </button>
        )}
      </div>

      {/* Suggestions panel */}
      {suggestions.length > 0 && (
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
              {accepted.size} aceitas · {rejected.size} rejeitadas · {pending} pendentes
            </p>
            <button onClick={() => { setSuggestions([]); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕ Limpar</button>
          </div>

          {suggestions.map((s, i) => {
            const isAccepted = accepted.has(i);
            const isRejected = rejected.has(i);
            return (
              <div key={i} className={`bg-[var(--rw-surface)] rounded-xl p-3 border transition-all ${isAccepted ? 'border-emerald-300 dark:border-emerald-700' : isRejected ? 'border-[var(--rw-border)] opacity-50' : 'border-[var(--rw-border)]'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${TYPE_BADGE[s.type] ?? TYPE_BADGE.allocation}`}>
                        {s.type === 'allocation' ? 'Alocação' : s.type === 'instrument' ? 'Instrumento' : 'Produto'}
                      </span>
                      <span className="text-xs font-bold text-[var(--rw-ink)]">{s.title}</span>
                    </div>
                    <p className="text-xs text-[var(--rw-muted)]">{s.reason}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 mt-0.5">
                    <button
                      onClick={() => toggle(i, 'accept')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${isAccepted ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'}`}
                    >✓</button>
                    <button
                      onClick={() => toggle(i, 'reject')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${isRejected ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40'}`}
                    >✕</button>
                  </div>
                </div>
              </div>
            );
          })}

          {accepted.size > 0 && (
            <button
              onClick={handleSave}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-xs font-bold transition-colors"
            >
              Salvar {accepted.size} mudança{accepted.size > 1 ? 's' : ''} aceita{accepted.size > 1 ? 's' : ''} →
            </button>
          )}
        </div>
      )}

      {showModal && (
        <GoalPriorityModal
          layers={layers}
          poupancaValue={poupancaValue}
          onSuggestions={handleSuggestions}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
