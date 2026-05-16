import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { pickMessageIndex } from './LoginLoader.timing';

const MESSAGES = [
  'Preparando seu painel...',
  'Carregando suas transações...',
  'Sincronizando seus cartões...',
  'Quase lá...',
];
const ROTATE_INTERVAL_MS = 2200;
const MAX_DISPLAY_MS = 8000;

export default function LoginLoader({ onTimeout }) {
  const startedAt = useRef(performance.now());
  const [, setTick] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch('/lottie/login-loader.json')
      .then((r) => r.json())
      .then(setAnimationData)
      .catch(() => setAnimationData(null));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    const timeoutId = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, MAX_DISPLAY_MS);
    return () => {
      clearInterval(id);
      clearTimeout(timeoutId);
    };
  }, [onTimeout]);

  const elapsedMs = performance.now() - startedAt.current;
  const messageIndex = pickMessageIndex({
    elapsedMs,
    intervalMs: ROTATE_INTERVAL_MS,
    count: MESSAGES.length,
  });

  const message = timedOut ? 'Demorando mais que o normal...' : MESSAGES[messageIndex];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
      <div className="w-48 h-48">
        {animationData ? (
          <Lottie animationData={animationData} loop={true} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
          </div>
        )}
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
