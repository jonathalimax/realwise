import { useCallback, useEffect, useRef, useState } from 'react';

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

/** What Elio wrote, minus the markup and symbols a voice would read out loud ("asterisco asterisco"). */
export function toSpeakable(markdown) {
  return String(markdown ?? '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [text](url) -> text
    .replace(/[*_`#>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/R\$\s*([\d.]+(?:,\d{1,2})?)/g, '$1 reais') // "R$ 1.234,56" -> "1.234,56 reais"
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, ' . ') // an emoji becomes a short pause
    .replace(/\s*\n+\s*/g, ' ¶ ') // line breaks: a pause, unless the line already ended with punctuation
    .replace(/([.!?…:;,])\s*¶\s*/g, '$1 ')
    .replace(/\s*¶\s*/g, '. ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.!?…])(\s*\.)+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Sentence-sized pieces: some browsers cut off a long utterance after ~15 seconds. A sentence ends at . ! ? … that is
 * followed by a space or the end, so the dots inside "1.979,90" never split a number.
 */
export function toChunks(text, max = 180) {
  const sentences = text.match(/\S[\s\S]*?(?:[.!?…]+(?=\s|$)|$)/g) ?? [text];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && (current + ' ' + sentence).length > max) {
      chunks.push(current.trim());
      current = '';
    }
    current += (current ? ' ' : '') + sentence.trim();
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Read-aloud with the browser's own voices (free). Picks a Brazilian Portuguese voice when the device has one. */
export default function useSpeechSynthesis({ lang = 'pt-BR' } = {}) {
  const s = synth();
  const [speakingId, setSpeakingId] = useState(null);
  const voiceRef = useRef(null);
  const tokenRef = useRef(0); // invalidates callbacks of an utterance that was cancelled

  useEffect(() => {
    if (!s) return undefined;
    const pick = () => {
      const voices = s.getVoices();
      voiceRef.current =
        voices.find((v) => v.lang === lang) ??
        voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()) ??
        voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) ??
        null;
    };
    pick();
    s.addEventListener?.('voiceschanged', pick); // voices load asynchronously in most browsers
    return () => s.removeEventListener?.('voiceschanged', pick);
  }, [s, lang]);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    s?.cancel();
    setSpeakingId(null);
  }, [s]);

  const speak = useCallback(
    (id, markdown) => {
      if (!s) return;
      s.cancel();
      const token = (tokenRef.current += 1);
      const chunks = toChunks(toSpeakable(markdown));
      if (chunks.length === 0) return;
      setSpeakingId(id);
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = lang;
        if (voiceRef.current) u.voice = voiceRef.current;
        u.rate = 1;
        const done = () => {
          if (tokenRef.current === token && i === chunks.length - 1) setSpeakingId(null);
        };
        u.onend = done;
        u.onerror = done;
        s.speak(u);
      });
    },
    [s, lang],
  );

  useEffect(() => () => s?.cancel(), [s]);

  return { supported: Boolean(s), speakingId, speak, stop };
}
