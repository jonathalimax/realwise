import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

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
      frame = requestAnimationFrame(() => positions.set(keyRef.current, window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    const samePath = pathRef.current === pathname;
    keyRef.current = key;
    pathRef.current = pathname;
    if (samePath && type !== 'POP') return undefined;

    const target = type === 'POP' ? positions.get(key) ?? 0 : 0;
    if (target === 0) { window.scrollTo(0, 0); return undefined; }

    // Pages fill in after their data loads, so wait (briefly) until the document is tall enough to scroll there.
    const start = performance.now();
    let frame = 0;
    const tryRestore = () => {
      const tall = document.documentElement.scrollHeight - window.innerHeight >= target;
      if (tall || performance.now() - start > 800) { window.scrollTo(0, target); return; }
      frame = requestAnimationFrame(tryRestore);
    };
    tryRestore();
    return () => cancelAnimationFrame(frame);
  }, [pathname, key, type]);

  return null;
}
