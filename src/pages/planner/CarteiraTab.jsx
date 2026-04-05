import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useInvestments } from '@/contexts/InvestmentContext';
import { formatBRL } from './usePlannerState';
import { Shimmer } from '@/components/ui/shimmer';

// Priority within each layer section
const PRIORITY_ORDER = [
  'emergencia', 'mae', 'manutencao', 'ipva', 'matricula', // liquidez
  'aposentadoria',                                          // crescimento
  'casa',                                                   // patrimonio
  'filhos',                                                 // legado
];

const LAYER_CONFIG = {
  liquidez:   { label: 'Liquidez',             icon: '💧', header: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',   title: 'text-blue-700 dark:text-blue-300',    desc: 'Reservas líquidas e de emergência — acesso imediato.' },
  crescimento:{ label: 'Crescimento',           icon: '📈', header: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', title: 'text-emerald-700 dark:text-emerald-300', desc: 'Composição de longo prazo — consistência acima de timing.' },
  patrimonio: { label: 'Patrimônio',            icon: '🏠', header: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',   title: 'text-violet-700 dark:text-violet-300',  desc: 'Ativos reais — casa e carro com apreciação de longo prazo.' },
  legado:     { label: 'Legado',                icon: '👨‍👩‍👧‍👦', header: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', title: 'text-orange-700 dark:text-orange-300',  desc: 'Impacto intergeracional — educação dos filhos e holding familiar.' },
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

const LAYER_CARD_COLORS = {
  liquidez:    { badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',         bar: 'bg-blue-500',    chip: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
  crescimento: { badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500', chip: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
  patrimonio:  { badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',   bar: 'bg-violet-500',  chip: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' },
  legado:      { badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',   bar: 'bg-orange-500',  chip: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' },
};

function InstrumentList({ instruments }) {
  if (!instruments?.length) return null;
  return (
    <div className="space-y-1">
      {instruments.map((inst, i) => {
        const typeColor = INSTRUMENT_TYPE_COLORS[inst.type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
        return (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${typeColor}`}>
                {inst.type}
              </span>
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{inst.name}</span>
            </div>
            <span className="text-xs tabular-nums text-gray-400 shrink-0">{inst.alloc}%</span>
          </div>
        );
      })}
    </div>
  );
}

function GoalCard({ row, goalTarget, isPhase2, onUpdateRow, investments, getCurrentValue, invLoading, taggedTransactions }) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [editingManual, setEditingManual] = useState(false);
  const [tempTarget, setTempTarget] = useState('');
  const [tempManual, setTempManual] = useState('');
  const [showInstruments, setShowInstruments] = useState(false);

  const meta = ROW_META[row.id] ?? { icon: '💰' };
  const colors = LAYER_CARD_COLORS[row.layer] ?? LAYER_CARD_COLORS.liquidez;
  const monthlyContrib = isPhase2 ? row.phase2 : row.phase1;

  // Auto-sum: tagged investments + tagged transactions
  const taggedInvs = investments.filter(inv => inv.plannerGoalId === row.id && inv.status !== 'closed');
  const invTotal = taggedInvs.reduce((sum, inv) => sum + getCurrentValue(inv), 0);
  const taggedTxs = taggedTransactions[row.id] ?? [];
  const txTotal = taggedTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const autoTotal = invTotal + txTotal;
  const hasAutoData = autoTotal > 0;
  const recordCount = taggedInvs.length + taggedTxs.length;

  const currentBalance = hasAutoData ? autoTotal : (row.manualBalance ?? 0);
  const isOngoing = goalTarget === 0;
  const progressPct = (!isOngoing && goalTarget > 0)
    ? Math.min(100, (currentBalance / goalTarget) * 100)
    : 0;
  const remaining = Math.max(0, goalTarget - currentBalance);
  const goalReached = !isOngoing && currentBalance >= goalTarget && goalTarget > 0;

  const handleTargetSave = () => {
    const parsed = parseFloat(tempTarget.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) onUpdateRow(row.id, { goalTarget: parsed });
    setEditingTarget(false);
  };

  const handleManualSave = () => {
    const parsed = parseFloat(tempManual.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) onUpdateRow(row.id, { manualBalance: parsed });
    setEditingManual(false);
  };

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
            {editingManual ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  value={tempManual}
                  onChange={e => setTempManual(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleManualSave(); if (e.key === 'Escape') setEditingManual(false); }}
                  autoFocus
                />
                <button onClick={handleManualSave} className="text-xs text-violet-600 dark:text-violet-400 font-semibold">OK</button>
              </div>
            ) : (
              <button
                onClick={() => { setTempManual(String(row.manualBalance ?? 0)); setEditingManual(true); }}
                className="text-xs text-gray-400 italic hover:text-violet-500 transition-colors text-left"
              >
                {(row.manualBalance ?? 0) > 0
                  ? `Saldo manual: ${formatBRL.format(row.manualBalance)}`
                  : 'Sem registros — clique para inserir saldo'}
              </button>
            )}
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
              {editingTarget ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    className="w-28 px-1.5 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-right"
                    value={tempTarget}
                    onChange={e => setTempTarget(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleTargetSave(); if (e.key === 'Escape') setEditingTarget(false); }}
                    autoFocus
                  />
                  <button onClick={handleTargetSave} className="text-xs text-violet-600 dark:text-violet-400 font-semibold">OK</button>
                </div>
              ) : (
                <button
                  onClick={() => { setTempTarget(String(goalTarget)); setEditingTarget(true); }}
                  className="tabular-nums hover:text-violet-500 transition-colors"
                >
                  {formatBRL.format(goalTarget)}
                </button>
              )}
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

      {/* Footer — monthly contribution */}
      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
        <span>Aporte este mês</span>
        <span className="tabular-nums font-semibold">{formatBRL.format(monthlyContrib)}</span>
      </div>
    </div>
  );
}

function LayerSection({ layerKey, rows, isPhase2, onUpdateRow, investments, getCurrentValue, invLoading, taggedTransactions }) {
  const config = LAYER_CONFIG[layerKey];
  if (!rows.length) return null;

  return (
    <div className="space-y-3">
      {/* Layer header */}
      <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${config.header}`}>
        <span className="text-base">{config.icon}</span>
        <div>
          <p className={`text-xs font-bold uppercase tracking-wide ${config.title}`}>{config.label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{config.desc}</p>
        </div>
      </div>

      {/* Cards grid */}
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
    </div>
  );
}

const LAYER_ORDER = ['liquidez', 'crescimento', 'patrimonio', 'legado'];

export default function CarteiraTab({ state, update, isPhase2ForSelectedMonth }) {
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

  // Sort rows within each layer by PRIORITY_ORDER
  const sortedRows = [...(state.savingsRows ?? [])].sort((a, b) => {
    const ia = PRIORITY_ORDER.indexOf(a.id);
    const ib = PRIORITY_ORDER.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Group by layer
  const grouped = {};
  LAYER_ORDER.forEach(l => { grouped[l] = []; });
  sortedRows.forEach(row => {
    const l = row.layer ?? 'liquidez';
    if (grouped[l]) grouped[l].push(row);
    else grouped.liquidez.push(row);
  });

  const handleUpdateRow = (rowId, patch) => {
    const updated = state.savingsRows.map(r => r.id === rowId ? { ...r, ...patch } : r);
    update('savingsRows', updated);
  };

  return (
    <div className="space-y-6">
      {LAYER_ORDER.map(layerKey => (
        <LayerSection
          key={layerKey}
          layerKey={layerKey}
          rows={grouped[layerKey]}
          isPhase2={isPhase2ForSelectedMonth}
          onUpdateRow={handleUpdateRow}
          investments={investments}
          getCurrentValue={getCurrentValue}
          invLoading={invLoading}
          taggedTransactions={taggedTransactions}
        />
      ))}
    </div>
  );
}
