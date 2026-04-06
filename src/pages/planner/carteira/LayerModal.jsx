// src/pages/planner/carteira/LayerModal.jsx
import { useState, useEffect } from 'react';
import { LAYER_COLOR_PALETTE } from './constants';

export default function LayerModal({ layer, onSave, onDelete, onClose }) {
  const isNew = !layer;
  const [icon, setIcon] = useState(layer?.icon ?? '📁');
  const [label, setLabel] = useState(layer?.label ?? '');
  const [description, setDescription] = useState(layer?.description ?? '');
  const [colorKey, setColorKey] = useState(layer?.colorKey ?? 'blue');

  useEffect(() => {
    if (layer) { setIcon(layer.icon); setLabel(layer.label); setDescription(layer.description ?? ''); setColorKey(layer.colorKey ?? 'blue'); }
  }, [layer]);

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({ icon: icon.trim() || '📁', label: label.trim(), description: description.trim(), colorKey });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{isNew ? 'Nova Camada' : 'Editar Camada'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg">✕</button>
        </div>

        {/* Icon + Label */}
        <div className="flex gap-3">
          <div className="w-16">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Ícone</label>
            <input
              type="text"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-center text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              maxLength={2}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Nome</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Aposentadoria"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Descrição <span className="font-normal">(opcional)</span></label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Breve descrição do objetivo desta camada"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Color */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-2">Cor</label>
          <div className="flex gap-2 flex-wrap">
            {LAYER_COLOR_PALETTE.map(p => (
              <button
                key={p.key}
                onClick={() => setColorKey(p.key)}
                className={`w-8 h-8 rounded-full ${p.bar} transition-transform ${colorKey === p.key ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                title={p.key}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
          >
            {isNew ? 'Criar camada' : 'Salvar'}
          </button>
          {!isNew && onDelete && (
            <button
              onClick={onDelete}
              className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
            >
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
