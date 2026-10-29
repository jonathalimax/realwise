import { useCallback, useEffect, useRef, useState } from 'react';

const getRecognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);

// Phones deliver one utterance per start (and repeat words in continuous mode on some Android builds), so only
// desktop keeps listening across pauses.
const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const join = (base, spoken) => {
  const head = base.trimEnd();
  const tail = spoken.trim();
  if (!tail) return base;
  return head ? `${head} ${tail}` : tail;
};

/**
 * Dictation with the browser's built-in speech recognition (no server, no key). The recognised words are appended
 * to `base` (what was already typed) and reported through `onTranscript` while the user speaks.
 * Errors are reported as the browser's codes ('not-allowed', 'network', 'audio-capture', ...).
 */
export default function useSpeechRecognition({ lang = 'pt-BR', onTranscript, onError }) {
  const Ctor = getRecognition();
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const handlers = useRef({ onTranscript, onError });
  useEffect(() => {
    handlers.current = { onTranscript, onError };
  }, [onTranscript, onError]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const start = useCallback(
    (base = '') => {
      if (!Ctor || recRef.current) return;
      const rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = !isTouchDevice();
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        let spoken = '';
        for (let i = 0; i < event.results.length; i += 1) spoken += event.results[i][0].transcript;
        handlers.current.onTranscript?.(join(base, spoken));
      };
      rec.onerror = (event) => {
        // 'no-speech' (silence) and 'aborted' (we stopped it) are not worth a message.
        if (event.error !== 'no-speech' && event.error !== 'aborted') handlers.current.onError?.(event.error);
      };
      rec.onend = () => {
        recRef.current = null;
        setListening(false);
      };

      try {
        recRef.current = rec;
        rec.start();
        setListening(true);
      } catch {
        recRef.current = null;
        setListening(false);
        handlers.current.onError?.('start-failed');
      }
    },
    [Ctor, lang],
  );

  useEffect(
    () => () => {
      try {
        recRef.current?.abort();
      } catch {
        /* nothing running */
      }
      recRef.current = null;
    },
    [],
  );

  return { supported: Boolean(Ctor), listening, start, stop };
}
