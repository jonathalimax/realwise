// src/pages/planner/carteira/constants.js

export { formatBRL } from '../usePlannerState';

export const LAYER_COLORS = {
  liquidez:    { header: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',           title: 'text-blue-700 dark:text-blue-300',     bar: 'bg-blue-500',    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',         chip: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',   tile: 'bg-blue-50 dark:bg-blue-900/20',   tileBorder: 'border-blue-200 dark:border-blue-700',   tileText: 'text-blue-700 dark:text-blue-300',   input: 'border-blue-200 dark:border-blue-600' },
  crescimento: { header: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', title: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', chip: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400', tile: 'bg-emerald-50 dark:bg-emerald-900/20', tileBorder: 'border-emerald-200 dark:border-emerald-700', tileText: 'text-emerald-700 dark:text-emerald-300', input: 'border-emerald-200 dark:border-emerald-600' },
  patrimonio:  { header: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',   title: 'text-violet-700 dark:text-violet-300',   bar: 'bg-violet-500',  badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',   chip: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',   tile: 'bg-violet-50 dark:bg-violet-900/20',  tileBorder: 'border-violet-200 dark:border-violet-700',  tileText: 'text-violet-700 dark:text-violet-300',  input: 'border-violet-200 dark:border-violet-600' },
  legado:      { header: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',   title: 'text-orange-700 dark:text-orange-300',   bar: 'bg-orange-500',  badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',   chip: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',   tile: 'bg-orange-50 dark:bg-orange-900/20',  tileBorder: 'border-orange-200 dark:border-orange-700',  tileText: 'text-orange-700 dark:text-orange-300',  input: 'border-orange-200 dark:border-orange-600' },
};

export const LAYER_COLOR_PALETTE = [
  { key: 'blue',    bar: 'bg-blue-500',    header: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',           title: 'text-blue-700 dark:text-blue-300',     tile: 'bg-blue-50 dark:bg-blue-900/20',   tileBorder: 'border-blue-200 dark:border-blue-700',   tileText: 'text-blue-700 dark:text-blue-300',   badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',         chip: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',   input: 'border-blue-200 dark:border-blue-600' },
  { key: 'emerald', bar: 'bg-emerald-500', header: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', title: 'text-emerald-700 dark:text-emerald-300', tile: 'bg-emerald-50 dark:bg-emerald-900/20', tileBorder: 'border-emerald-200 dark:border-emerald-700', tileText: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', chip: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400', input: 'border-emerald-200 dark:border-emerald-600' },
  { key: 'violet',  bar: 'bg-violet-500',  header: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',   title: 'text-violet-700 dark:text-violet-300',   tile: 'bg-violet-50 dark:bg-violet-900/20',  tileBorder: 'border-violet-200 dark:border-violet-700',  tileText: 'text-violet-700 dark:text-violet-300',  badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',   chip: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',   input: 'border-violet-200 dark:border-violet-600' },
  { key: 'orange',  bar: 'bg-orange-500',  header: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',   title: 'text-orange-700 dark:text-orange-300',   tile: 'bg-orange-50 dark:bg-orange-900/20',  tileBorder: 'border-orange-200 dark:border-orange-700',  tileText: 'text-orange-700 dark:text-orange-300',  badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',   chip: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',   input: 'border-orange-200 dark:border-orange-600' },
  { key: 'rose',    bar: 'bg-rose-500',    header: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',           title: 'text-rose-700 dark:text-rose-300',     tile: 'bg-rose-50 dark:bg-rose-900/20',   tileBorder: 'border-rose-200 dark:border-rose-700',   tileText: 'text-rose-700 dark:text-rose-300',   badge: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',         chip: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',   input: 'border-rose-200 dark:border-rose-600' },
  { key: 'amber',   bar: 'bg-amber-500',   header: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',       title: 'text-amber-700 dark:text-amber-300',   tile: 'bg-amber-50 dark:bg-amber-900/20', tileBorder: 'border-amber-200 dark:border-amber-700', tileText: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',     chip: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', input: 'border-amber-200 dark:border-amber-600' },
];

export const INSTRUMENT_TYPE_COLORS = {
  'Renda Fixa': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'FII':        'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  'ETF':        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Ações':      'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Cripto':     'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
};

export const SUBLAYER_TYPE_OPTIONS = ['Renda Fixa', 'FII', 'ETF', 'Ações', 'Cripto', 'Misto', 'Outro'];

export const PRIORITY_ORDER = [
  'emergencia', 'mae', 'manutencao', 'ipva', 'matricula',
  'casa', 'carAntecipacao', 'filhos',
];

/**
 * Resolves layer color config by layerId, falling back to palette by colorKey or index.
 * @param {string} layerId
 * @param {string|undefined} colorKey - stored color key for user-created layers
 * @param {number} index - layer index for palette fallback
 * @returns {object} color config object with header, title, bar, badge, chip, tile, tileBorder, tileText, input keys
 */
export function resolveLayerColors(layerId, colorKey, index) {
  const fixed = LAYER_COLORS[layerId];
  if (fixed) return fixed;
  const byKey = LAYER_COLOR_PALETTE.find(p => p.key === colorKey);
  if (byKey) return byKey;
  return LAYER_COLOR_PALETTE[index % LAYER_COLOR_PALETTE.length];
}
