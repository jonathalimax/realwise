// src/pages/Portfolio.jsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useInvestments } from '../contexts/InvestmentContext';
import usePlannerLayers from './planner/usePlannerLayers';
import { resolveLayerColors, formatBRL } from './planner/carteira/constants';
import { Shimmer } from '@/components/ui/shimmer';

// Maps investment type keys → display badge label
const INV_TYPE_BADGE = {
  fixed_income: 'Renda Fixa',
  stocks:       'Ações',
  crypto:       'Cripto',
  funds:        'Misto',
  fii:          'FII',
  real_estate:  'Outro',
};

// Solid hex colors for the donut chart slices, keyed by layer id
const DONUT_COLORS = {
  liquidez:    '#3b82f6',
  crescimento: '#10b981',
  patrimonio:  '#8b5cf6',
  legado:      '#f97316',
};

// Badge color classes keyed by display badge label
const BADGE_COLORS = {
  'Renda Fixa': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'FII':        'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  'ETF':        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Ações':      'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Cripto':     'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
};


function TypeBadge({ type }) {
  const label = INV_TYPE_BADGE[type] ?? type ?? null;
  if (!label) return null;
  const cls = BADGE_COLORS[label] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>;
}

function ItemRow({ name, type, amount }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">{name}</span>
        <TypeBadge type={type} />
      </div>
      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white shrink-0">
        {formatBRL.format(amount)}
      </span>
    </div>
  );
}

function LayerGroup({ layer, layerIndex, items }) {
  const colors = resolveLayerColors(layer.id, layer.colorKey, layerIndex);
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${colors.header} border-b`}>
        <div className="flex items-center gap-2">
          <span>{layer.icon}</span>
          <span className={`text-sm font-semibold ${colors.title}`}>{layer.label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}>
            {items.length} {items.length === 1 ? 'item' : 'itens'}
          </span>
        </div>
        <span className={`text-sm font-bold tabular-nums ${colors.title}`}>
          {formatBRL.format(total)}
        </span>
      </div>
      {/* Items */}
      <div className="bg-white dark:bg-gray-800">
        {items.map((item) => (
          <ItemRow key={item.sourceId} name={item.name} type={item.type} amount={item.amount} />
        ))}
      </div>
    </div>
  );
}

function DonutChart({ layers, grouped }) {
  const layerTotals = layers
    .map(l => ({ id: l.id, total: (grouped[l.id] ?? []).reduce((s, i) => s + i.amount, 0) }))
    .filter(lt => lt.total > 0);
  const grandTotal = layerTotals.reduce((s, lt) => s + lt.total, 0);
  if (grandTotal === 0) return null;

  // Build conic-gradient string
  let cursor = 0;
  const stops = layerTotals.map(lt => {
    const pct = (lt.total / grandTotal) * 100;
    const color = DONUT_COLORS[lt.id] ?? '#94a3b8';
    const stop = `${color} ${cursor.toFixed(2)}% ${(cursor + pct).toFixed(2)}%`;
    cursor += pct;
    return stop;
  });
  const gradient = `conic-gradient(${stops.join(', ')})`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Alocação por camada</p>
      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="shrink-0 relative w-20 h-20 rounded-full" style={{ background: gradient }}>
          <div className="absolute inset-[14px] bg-white dark:bg-gray-800 rounded-full" />
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1">
          {layerTotals.map(lt => {
            const layer = layers.find(l => l.id === lt.id);
            const pct = ((lt.total / grandTotal) * 100).toFixed(1);
            const color = DONUT_COLORS[lt.id] ?? '#94a3b8';
            return (
              <div key={lt.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {layer?.icon} {layer?.label}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { ownerId } = useAccess();
  const { investments, loading: invLoading } = useInvestments();
  const layers = usePlannerLayers();
  const [taggedTxs, setTaggedTxs] = useState([]);
  const [txLoading, setTxLoading] = useState(true);

  // Fetch all transactions that have a plannerGoalId
  useEffect(() => {
    if (!ownerId) { setTxLoading(false); return; }
    setTxLoading(true);
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', ownerId),
      where('plannerGoalId', '!=', null)
    );
    getDocs(q)
      .then(snap => {
        const tagged = [];
        snap.forEach(d => {
          tagged.push({ id: d.id, ...d.data() });
        });
        setTaggedTxs(tagged);
      })
      .catch(err => console.error('[Portfolio] fetch tagged transactions:', err))
      .finally(() => setTxLoading(false));
  }, [ownerId]);

  const loading = invLoading || txLoading;

  // Build sublayerId → layerId lookup from wallet layers
  const sublayerToLayer = {};
  layers.forEach(layer => {
    (layer.sublayers ?? []).forEach(sub => {
      sublayerToLayer[sub.id] = layer.id;
    });
  });

  // Convert investments and transactions to a uniform portfolio item shape:
  // { sourceId, name, type, amount, plannerGoalId }
  const activeInvestments = investments.filter(inv => inv.status !== 'closed');

  const invItems = activeInvestments.map(inv => ({
    sourceId: `inv-${inv.id}`,
    name: inv.name,
    type: inv.type,
    amount: inv.initialAmount ?? 0,
    plannerGoalId: inv.plannerGoalId ?? null,
  }));

  const txItems = taggedTxs.map(tx => ({
    sourceId: `tx-${tx.id}`,
    name: tx.description,
    type: tx.investmentType ?? null,
    amount: tx.amount ?? 0,
    plannerGoalId: tx.plannerGoalId,
  }));

  const allItems = [...invItems, ...txItems];

  // Group items by layerId; items with no matching layer go to unlinked
  const grouped = {};
  const unlinked = [];

  allItems.forEach(item => {
    const layerId = item.plannerGoalId ? sublayerToLayer[item.plannerGoalId] : null;
    if (layerId) {
      if (!grouped[layerId]) grouped[layerId] = [];
      grouped[layerId].push(item);
    } else {
      unlinked.push(item);
    }
  });

  // Totals
  const totalInvested = allItems.reduce((s, i) => s + i.amount, 0);
  const invCount = invItems.length;
  const txCount = txItems.length;

  // Only render layers that have at least one item
  const activeLayers = layers.filter(l => (grouped[l.id] ?? []).length > 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Page title */}
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Portfólio</h1>

      {/* Header summary card */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl p-5">
        <p className="text-xs text-gray-400 mb-1">Total investido</p>
        {loading ? (
          <Shimmer className="h-8 w-2/3 rounded-lg" />
        ) : (
          <p className="text-2xl font-bold text-white tabular-nums">{formatBRL.format(totalInvested)}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          {invCount} {invCount === 1 ? 'ativo' : 'ativos'} · {txCount} {txCount === 1 ? 'transação vinculada' : 'transações vinculadas'}
        </p>
      </div>

      {/* Donut chart */}
      {!loading && <DonutChart layers={layers} grouped={grouped} />}
      {loading && <Shimmer className="h-28 w-full rounded-2xl" />}

      {/* Layer groups */}
      {loading ? (
        <>
          <Shimmer className="h-24 w-full rounded-2xl" />
          <Shimmer className="h-24 w-full rounded-2xl" />
        </>
      ) : (
        <>
          {activeLayers.map((layer, i) => (
            <LayerGroup
              key={layer.id}
              layer={layer}
              layerIndex={i}
              items={grouped[layer.id] ?? []}
            />
          ))}

          {/* Sem vínculo */}
          {unlinked.length > 0 && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm opacity-50">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span>📦</span>
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Sem vínculo</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {unlinked.length} {unlinked.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-gray-400">
                  {formatBRL.format(unlinked.reduce((s, i) => s + i.amount, 0))}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-800">
                {unlinked.map((item) => (
                  <ItemRow key={item.sourceId} name={item.name} type={item.type} amount={item.amount} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {activeLayers.length === 0 && unlinked.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p className="text-4xl mb-3">💼</p>
              <p className="text-sm font-medium">Nenhum investimento encontrado</p>
              <p className="text-xs mt-1">Adicione investimentos ou vincule transações a uma camada da carteira</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
