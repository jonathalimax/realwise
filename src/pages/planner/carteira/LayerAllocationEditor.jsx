// src/pages/planner/carteira/LayerAllocationEditor.jsx
import { useState } from 'react';
import { formatBRL, resolveLayerColors } from './constants';
import LayerModal from './LayerModal';

export default function LayerAllocationEditor({ layers, poupancaValue, onUpdateLayers, readOnly }) {
  const [showAddLayer, setShowAddLayer] = useState(false);
  const totalPct = layers.reduce((s, l) => s + (l.pct ?? 0), 0);
  const overAllocated = totalPct > 100;
  const underAllocated = totalPct < 100;

  const handlePctChange = (layerId, newPct) => {
    onUpdateLayers(layers.map(l => l.id === layerId ? { ...l, pct: Math.max(0, Math.min(100, newPct)) } : l));
  };

  const handleAddLayer = ({ icon, label, description, colorKey }) => {
    const id = `layer-${Date.now()}`;
    onUpdateLayers([...layers, { id, label, icon, colorKey, description, pct: 0, sublayers: [] }]);
    setShowAddLayer(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Alocação por Camada</p>
        <span className="text-xs text-gray-400 tabular-nums">{formatBRL.format(poupancaValue)}/mês</span>
      </div>

      {/* Stacked bar */}
      <div className="h-2 rounded-full overflow-hidden flex mb-4">
        {layers.map((layer, i) => {
          const colors = resolveLayerColors(layer.id, layer.colorKey, i);
          const width = Math.min(100, layer.pct ?? 0);
          return <div key={layer.id} className={`h-2 ${colors.bar}`} style={{ width: `${width}%` }} />;
        })}
        {underAllocated && <div className="h-2 bg-gray-200 dark:bg-gray-600 flex-1" />}
      </div>

      {/* Layer tiles */}
      <div className="grid grid-cols-2 gap-2">
        {layers.map((layer, i) => {
          const colors = resolveLayerColors(layer.id, layer.colorKey, i);
          const monthly = poupancaValue * ((layer.pct ?? 0) / 100);
          return (
            <div key={layer.id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${colors.tile} ${colors.tileBorder}`}>
              <span className="text-base shrink-0">{layer.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${colors.tileText} truncate`}>{layer.label}</p>
                <p className="text-xs text-gray-400 tabular-nums">{formatBRL.format(monthly)}/mês</p>
              </div>
              {!readOnly ? (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={layer.pct ?? 0}
                    onChange={e => handlePctChange(layer.id, parseFloat(e.target.value) || 0)}
                    className={`w-10 border rounded-md px-1 py-0.5 text-xs font-bold text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 ${colors.input}`}
                    min={0} max={100}
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              ) : (
                <span className={`text-xs font-bold tabular-nums ${colors.tileText}`}>{layer.pct ?? 0}%</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Total validation */}
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
        <span className={`font-medium ${overAllocated ? 'text-rose-500' : underAllocated ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {overAllocated ? `⚠ Excesso: ${totalPct - 100}% sobre-alocado` : underAllocated ? `${100 - totalPct}% não alocado` : '✓ Totalmente alocado'}
        </span>
        <span className="tabular-nums text-gray-400">{totalPct}% / 100%</span>
      </div>

      {!readOnly && (
        <button
          onClick={() => setShowAddLayer(true)}
          className="mt-3 w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-1"
        >
          + Adicionar camada
        </button>
      )}

      {showAddLayer && (
        <LayerModal onSave={handleAddLayer} onClose={() => setShowAddLayer(false)} />
      )}
    </div>
  );
}
