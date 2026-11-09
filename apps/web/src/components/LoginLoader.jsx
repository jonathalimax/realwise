import { useCallback, useEffect, useRef, useState } from 'react';
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
// The "welcome" animation is 493 frames at 60fps; played at ANIMATION_SPEED it lasts ~4.1s. It plays once, start to
// finish, and the screen only moves on after it ended (it used to leave after ~2.3s, cutting it in half).
const ANIMATION_SPEED = 2;
const ANIMATION_MS = Math.round((493 / 60 / ANIMATION_SPEED) * 1000);
const ANIMATION_FALLBACK_MS = ANIMATION_MS + 500;
const MAX_DISPLAY_MS = 8000;

export default function LoginLoader({ isReady, onFinished, onTimeout }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);
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

  const finish = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onFinished?.();
  }, [onFinished]);

  // Leave once the data is ready AND the animation reached its end.
  useEffect(() => {
    if (isReady && animationDone) finish();
  }, [isReady, animationDone, finish]);

  // Deterministic fallback in case Lottie's onComplete never fires (backgrounded tab, etc.).
  useEffect(() => {
    if (!isReady) return undefined;
    const elapsed = startRef.current != null ? performance.now() - startRef.current : 0;
    const id = setTimeout(finish, Math.max(ANIMATION_FALLBACK_MS - elapsed, 0));
    return () => clearTimeout(id);
  }, [isReady, finish]);

  const messageIndex = pickMessageIndex({
    elapsedMs,
    intervalMs: ROTATE_INTERVAL_MS,
    count: MESSAGES.length,
  });

  const message = timedOut ? 'Demorando mais que o normal...' : MESSAGES[messageIndex];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--rw-bg)] px-6">
      <div className="flex flex-col items-center -space-y-2">
        <div className="w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center">
          <Lottie
            animationData={animationData}
            loop={false}
            speed={ANIMATION_SPEED}
            onComplete={() => setAnimationDone(true)}
          />
        </div>
        <p
          key={message}
          className="text-lg font-medium tracking-tight text-[var(--rw-ink)] text-center min-h-[1.75rem] animate-[fadeIn_400ms_ease-out]"
        >
          {message}
        </p>
      </div>
      {timedOut && (
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-5 py-2.5 text-sm font-medium rounded-full bg-rose-500 text-white shadow-sm hover:bg-rose-600 transition-colors"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
