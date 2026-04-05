import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useInvestments } from '@/contexts/InvestmentContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatBRL } from './usePlannerState';
import { Shimmer } from '@/components/ui/shimmer';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_ORDER = [
  'emergencia', 'mae', 'manutencao', 'ipva', 'matricula',
  'aposentadoria',
  'casa',
  'filhos',
];

const LAYER_CONFIG = {
  liquidez:    { label: 'Liquidez',    icon: '💧', header: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',         title: 'text-blue-700 dark:text-blue-300',     desc: 'Reservas líquidas e de emergência — acesso imediato.' },
  crescimento: { label: 'Crescimento', icon: '📈', header: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', title: 'text-emerald-700 dark:text-emerald-300', desc: 'Composição de longo prazo — consistência acima de timing.' },
  patrimonio:  { label: 'Patrimônio',  icon: '🏠', header: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',   title: 'text-violet-700 dark:text-violet-300',  desc: 'Ativos reais — casa e carro com apreciação de longo prazo.' },
  legado:      { label: 'Legado',      icon: '👨‍👩‍👧‍👦', header: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', title: 'text-orange-700 dark:text-orange-300',  desc: 'Impacto intergeracional — educação dos filhos e holding familiar.' },
};

const LAYER_CARD_COLORS = {
  liquidez:    { badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',         bar: 'bg-blue-500',    chip: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
  crescimento: { badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500', chip: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
  patrimonio:  { badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',   bar: 'bg-violet-500',  chip: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' },
  legado:      { badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',   bar: 'bg-orange-500',  chip: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' },
};

const INSTRUMENT_TYPE_COLORS = {
  'Renda Fixa': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'FII':        'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  'ETF':        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Ações':      'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Cripto':     'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
};

const ROW_META = {
  emergencia:    { icon: '🛡️' },
  aposentadoria: { icon: '🌱' },
  filhos:        { icon: '👶' },
  casa:          { icon: '🏠' },
  mae:           { icon: '❤️' },
  manutencao:    { icon: '🔧' },
  ipva:          { icon: '🚗' },
  matricula:     { icon: '📚' },
};

// Maps investment class names to InvestmentContext types
const CLASS_TYPE_MAP = {
  'Renda Fixa (CDB/Tesouro)': ['fixed_income'],
  'Exterior ETFs':             ['funds'],
  'FIIs':                      ['fii'],
  'Ações Dividendos':          ['stocks'],
  'Cripto':                    ['crypto'],
};

const CLASS_ICONS = {
  'Renda Fixa (CDB/Tesouro)': '📈',
  'Exterior ETFs':             '🌍',
  'FIIs':                      '🏢',
  'Ações Dividendos':          '💹',
  'Cripto':                    '₿',
};

// ── InstrumentList ───────────────────────────────────────────────────────────

function InstrumentList({ instruments }) {
  if (!instruments?.length) return null;
  return (
    <div className="space-y-1">
      {instruments.map((inst, i) => {
        const typeColor = INSTRUMENT_TYPE_COLORS[inst.type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
        return (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${typeColor}`}>{inst.type}</span>
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{inst.name}</span>
            </div>
            <span className="text-xs tabular-nums text-gray-400 shrink-0">{inst.alloc}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── EditableValue ────────────────────────────────────────────────────────────

function EditableValue({ value, onSave, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState('');

  const handleSave = () => {
    const parsed = parseFloat(temp.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) onSave(parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="w-24 px-1.5 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-right"
          value={temp}
          onChange={e => setTemp(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
        />
        <button onClick={handleSave} className="text-xs text-violet-600 dark:text-violet-400 font-semibold">OK</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setTemp(String(value)); setEditing(true); }}
      className={`tabular-nums hover:text-violet-500 transition-colors ${className}`}
      title="Clique para editar"
    >
      {formatBRL.format(value)}
    </button>
  );
}

// ── GoalCard ─────────────────────────────────────────────────────────────────

function GoalCard({ row, goalTarget, isPhase2, onUpdateRow, investments, getCurrentValue, invLoading, taggedTransactions }) {
  const [showInstruments, setShowInstruments] = useState(false);

  const meta = ROW_META[row.id] ?? { icon: '💰' };
  const colors = LAYER_CARD_COLORS[row.layer] ?? LAYER_CARD_COLORS.liquidez;
  const monthlyContrib = isPhase2 ? row.phase2 : row.phase1;

  const taggedInvs = investments.filter(inv => inv.plannerGoalId === row.id && inv.status !== 'closed');
  const taggedTxs = taggedTransactions[row.id] ?? [];
  const invTotal = taggedInvs.reduce((sum, inv) => sum + getCurrentValue(inv), 0);
  const txTotal = taggedTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const autoTotal = invTotal + txTotal;
  const hasAutoData = autoTotal > 0;
  const recordCount = taggedInvs.length + taggedTxs.length;

  const currentBalance = getRowBalance(row, investments, getCurrentValue, taggedTransactions);
  const isOngoing = goalTarget === 0;
  const progressPct = (!isOngoing && goalTarget > 0)
    ? Math.min(100, (currentBalance / goalTarget) * 100)
    : 0;
  const remaining = Math.max(0, goalTarget - currentBalance);
  const goalReached = !isOngoing && currentBalance >= goalTarget && goalTarget > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{row.label}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
          {isPhase2 ? 'Fase 2' : 'Fase 1'}
        </span>
      </div>

      {/* Instruments toggle */}
      {row.instruments?.length > 0 && (
        <div>
          <button
            onClick={() => setShowInstruments(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
          >
            <span>{showInstruments ? '▾' : '▸'}</span>
            <span>Onde investir</span>
          </button>
          {showInstruments && (
            <div className="mt-1.5">
              <InstrumentList instruments={row.instruments} />
            </div>
          )}
        </div>
      )}

      {/* Linked records / manual balance */}
      <div className="space-y-1.5">
        {invLoading ? (
          <>
            <Shimmer className="h-7 w-full rounded-lg" />
            <Shimmer className="h-7 w-3/4 rounded-lg" />
          </>
        ) : hasAutoData ? (
          <>
            {taggedInvs.map(inv => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{inv.name}</span>
                  {inv.bank && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${colors.chip}`}>{inv.bank}</span>
                  )}
                </div>
                <span className="text-xs tabular-nums font-semibold text-gray-700 dark:text-gray-300 ml-2 shrink-0">
                  {formatBRL.format(getCurrentValue(inv))}
                </span>
              </div>
            ))}
            {taggedTxs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50">
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{tx.description}</span>
                <span className="text-xs tabular-nums font-semibold text-gray-700 dark:text-gray-300 ml-2 shrink-0">
                  {formatBRL.format(tx.amount)}
                </span>
              </div>
            ))}
            <p className="text-xs text-gray-400 italic">
              {recordCount} {recordCount === 1 ? 'registro vinculado' : 'registros vinculados'}
            </p>
          </>
        ) : (
          <div>
            <EditableValue
              value={row.manualBalance ?? 0}
              onSave={v => onUpdateRow(row.id, { manualBalance: v })}
              className="text-xs text-gray-400 italic"
            />
          </div>
        )}
      </div>

      {/* Stats + Progress */}
      <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Atual</span>
          <span className="tabular-nums font-semibold text-gray-900 dark:text-white">{formatBRL.format(currentBalance)}</span>
        </div>

        {!isOngoing && (
          <>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 items-center">
              <span>Meta</span>
              <EditableValue
                value={goalTarget}
                onSave={v => onUpdateRow(row.id, { goalTarget: v })}
              />
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${colors.bar}`} style={{ width: `${progressPct}%` }} />
            </div>
            {goalReached ? (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 text-center">Meta atingida! 🎉</p>
            ) : (
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Faltam</span>
                <span className="tabular-nums">{formatBRL.format(remaining)}</span>
              </div>
            )}
          </>
        )}

        {isOngoing && (
          <p className="text-xs text-gray-400 italic">Reserva contínua</p>
        )}
      </div>

      {/* Footer — editable monthly contribution */}
      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
        <span>Aporte este mês</span>
        <EditableValue
          value={monthlyContrib}
          onSave={v => onUpdateRow(row.id, isPhase2 ? { phase2: v } : { phase1: v })}
          className="font-semibold"
        />
      </div>
    </div>
  );
}

// ── InvestmentClassCard ──────────────────────────────────────────────────────

function InvestmentClassCard({ cls, index, isPhase2, totalMonthly, investments, getCurrentValue, invLoading, onUpdateClass }) {
  const types = CLASS_TYPE_MAP[cls.name] ?? [];
  const balance = investments
    .filter(inv => types.includes(inv.type) && inv.status !== 'closed')
    .reduce((sum, inv) => sum + getCurrentValue(inv), 0);

  const monthlyAporte = isPhase2 ? (cls.phase2 ?? 0) : (cls.phase1 ?? 0);
  const allocPct = totalMonthly > 0 ? Math.round((monthlyAporte / totalMonthly) * 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{CLASS_ICONS[cls.name] ?? '📊'}</span>
          <span className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{cls.name}</span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
          {allocPct}%
        </span>
      </div>

      {/* Vehicle */}
      <p className="text-xs text-gray-400">{cls.vehicle}</p>

      {/* Balance */}
      <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700">
        {invLoading ? (
          <Shimmer className="h-5 w-3/4 rounded" />
        ) : (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Saldo atual</span>
            <span className="tabular-nums font-semibold text-gray-900 dark:text-white">{formatBRL.format(balance)}</span>
          </div>
        )}
      </div>

      {/* Footer — editable fixed monthly aporte (phase1/phase2) */}
      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
        <span>Aporte este mês</span>
        <EditableValue
          value={monthlyAporte}
          onSave={v => onUpdateClass(index, isPhase2 ? 'phase2' : 'phase1', v)}
          className="font-semibold"
        />
      </div>
    </div>
  );
}

// ── LayerSection ─────────────────────────────────────────────────────────────

function LayerSection({ layerKey, rows, isPhase2, onUpdateRow, onUpdateClass, investments, getCurrentValue, invLoading, taggedTransactions, investmentClasses, livresValue }) {
  const config = LAYER_CONFIG[layerKey];
  const { geminiApiKey } = useSettings();

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  const [aiRaw, setAiRaw] = useState('');

  if (!rows.length && (layerKey !== 'crescimento' || !investmentClasses?.length)) return null;

  const handleResearch = async () => {
    if (!geminiApiKey) return;
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    setAiRaw('');

    const allGoals = [
      ...rows.map(r => `- id: "${r.id}" | label: "${r.label}" | meta: R$ ${r.goalTarget ?? 0} | aporte: R$ ${isPhase2 ? r.phase2 : r.phase1}/mês`),
      ...(layerKey === 'crescimento' && investmentClasses?.length
        ? investmentClasses.map(c => `- classe: "${c.name}" | alocação: ${c.pct}% | aporte: R$ ${(livresValue * c.pct / 100).toFixed(2)}/mês`)
        : []),
    ].join('\n');

    const prompt = `Você é um consultor financeiro brasileiro especializado em investimentos PJ em 2026.

Analise a camada "${config.label}" e retorne SOMENTE JSON válido, sem markdown.

CAMADA: ${config.label} — ${config.desc}

OBJETIVOS/CLASSES:
${allGoals}

Regras: Tesouro IPCA+ 2035 → use 2040; IPCA+ 2045 → use 2050. Instrumentos reais disponíveis em 2026 no Brasil. Alocação por objetivo deve somar 100%.

Schema:
{
  "layerInsight": "análise prática em 1-2 frases",
  "goalRecommendations": [
    {
      "goalId": "id ou nome da classe",
      "goalLabel": "nome",
      "instruments": [
        { "name": "...", "type": "Renda Fixa|FII|ETF|Ações|Cripto", "alloc": 0, "reason": "..." }
      ]
    }
  ]
}`;

    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1400 },
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
        setAiResult(JSON.parse(cleaned));
      } catch {
        setAiRaw(raw);
      }
    } catch (e) {
      setAiError(e.message || 'Erro desconhecido');
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyGoal = (goalId, instruments) => {
    // Try to match a savings row first, then investment class
    const matchingRow = rows.find(r => r.id === goalId);
    if (matchingRow) onUpdateRow(goalId, { instruments });
    setAiResult(prev => prev ? {
      ...prev,
      goalRecommendations: prev.goalRecommendations.filter(g => g.goalId !== goalId),
    } : null);
  };

  return (
    <div className="space-y-3">
      {/* Layer header */}
      <div className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border ${config.header}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base shrink-0">{config.icon}</span>
          <div className="min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wide ${config.title}`}>{config.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{config.desc}</p>
          </div>
        </div>
        {geminiApiKey && (
          <button
            onClick={handleResearch}
            disabled={aiLoading}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {aiLoading ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Pesquisando...
              </>
            ) : <>✨ Pesquisar</>}
          </button>
        )}
      </div>

      {/* AI result panel */}
      {(aiResult || aiError || aiRaw) && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-3 space-y-3">
          {aiError && <p className="text-xs text-rose-600 dark:text-rose-400">{aiError}</p>}
          {aiRaw && <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">{aiRaw}</pre>}
          {aiResult && (
            <>
              {aiResult.layerInsight && (
                <p className="text-xs text-violet-700 dark:text-violet-300 font-medium">{aiResult.layerInsight}</p>
              )}
              {aiResult.goalRecommendations?.map(rec => (
                <div key={rec.goalId} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{rec.goalLabel}</p>
                    <button
                      onClick={() => handleApplyGoal(rec.goalId, rec.instruments)}
                      className="text-xs px-2 py-0.5 bg-violet-600 hover:bg-violet-700 text-white rounded-md font-semibold transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                  {rec.instruments?.map((inst, i) => {
                    const typeColor = INSTRUMENT_TYPE_COLORS[inst.type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${typeColor}`}>{inst.type}</span>
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

      {/* Goal cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map(row => (
            <GoalCard
              key={row.id}
              row={row}
              goalTarget={row.goalTarget ?? 0}
              isPhase2={isPhase2}
              onUpdateRow={onUpdateRow}
              investments={investments}
              getCurrentValue={getCurrentValue}
              invLoading={invLoading}
              taggedTransactions={taggedTransactions}
            />
          ))}
        </div>
      )}

      {/* Investment class distribution — only in Crescimento */}
      {layerKey === 'crescimento' && investmentClasses?.length > 0 && (
        <div className="space-y-2">
          {(() => {
            const totalMonthly = investmentClasses.reduce(
              (sum, c) => sum + (isPhase2 ? (c.phase2 ?? 0) : (c.phase1 ?? 0)), 0
            );
            return (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Distribuição dos aportes
                  </p>
                  <p className="text-xs text-gray-400">
                    Total: <span className="font-semibold tabular-nums">{formatBRL.format(totalMonthly)}</span>/mês
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {investmentClasses.map((cls, i) => (
                    <InvestmentClassCard
                      key={cls.name}
                      cls={cls}
                      index={i}
                      isPhase2={isPhase2}
                      totalMonthly={totalMonthly}
                      investments={investments}
                      getCurrentValue={getCurrentValue}
                      invLoading={invLoading}
                      onUpdateClass={onUpdateClass}
                    />
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Shared balance helper ────────────────────────────────────────────────────

function getRowBalance(row, investments, getCurrentValue, taggedTransactions) {
  const invs = investments.filter(inv => inv.plannerGoalId === row.id && inv.status !== 'closed');
  const invTotal = invs.reduce((sum, inv) => sum + getCurrentValue(inv), 0);
  const txTotal = (taggedTransactions[row.id] ?? []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const auto = invTotal + txTotal;
  return auto > 0 ? auto : (row.manualBalance ?? 0);
}


// ── CarteiraDashboard ────────────────────────────────────────────────────────

const LAYER_META = {
  liquidez:    { label: 'Liquidez',    icon: '💧', bar: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-700 dark:text-blue-300' },
  crescimento: { label: 'Crescimento', icon: '📈', bar: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300' },
  patrimonio:  { label: 'Patrimônio',  icon: '🏠', bar: 'bg-violet-500',  bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300' },
  legado:      { label: 'Legado',      icon: '👨‍👩‍👧‍👦', bar: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300' },
};

function CarteiraDashboard({ savingsRows, investmentClasses, investments, getCurrentValue, invLoading, taggedTransactions, isPhase2 }) {
  // ── Computed values ──────────────────────────────────────────────────────
  const rowBalances = {};
  savingsRows.forEach(row => {
    rowBalances[row.id] = getRowBalance(row, investments, getCurrentValue, taggedTransactions);
  });

  // Total patrimônio = all unique investment values + manual balances for rows with no investments
  const totalInvested = investments
    .filter(inv => inv.status !== 'closed')
    .reduce((sum, inv) => sum + getCurrentValue(inv), 0);

  const totalManualOnly = savingsRows
    .filter(row => {
      const hasInv = investments.some(inv => inv.plannerGoalId === row.id && inv.status !== 'closed');
      const hasTx = (taggedTransactions[row.id] ?? []).length > 0;
      return !hasInv && !hasTx && (row.manualBalance ?? 0) > 0;
    })
    .reduce((sum, row) => sum + (row.manualBalance ?? 0), 0);

  const totalPatrimonio = totalInvested + totalManualOnly;

  // Monthly commitment
  const monthlyRows = savingsRows.reduce((sum, r) => sum + (isPhase2 ? (r.phase2 ?? 0) : (r.phase1 ?? 0)), 0);
  const monthlyClasses = investmentClasses.reduce((sum, c) => sum + (isPhase2 ? (c.phase2 ?? 0) : (c.phase1 ?? 0)), 0);
  const monthlyTotal = monthlyRows + monthlyClasses;

  // Emergency fund
  const emergRow = savingsRows.find(r => r.id === 'emergencia');
  const emergBalance = rowBalances['emergencia'] ?? 0;
  const emergTarget = emergRow?.goalTarget ?? 120000;
  const emergMonthly = isPhase2 ? (emergRow?.phase2 ?? 0) : (emergRow?.phase1 ?? 0);
  // months covered = balance / (monthlyExpenses estimate = emergTarget/6)
  const monthlyExpenses = emergTarget / 6;
  const mesesCobertos = monthlyExpenses > 0 ? Math.floor(emergBalance / monthlyExpenses) : 0;
  const emergPct = emergTarget > 0 ? Math.min(100, (emergBalance / emergTarget) * 100) : 0;

  // Independence (aposentadoria)
  const apoRow = savingsRows.find(r => r.id === 'aposentadoria');
  const apoBalance = rowBalances['aposentadoria'] ?? 0;
  const apoTarget = apoRow?.goalTarget ?? 6000000;
  const apoPct = apoTarget > 0 ? Math.min(100, (apoBalance / apoTarget) * 100) : 0;

  // Layer progress
  const layerData = ['liquidez', 'crescimento', 'patrimonio', 'legado'].map(key => {
    const rows = savingsRows.filter(r => (r.layer ?? 'liquidez') === key);
    const balance = rows.reduce((sum, r) => sum + (rowBalances[r.id] ?? 0), 0);
    const target = rows.reduce((sum, r) => sum + (r.goalTarget > 0 ? r.goalTarget : 0), 0);
    const monthly = rows.reduce((sum, r) => sum + (isPhase2 ? (r.phase2 ?? 0) : (r.phase1 ?? 0)), 0);
    // Add investment class monthly for crescimento
    const classMonthly = key === 'crescimento'
      ? investmentClasses.reduce((sum, c) => sum + (isPhase2 ? (c.phase2 ?? 0) : (c.phase1 ?? 0)), 0)
      : 0;
    const pct = target > 0 ? Math.min(100, (balance / target) * 100) : null;
    return { key, balance, target, monthly: monthly + classMonthly, pct };
  });

  // Monthly flow breakdown for stacked bar
  const flowItems = [
    ...savingsRows
      .filter(r => (isPhase2 ? r.phase2 : r.phase1) > 0)
      .map(r => ({ label: r.label, value: isPhase2 ? r.phase2 : r.phase1, layer: r.layer ?? 'liquidez' })),
    ...investmentClasses
      .filter(c => (isPhase2 ? (c.phase2 ?? 0) : (c.phase1 ?? 0)) > 0)
      .map(c => ({ label: c.name, value: isPhase2 ? (c.phase2 ?? 0) : (c.phase1 ?? 0), layer: 'crescimento' })),
  ];

  return (
    <div className="space-y-4">
      {/* ── Hero metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Patrimônio total */}
        <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-400 mb-1">Patrimônio total</p>
          {invLoading ? (
            <Shimmer className="h-7 w-3/4 rounded-lg" />
          ) : (
            <p className="text-xl font-bold text-white tabular-nums">{formatBRL.format(totalPatrimonio)}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">investimentos + reservas</p>
        </div>

        {/* Aporte mensal */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Aporte mensal</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{formatBRL.format(monthlyTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{isPhase2 ? 'Fase 2' : 'Fase 1'}</p>
        </div>

        {/* Emergência */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fundo emergência</p>
          {invLoading ? (
            <Shimmer className="h-6 w-2/3 rounded" />
          ) : (
            <div className="flex items-end gap-1">
              <p className="text-lg font-bold tabular-nums" style={{ color: emergPct >= 100 ? '#10b981' : emergPct >= 50 ? '#f59e0b' : '#ef4444' }}>
                {mesesCobertos}
              </p>
              <p className="text-xs text-gray-400 mb-0.5">/ 6 meses</p>
            </div>
          )}
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-2">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${emergPct}%`, backgroundColor: emergPct >= 100 ? '#10b981' : emergPct >= 50 ? '#f59e0b' : '#ef4444' }}
            />
          </div>
        </div>

        {/* Independência financeira */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Independência</p>
          {invLoading ? (
            <Shimmer className="h-6 w-2/3 rounded" />
          ) : (
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {apoPct.toFixed(1)}%
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5 tabular-nums truncate">{formatBRL.format(apoBalance)} / {formatBRL.format(apoTarget)}</p>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1.5">
            <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${apoPct}%` }} />
          </div>
        </div>
      </div>

      {/* ── Layer progress ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 space-y-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Progresso por camada</p>
        {layerData.map(({ key, balance, target, monthly, pct }) => {
          const m = LAYER_META[key];
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span>{m.icon}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{m.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${m.bg} ${m.text}`}>
                    {formatBRL.format(monthly)}/mês
                  </span>
                </div>
                <div className="text-right text-gray-500 dark:text-gray-400 tabular-nums">
                  {invLoading ? '...' : (
                    pct !== null
                      ? `${formatBRL.format(balance)} / ${formatBRL.format(target)}`
                      : formatBRL.format(balance)
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                {invLoading ? (
                  <Shimmer className="h-2 w-full rounded-full" />
                ) : (
                  <div
                    className={`h-2 rounded-full transition-all ${m.bar}`}
                    style={{ width: pct !== null ? `${pct}%` : '0%' }}
                  />
                )}
              </div>
              {pct !== null && !invLoading && (
                <p className="text-xs text-gray-400 text-right">{pct.toFixed(1)}% atingido</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Monthly flow ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fluxo mensal</p>
          <p className="text-xs text-gray-400 tabular-nums">{formatBRL.format(monthlyTotal)}/mês</p>
        </div>

        {/* Stacked bar */}
        {monthlyTotal > 0 && (
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {flowItems.map((item, i) => {
              const pct = (item.value / monthlyTotal) * 100;
              const barColor = {
                liquidez: 'bg-blue-400',
                crescimento: 'bg-emerald-400',
                patrimonio: 'bg-violet-400',
                legado: 'bg-orange-400',
              }[item.layer] ?? 'bg-gray-400';
              return (
                <div
                  key={i}
                  className={`${barColor} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${item.label}: ${formatBRL.format(item.value)}`}
                />
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {flowItems
            .sort((a, b) => b.value - a.value)
            .map((item, i) => {
              const dotColor = {
                liquidez: 'bg-blue-400',
                crescimento: 'bg-emerald-400',
                patrimonio: 'bg-violet-400',
                legado: 'bg-orange-400',
              }[item.layer] ?? 'bg-gray-400';
              return (
                <div key={i} className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{item.label}</span>
                  </div>
                  <span className="text-xs tabular-nums font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                    {formatBRL.format(item.value)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ── CarteiraTab ──────────────────────────────────────────────────────────────

const LAYER_ORDER = ['liquidez', 'crescimento', 'patrimonio', 'legado'];

export default function CarteiraTab({ state, update, isPhase2ForSelectedMonth, savingsComputed }) {
  const { ownerId } = useAccess();
  const { investments, getCurrentValue, loading: invLoading } = useInvestments();
  const [taggedTransactions, setTaggedTransactions] = useState({});

  useEffect(() => {
    if (!ownerId) return;
    const fetchTagged = async () => {
      try {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', ownerId),
          where('amount', '>', 0)
        );
        const snap = await getDocs(q);
        const byGoal = {};
        snap.forEach(d => {
          const tx = { id: d.id, ...d.data() };
          if (tx.plannerGoalId) {
            if (!byGoal[tx.plannerGoalId]) byGoal[tx.plannerGoalId] = [];
            byGoal[tx.plannerGoalId].push(tx);
          }
        });
        setTaggedTransactions(byGoal);
      } catch (err) {
        console.error('[CarteiraTab] Error fetching tagged transactions:', err);
      }
    };
    fetchTagged();
  }, [ownerId]);

  const sortedRows = [...(state.savingsRows ?? [])].sort((a, b) => {
    const ia = PRIORITY_ORDER.indexOf(a.id);
    const ib = PRIORITY_ORDER.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const grouped = {};
  LAYER_ORDER.forEach(l => { grouped[l] = []; });
  sortedRows.forEach(row => {
    const l = row.layer ?? 'liquidez';
    if (grouped[l]) grouped[l].push(row);
    else grouped.liquidez.push(row);
  });

  const handleUpdateRow = (rowId, patch) => {
    update('savingsRows', state.savingsRows.map(r => r.id === rowId ? { ...r, ...patch } : r));
  };

  const handleUpdateClass = (index, field, value) => {
    const updated = state.investmentClasses.map((c, i) => i === index ? { ...c, [field]: value } : c);
    update('investmentClasses', updated);
  };

  const livresValue = isPhase2ForSelectedMonth
    ? (savingsComputed?.livresPhase2 ?? 0)
    : (savingsComputed?.livresPhase1 ?? 0);

  return (
    <div className="space-y-6">
      <CarteiraDashboard
        savingsRows={state.savingsRows ?? []}
        investmentClasses={state.investmentClasses ?? []}
        investments={investments}
        getCurrentValue={getCurrentValue}
        invLoading={invLoading}
        taggedTransactions={taggedTransactions}
        isPhase2={isPhase2ForSelectedMonth}
      />

      {LAYER_ORDER.map(layerKey => (
        <LayerSection
          key={layerKey}
          layerKey={layerKey}
          rows={grouped[layerKey]}
          isPhase2={isPhase2ForSelectedMonth}
          onUpdateRow={handleUpdateRow}
          onUpdateClass={handleUpdateClass}
          investments={investments}
          getCurrentValue={getCurrentValue}
          invLoading={invLoading}
          taggedTransactions={taggedTransactions}
          investmentClasses={layerKey === 'crescimento' ? state.investmentClasses : null}
          livresValue={livresValue}
        />
      ))}
    </div>
  );
}
