// src/pages/planner/carteira/walletVersion.js

/**
 * Returns the most recent WalletVersion whose `from` <= month.
 * @param {Array} walletVersions
 * @param {string} month - 'YYYY-MM'
 * @returns {object|null}
 */
export function getActiveVersion(walletVersions, month) {
  if (!walletVersions?.length) return null;
  const sorted = [...walletVersions].sort((a, b) => (a.from > b.from ? 1 : -1));
  let active = sorted[0];
  for (const v of sorted) {
    if (v.from <= month) active = v;
  }
  return active;
}

/**
 * Applies patchFn(layers) for the given month, creating a new version
 * snapshot if the active version predates the month.
 * @param {Array} walletVersions
 * @param {string} month - 'YYYY-MM'
 * @param {function} patchFn - receives current layers[], returns new layers[]
 * @returns {Array} new walletVersions array
 */
export function updateWalletForMonth(walletVersions, month, patchFn) {
  const sorted = [...walletVersions].sort((a, b) => (a.from > b.from ? 1 : -1));

  // Find index of the active version
  let activeIdx = 0;
  sorted.forEach((v, i) => { if (v.from <= month) activeIdx = i; });
  const active = sorted[activeIdx];

  if (active.from === month) {
    // Mutate the existing snapshot for this month
    return sorted.map((v, i) =>
      i === activeIdx ? { ...v, layers: patchFn(v.layers) } : v
    );
  }

  // Clone active version and insert new snapshot starting from month
  const newVersion = {
    from: month,
    layers: patchFn(JSON.parse(JSON.stringify(active.layers))),
  };
  return [...sorted, newVersion].sort((a, b) => (a.from > b.from ? 1 : -1));
}

/**
 * Computes monthly contribution amount for a sublayer.
 * @param {object} sublayer
 * @param {number} layerMonthlyAmount - the layer's share of total investable
 * @returns {number}
 */
export function sublayerMonthlyAmount(sublayer, layerMonthlyAmount) {
  if (sublayer.mode === 'value') return sublayer.value ?? 0;
  return layerMonthlyAmount * ((sublayer.pct ?? 0) / 100);
}

/**
 * Net return after IRPF.
 * @param {number} returnPct - gross monthly %
 * @param {number} taxRate - IRPF %
 * @returns {number}
 */
export function netReturn(returnPct, taxRate) {
  return returnPct * (1 - taxRate / 100);
}
