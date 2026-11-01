// src/pages/planner/carteira/GoalPriorityModal.jsx
import { useState, useRef } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { formatBRL } from './constants';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export default function GoalPriorityModal({ layers, poupancaValue, onSuggestions, onClose }) {
  const { geminiApiKey } = useSettings();
  const [orderedSublayers, setOrderedSublayers] = useState(() =>
    layers.flatMap(l => (l.sublayers ?? []).map(s => ({ ...s, layerLabel: l.label })))
  );
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dragIdx = useRef(null);

  const handleDragStart = (i) => { dragIdx.current = i; };
  const handleDragOver = (e, i) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const newOrder = [...orderedSublayers];
    const [moved] = newOrder.splice(dragIdx.current, 1);
    newOrder.splice(i, 0, moved);
    dragIdx.current = i;
    setOrderedSublayers(newOrder);
  };
  const handleDrop = () => { dragIdx.current = null; };

  const handleAnalyse = async () => {
    if (!geminiApiKey) { setError('Chave Gemini não configurada em Configurações.'); return; }
    setLoading(true); setError('');
    const priorityList = orderedSublayers.map((s, i) => `${i + 1}. [${s.layerLabel}] ${s.label} — meta: R$ ${s.goalTarget ?? 0}`).join('\n');
    const layerSummary = layers.map(l => `- ${l.label} (${l.pct}% = ${formatBRL.format(poupancaValue * l.pct / 100)}/mês, ${(l.sublayers ?? []).length} sublayers)`).join('\n');
    const prompt = `Você é um consultor financeiro brasileiro especializado em planejamento PJ 2026.
Analise esta carteira de investimentos e retorne SOMENTE JSON válido, sem markdown.

DISPONÍVEL P/ INVESTIR: ${formatBRL.format(poupancaValue)}/mês

CAMADAS ATUAIS:
${layerSummary}

PRIORIDADE DE OBJETIVOS (do usuário):
${priorityList}

${context ? `CONTEXTO ADICIONAL: ${context}` : ''}

Retorne sugestões de melhoria como array. Cada sugestão deve ser acionável.
Schema: {
  "suggestions": [
    {
      "type": "allocation" | "instrument" | "sublayer",
      "title": "título curto da sugestão",
      "reason": "justificativa em 1-2 frases",
      "patch": {
        "layerId": "id da camada afetada (se aplicável)",
        "sublayerId": "id do sublayer afetado (se aplicável)",
        "newPct": 0,
        "instruments": []
      }
    }
  ]
}`;
    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${geminiApiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 2000 } }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Erro HTTP ${res.status}`); }
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      onSuggestions(parsed.suggestions ?? []);
      onClose();
    } catch (e) { setError(e.message || 'Erro desconhecido'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[var(--rw-surface)] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 my-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--rw-ink)]">✨ Analisar Carteira</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg">✕</button>
        </div>
        <p className="text-xs text-[var(--rw-muted)]">Ordene seus objetivos por prioridade. A IA vai balancear sua carteira respeitando essa ordem.</p>

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Arraste para reordenar</p>
          <div className="space-y-2">
            {orderedSublayers.map((sub, i) => (
              <div
                key={sub.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={handleDrop}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--rw-border)] bg-[var(--rw-raised)] cursor-grab active:cursor-grabbing select-none"
              >
                <span className="text-gray-300 dark:text-gray-500 text-sm">⠿</span>
                <span className="text-base">{sub.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--rw-ink)] truncate">{sub.label}</p>
                  <p className="text-xs text-gray-400">{sub.layerLabel}{sub.goalTarget > 0 ? ` · meta ${formatBRL.format(sub.goalTarget)}` : ''}</p>
                </div>
                <span className="text-xs font-bold text-gray-300 dark:text-gray-500 bg-[var(--rw-raised)] border border-gray-200 dark:border-gray-500 rounded-md px-2 py-0.5">#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-[var(--rw-muted)] block mb-1">Contexto adicional <span className="font-normal">(opcional)</span></label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Ex: estou pensando em trocar de carro em 2027..."
            className="w-full border border-[var(--rw-border)] rounded-xl px-3 py-2 text-xs bg-[var(--rw-raised)] text-[var(--rw-ink)] focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none h-16"
          />
        </div>

        {error && <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2">{error}</p>}

        <button
          onClick={handleAnalyse}
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-bold transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Gerando análise...</>
          ) : 'Gerar análise com IA →'}
        </button>
      </div>
    </div>
  );
}
