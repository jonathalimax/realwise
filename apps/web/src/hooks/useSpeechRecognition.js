import { useCallback, useEffect, useRef, useState } from 'react';

const getRecognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);

// Phones deliver one utterance per start (and repeat words in continuous mode on some Android builds), so only
// desktop keeps listening across pauses.
const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const QUESTION_START = /^(quanto|quantos|quantas|quando|onde|como|qual|quais|quem|por que|porque|o que|que|posso|pode|tem|tenho|devo|vale|será|sera|dá|da pra|dá pra)\b/i;

/**
 * Browser transcripts come back lowercase, unpunctuated and (on some phones) with words stuttered twice.
 * Tidy only what was spoken: collapse repeats, capitalise, and close the sentence once recognition is final.
 */
export function tidySpeech(raw, { capitalize = true, final = false } = {}) {
  let text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  // "o o gasto" / "quanto gastei quanto gastei" -> single occurrence (1 to 4 word phrases repeated back to back).
  for (let n = 4; n >= 1; n -= 1) {
    const re = new RegExp(`\\b((?:\\S+\\s+){${n - 1}}\\S+)\\s+\\1\\b`, 'gi');
    text = text.replace(re, '$1');
  }
  if (capitalize) text = text.charAt(0).toUpperCase() + text.slice(1);
  if (final && !/[.!?…]$/.test(text)) text += QUESTION_START.test(text) ? '?' : '.';
  return text;
}

const join = (base, spoken, final = false) => {
  const head = base.trimEnd();
  const startsSentence = !head || /[.!?…]$/.test(head);
  const tail = tidySpeech(spoken, { capitalize: startsSentence, final });
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
        for (let i = 0; i < event.results.length; i += 1) spoken += `${event.results[i][0].transcript} `;
        const last = event.results[event.results.length - 1];
        handlers.current.onTranscript?.(join(base, spoken, Boolean(last?.isFinal)));
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
