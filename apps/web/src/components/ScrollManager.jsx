import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// On iOS, index.css makes <body> the scroll container (window.scrollY stays 0), elsewhere the window scrolls. Read and
// write every candidate so "scroll to top" works on both; scrolling only `window` left iOS screens halfway down.
const scrollers = () => [document.scrollingElement, document.documentElement, document.body].filter(Boolean);
const currentTop = () => Math.max(window.scrollY, ...scrollers().map((el) => el.scrollTop));
const scrollRoom = () => Math.max(...scrollers().map((el) => el.scrollHeight - el.clientHeight));
const scrollToY = (y) => {
  window.scrollTo(0, y);
  scrollers().forEach((el) => { el.scrollTop = y; });
};

// Where each history entry was scrolled to. Keyed by location.key so the same page opened twice keeps separate spots.
const positions = new Map();

/**
 * Router default is "keep whatever scroll the previous screen had", which opens new screens halfway down.
 * - Opening a screen (push/replace to a different path): start at the top.
 * - Going back/forward: return to where the user left.
 * - Same path, only the query changed (filters, month): leave the scroll alone.
 */
export default function ScrollManager() {
  const { pathname, key } = useLocation();
  const type = useNavigationType();
  const keyRef = useRef(key);
  const pathRef = useRef(pathname);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => positions.set(keyRef.current, currentTop()));
    };
    // Capture phase: a scroll on <body> does not bubble to window.
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => { document.removeEventListener('scroll', onScroll, { capture: true }); cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    const samePath = pathRef.current === pathname;
    keyRef.current = key;
    pathRef.current = pathname;
    if (samePath && type !== 'POP') return undefined;

    const target = type === 'POP' ? positions.get(key) ?? 0 : 0;
    if (target === 0) {
      scrollToY(0);
      // A lazy screen mounts a frame later; make sure nothing it renders (or iOS) left the page offset.
      const frame0 = requestAnimationFrame(() => { if (currentTop() !== 0) scrollToY(0); });
      return () => cancelAnimationFrame(frame0);
    }

    // Pages fill in after their data loads, so wait (briefly) until the document is tall enough to scroll there.
    const start = performance.now();
    let frame = 0;
    const tryRestore = () => {
      const tall = scrollRoom() >= target;
      if (tall || performance.now() - start > 800) { scrollToY(target); return; }
      frame = requestAnimationFrame(tryRestore);
    };
    tryRestore();
    return () => cancelAnimationFrame(frame);
  }, [pathname, key, type]);

  return null;
}
