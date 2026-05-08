/**
 * Renders a visible DOM banner in DEV mode so auth flow stages are visible
 * even when console is wiped by page navigation or "Persist Logs" is off.
 * Banners stack at bottom-left and auto-remove after 12 seconds.
 */
export function devMark(label) {
  if (!import.meta.env.DEV) return;
  const el = document.createElement('div');
  el.textContent = `[mark ${new Date().toISOString().slice(11, 23)}] ${label}`;
  el.style.cssText = `
    position:fixed;left:8px;bottom:${8 + (window.__devMarkCount = (window.__devMarkCount || 0) + 1) * 24}px;
    background:#000;color:#0f0;font:12px/1.4 monospace;
    padding:4px 8px;border-radius:4px;z-index:99999;pointer-events:none;
    max-width:90vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  `;
  el.className = 'rw-dev-mark';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 12000);
}
