import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { loadPdfJs } from '../../services/importers/pdfLoader';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const MAX_PDF_PAGES = 40;
const MAX_TEXT_CHARS = 200_000;
const MAX_SHEET_ROWS = 300;

const clamp = (v) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
const extOf = (name) => name.split('.').pop()?.toLowerCase() ?? '';

/** How the file is shown: pictures (images, PDF pages) zoom by width; text and sheets zoom by font size. */
function kindOf(file) {
  const ext = extOf(file.name);
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['xlsx', 'xls'].includes(ext)) return 'sheet';
  return 'text';
}

/** Renders the first pages of a PDF to object URLs (images), wide enough to stay crisp when zoomed. */
async function renderPdfPages(file, isCancelled) {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const urls = [];
  const total = Math.min(doc.numPages, MAX_PDF_PAGES);
  for (let n = 1; n <= total; n += 1) {
    if (isCancelled()) break;
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1400 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (blob) urls.push(URL.createObjectURL(blob));
  }
  return { urls, truncated: doc.numPages > total, pages: doc.numPages };
}

async function readSheet(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' }).slice(0, MAX_SHEET_ROWS);
}

/**
 * Read-only, full-screen viewer for a file the user is about to send. Nothing here can change the file.
 * Zoom works by pinch, double-tap, ctrl+wheel and the +/- buttons (the page itself blocks native pinch-zoom).
 */
export default function FilePreview({ file, onClose, language }) {
  const pt = language === 'pt';
  const kind = kindOf(file);
  const [scale, setScale] = useState(1);
  const [state, setState] = useState({ status: 'loading' }); // loading | ready | error
  const box = useRef(null);
  const anchor = useRef(null); // keeps the point under the fingers fixed while the content resizes
  const pinch = useRef(null);
  const lastTap = useRef(0);
  const scaleRef = useRef(1);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Load the content for this file.
  useEffect(() => {
    let cancelled = false;
    const urls = [];
    (async () => {
      try {
        if (kind === 'image') {
          const url = URL.createObjectURL(file);
          urls.push(url);
          setState({ status: 'ready', images: [url] });
        } else if (kind === 'pdf') {
          const out = await renderPdfPages(file, () => cancelled);
          urls.push(...out.urls);
          if (!cancelled) setState({ status: 'ready', images: out.urls, truncated: out.truncated, pages: out.pages });
        } else if (kind === 'sheet') {
          const rows = await readSheet(file);
          if (!cancelled) setState({ status: 'ready', rows });
        } else {
          const text = (await file.text()).slice(0, MAX_TEXT_CHARS);
          if (!cancelled) setState({ status: 'ready', text });
        }
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [file, kind]);

  // Esc closes; the page behind must not scroll.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /** Zooms to `next`, keeping the content point under (clientX, clientY) in place. */
  const zoomTo = useCallback((next, clientX, clientY) => {
    const el = box.current;
    const target = clamp(next);
    if (!el || target === scaleRef.current) return;
    const rect = el.getBoundingClientRect();
    const mx = clientX == null ? rect.width / 2 : clientX - rect.left;
    const my = clientY == null ? rect.height / 2 : clientY - rect.top;
    anchor.current = {
      mx,
      my,
      fx: (el.scrollLeft + mx) / el.scrollWidth,
      fy: (el.scrollTop + my) / el.scrollHeight,
    };
    setScale(target);
  }, []);

  useLayoutEffect(() => {
    const el = box.current;
    const a = anchor.current;
    if (!el || !a) return;
    el.scrollLeft = a.fx * el.scrollWidth - a.mx;
    el.scrollTop = a.fy * el.scrollHeight - a.my;
    anchor.current = null;
  }, [scale]);

  // Pinch and ctrl+wheel need non-passive listeners so the browser's own page zoom can be cancelled.
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e) => {
      if (e.touches.length === 2) pinch.current = { d: dist(e.touches), s: scaleRef.current };
    };
    const onMove = (e) => {
      if (e.touches.length !== 2 || !pinch.current) return;
      e.preventDefault();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomTo(pinch.current.s * (dist(e.touches) / pinch.current.d), mx, my);
    };
    const onEnd = (e) => {
      if (e.touches.length < 2) pinch.current = null;
    };
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomTo(scaleRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [zoomTo, state.status]);

  const onDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      zoomTo(scaleRef.current > 1.2 ? 1 : 2.5, e.clientX, e.clientY);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const text = {
    close: pt ? 'Fechar' : 'Close',
    readOnly: pt ? 'Somente visualização' : 'View only',
    loading: pt ? 'Abrindo o arquivo…' : 'Opening the file…',
    error: pt ? 'Não consegui mostrar a prévia deste arquivo, mas você ainda pode enviá-lo.' : 'Could not preview this file, but you can still send it.',
    zoomIn: pt ? 'Aumentar zoom' : 'Zoom in',
    zoomOut: pt ? 'Diminuir zoom' : 'Zoom out',
    reset: pt ? 'Tamanho original' : 'Reset zoom',
    truncated: (n) => (pt ? `Mostrando as primeiras ${MAX_PDF_PAGES} de ${n} páginas.` : `Showing the first ${MAX_PDF_PAGES} of ${n} pages.`),
  };

  const isPicture = kind === 'image' || kind === 'pdf';

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={file.name}>
      <div className="flex items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{file.name}</p>
          <p className="text-[11px] text-white/60">{text.readOnly}</p>
        </div>
        <button onClick={() => zoomTo(scale / 1.5)} disabled={scale <= MIN_SCALE} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30" aria-label={text.zoomOut}>
          <MagnifyingGlassMinusIcon className="h-5 w-5" />
        </button>
        <button onClick={() => zoomTo(1)} className="min-w-[3.25rem] rounded-lg px-1 py-2 text-xs font-semibold tabular-nums hover:bg-white/10" aria-label={text.reset}>
          {Math.round(scale * 100)}%
        </button>
        <button onClick={() => zoomTo(scale * 1.5)} disabled={scale >= MAX_SCALE} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30" aria-label={text.zoomIn}>
          <MagnifyingGlassPlusIcon className="h-5 w-5" />
        </button>
        <button onClick={onClose} className="ml-1 rounded-lg p-2 hover:bg-white/10" aria-label={text.close}>
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      <div
        ref={box}
        onClick={onDoubleTap}
        className="flex-1 overflow-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {state.status === 'loading' && <p className="mt-24 text-center text-sm text-white/70">{text.loading}</p>}
        {state.status === 'error' && <p className="mx-auto mt-24 max-w-xs text-center text-sm text-white/80">{text.error}</p>}

        {state.status === 'ready' && isPicture && (
          <div className="mx-auto space-y-3" style={{ width: `${scale * 100}%` }}>
            {state.images.map((src, i) => (
              <img key={src} src={src} alt={`${file.name} ${i + 1}`} draggable={false} className="block w-full select-none rounded bg-white" />
            ))}
            {state.truncated && <p className="pb-2 text-center text-xs text-white/60">{text.truncated(state.pages)}</p>}
          </div>
        )}

        {state.status === 'ready' && kind === 'sheet' && (
          <div className="mx-auto w-max min-w-full rounded bg-white p-2 text-gray-900" style={{ fontSize: `${scale * 0.75}rem` }}>
            <table className="border-collapse">
              <tbody>
                {state.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className="whitespace-nowrap border border-gray-200 px-2 py-1">{String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {state.status === 'ready' && kind === 'text' && (
          <pre className="mx-auto w-max min-w-full whitespace-pre rounded bg-white p-3 font-mono text-gray-900" style={{ fontSize: `${scale * 0.75}rem` }}>
            {state.text}
          </pre>
        )}
      </div>
    </div>
  );
}
