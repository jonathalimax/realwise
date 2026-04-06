// src/pages/planner/carteira/WalletLayerSection.jsx
import { useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { formatBRL, resolveLayerColors, INSTRUMENT_TYPE_COLORS } from './constants';
import { sublayerMonthlyAmount } from './walletVersion';
import WalletSublayerCard from './WalletSublayerCard';
import SublayerModal from './SublayerModal';
import LayerModal from './LayerModal';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export default function WalletLayerSection({
  layer,
  layerIndex,
  poupancaValue,
  investments,
  getCurrentValue,
  invLoading,
  taggedTransactions,
  readOnly,
  onUpdateLayer,
  onDeleteLayer,
}) {
  const { geminiApiKey } = useSettings();
  const colors = resolveLayerColors(layer.id, layer.colorKey, layerIndex);
  const layerMonthlyAmount = poupancaValue * ((layer.pct ?? 0) / 100);

  const [showEditLayer, setShowEditLayer] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingSublayer, setEditingSublayer] = useState(null); // null = closed, 'new' = new, object = editing
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  const handleSaveSublayer = (data) => {
    if (editingSublayer === 'new') {
      const newSub = { id: `sub-${Date.now()}`, ...data, instruments: [], manualBalance: 0 };
      onUpdateLayer({ ...layer, sublayers: [...(layer.sublayers ?? []), newSub] });
    } else {
      onUpdateLayer({ ...layer, sublayers: layer.sublayers.map(s => s.id === editingSublayer.id ? { ...s, ...data } : s) });
    }
    setEditingSublayer(null);
  };

  const handleDeleteSublayer = () => {
    onUpdateLayer({ ...layer, sublayers: layer.sublayers.filter(s => s.id !== editingSublayer.id) });
    setEditingSublayer(null);
  };

  const handleSaveLayer = (data) => {
    onUpdateLayer({ ...layer, ...data });
    setShowEditLayer(false);
  };

  const handleResearch = async () => {
    if (!geminiApiKey) return;
    setAiLoading(true); setAiError(''); setAiResult(null);
    const goals = (layer.sublayers ?? []).map(s =>
      `- id: "${s.id}" | label: "${s.label}" | meta: R$ ${s.goalTarget ?? 0} | aporte: ${formatBRL.format(sublayerMonthlyAmount(s, layerMonthlyAmount))}/mês`
    ).join('\n');
    const prompt = `Você é um consultor financeiro brasileiro especializado em investimentos PJ em 2026.
Analise a camada "${layer.label}" e retorne SOMENTE JSON válido, sem markdown.
CAMADA: ${layer.label} — ${layer.description ?? ''}
SUBLAYERS:\n${goals}
Regras: use instrumentos reais disponíveis em 2026 no Brasil. Alocação por sublayer deve somar 100%.
Schema: { "layerInsight": "análise em 1-2 frases", "goalRecommendations": [{ "goalId": "id", "goalLabel": "nome", "instruments": [{ "name": "...", "type": "Renda Fixa|FII|ETF|Ações|Cripto", "alloc": 0, "reason": "..." }] }] }`;
    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${geminiApiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1400 } }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Erro HTTP ${res.status}`); }
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      setAiResult(JSON.parse(cleaned));
    } catch (e) { setAiError(e.message || 'Erro desconhecido'); }
    finally { setAiLoading(false); }
  };

  const handleApplyGoal = (goalId, instruments) => {
    onUpdateLayer({ ...layer, sublayers: layer.sublayers.map(s => s.id === goalId ? { ...s, instruments } : s) });
    setAiResult(prev => prev ? { ...prev, goalRecommendations: prev.goalRecommendations.filter(g => g.goalId !== goalId) } : null);
  };

  return (
    <div className="space-y-3">
      {/* Layer header */}
      <div className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border ${colors.header}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base shrink-0">{layer.icon}</span>
          <div className="min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wide ${colors.title}`}>{layer.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {layer.description ?? ''} · {formatBRL.format(layerMonthlyAmount)}/mês
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {geminiApiKey && (
            <button onClick={handleResearch} disabled={aiLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {aiLoading ? '...' : '✨'}
            </button>
          )}
          {!readOnly && (
            <>
              <button onClick={() => setShowEditLayer(true)}
                className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">✏️</button>
              <button onClick={() => setConfirmDelete(true)}
                className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">🗑</button>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-rose-700 dark:text-rose-300">Excluir camada <strong>{layer.label}</strong> e todos os seus sublayers?</p>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { onDeleteLayer(); setConfirmDelete(false); }}
              className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold">Confirmar</button>
            <button onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs">Cancelar</button>
          </div>
        </div>
      )}

      {/* AI result panel */}
      {(aiResult || aiError) && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-3 space-y-3">
          {aiError && <p className="text-xs text-rose-600 dark:text-rose-400">{aiError}</p>}
          {aiResult && (
            <>
              {aiResult.layerInsight && <p className="text-xs text-violet-700 dark:text-violet-300 font-medium">{aiResult.layerInsight}</p>}
              {aiResult.goalRecommendations?.map(rec => (
                <div key={rec.goalId} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{rec.goalLabel}</p>
                    <button onClick={() => handleApplyGoal(rec.goalId, rec.instruments)}
                      className="text-xs px-2 py-0.5 bg-violet-600 hover:bg-violet-700 text-white rounded-md font-semibold transition-colors">Aplicar</button>
                  </div>
                  {rec.instruments?.map((inst, i) => {
                    const tc = INSTRUMENT_TYPE_COLORS[inst.type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${tc}`}>{inst.type}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-gray-700 dark:text-gray-300">{inst.name}</span>
                          {inst.reason && <span className="text-xs text-gray-400 ml-1">— {inst.reason}</span>}
                        </div>
                        <span className="text-xs tabular-nums text-gray-400 shrink-0">{inst.alloc}%</span>
                      </div>
                    );
                  })}
                </div>
              ))}
              {aiResult.goalRecommendations?.length === 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Todas as sugestões aplicadas ✓</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Sublayer grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-1">
        {(layer.sublayers ?? []).map(sub => (
          <WalletSublayerCard
            key={sub.id}
            sublayer={sub}
            layerMonthlyAmount={layerMonthlyAmount}
            layerId={layer.id}
            layerColorKey={layer.colorKey}
            layerIndex={layerIndex}
            investments={investments}
            getCurrentValue={getCurrentValue}
            invLoading={invLoading}
            taggedTransactions={taggedTransactions}
            readOnly={readOnly}
            onEdit={() => setEditingSublayer(sub)}
          />
        ))}

        {!readOnly && (
          <button
            onClick={() => setEditingSublayer('new')}
            className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl p-4 flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 transition-colors min-h-[80px]"
          >
            <span className="text-base">+</span> Adicionar sublayer
          </button>
        )}
      </div>

      {/* Modals */}
      {showEditLayer && (
        <LayerModal layer={layer} onSave={handleSaveLayer} onClose={() => setShowEditLayer(false)} />
      )}
      {editingSublayer !== null && (
        <SublayerModal
          sublayer={editingSublayer === 'new' ? null : editingSublayer}
          layerMonthlyAmount={layerMonthlyAmount}
          onSave={handleSaveSublayer}
          onDelete={editingSublayer !== 'new' ? handleDeleteSublayer : undefined}
          onClose={() => setEditingSublayer(null)}
        />
      )}
    </div>
  );
}
