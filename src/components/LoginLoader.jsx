import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { pickMessageIndex } from './LoginLoader.timing';
import animationData from '../assets/login-loader.json';

const MESSAGES = [
  'Preparando seu painel...',
  'Carregando suas transações...',
  'Sincronizando seus cartões...',
  'Quase lá...',
];
const ROTATE_INTERVAL_MS = 2200;
const MIN_DISPLAY_MS = 800;
const FALLBACK_EXTRA_MS = 1500;
const MAX_DISPLAY_MS = 8000;

export default function LoginLoader({ isReady, onFinished, onTimeout }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const startRef = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const start = performance.now();
    startRef.current = start;
    const id = setInterval(() => setElapsedMs(performance.now() - start), 250);
    const timeoutId = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, MAX_DISPLAY_MS);
    return () => {
      clearInterval(id);
      clearTimeout(timeoutId);
    };
  }, [onTimeout]);

  // Deterministic fallback: once isReady flips true, guarantee onFinished
  // fires even if Lottie's onLoopComplete never does (backgrounded tab, etc.).
  // Waits for the 800ms minimum hold to elapse, plus a 1500ms buffer to give
  // a loop boundary a chance to land naturally.
  useEffect(() => {
    if (!isReady) return undefined;
    const now = performance.now();
    const elapsed = startRef.current != null ? now - startRef.current : 0;
    const delay = Math.max(MIN_DISPLAY_MS - elapsed, 0) + FALLBACK_EXTRA_MS;
    const id = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onFinished?.();
    }, delay);
    return () => clearTimeout(id);
  }, [isReady, onFinished]);

  const messageIndex = pickMessageIndex({
    elapsedMs,
    intervalMs: ROTATE_INTERVAL_MS,
    count: MESSAGES.length,
  });

  const message = timedOut ? 'Demorando mais que o normal...' : MESSAGES[messageIndex];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
      <div className="w-48 h-48">
        <Lottie
          animationData={animationData}
          loop={true}
          speed={2}
          onLoopComplete={() => {
            if (isReady && elapsedMs >= MIN_DISPLAY_MS && !firedRef.current) {
              firedRef.current = true;
              onFinished?.();
            }
          }}
        />
      </div>
      <p className="mt-6 text-base text-gray-600 dark:text-gray-300 text-center min-h-[1.5rem]">
        {message}
      </p>
      {timedOut && (
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 text-sm rounded-lg bg-rose-500 text-white hover:bg-rose-600"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
