/**
 * Text-to-speech with the browser's Web Speech API.
 *
 * - speak(text) cancels anything still playing, then reads the text sentence
 *   by sentence (desktop Chrome cuts off single utterances after ~15 s).
 * - speaking is true from the first word until the last sentence ends, so
 *   Hunter can show "Speaking…".
 * - Browsers stay silent until the user has tapped something. unlock() is
 *   wired to the first tap so iPhone Safari allows later replies to speak.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;

/** Prefer a local English voice: en-CA, then en-US, en-GB, then any English. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  for (const lang of ['en-ca', 'en-us', 'en-gb']) {
    const matches = english.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang);
    const best = matches.find((v) => v.localService) ?? matches[0];
    if (best) return best;
  }
  return english.find((v) => v.localService) ?? english[0];
}

/** Split into sentences so no single utterance runs long. */
function toChunks(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

export function useSpeechSynthesis({ lang = 'en-CA', rate = 1.05 } = {}) {
  const [supported] = useState(() => !!synth);
  const [speaking, setSpeaking] = useState(false);
  const voice = useRef<SpeechSynthesisVoice | undefined>(undefined);
  const run = useRef(0); // which speak() call is current; older callbacks are ignored
  const unlocked = useRef(false);

  // Voices load asynchronously (often empty on the first call in Chrome)
  useEffect(() => {
    if (!synth) return;
    const load = () => { voice.current = pickVoice(synth.getVoices()); };
    load();
    synth.addEventListener('voiceschanged', load);
    return () => synth.removeEventListener('voiceschanged', load);
  }, []);

  const cancel = useCallback(() => {
    run.current++;
    synth?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!synth || !text.trim()) return;
    const id = ++run.current;
    if (synth.speaking || synth.pending) synth.cancel();

    const chunks = toChunks(text);
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = voice.current?.lang ?? lang;
      if (voice.current) u.voice = voice.current;
      u.rate = rate;
      if (i === 0) u.onstart = () => { if (run.current === id) setSpeaking(true); };
      const finish = () => { if (run.current === id) setSpeaking(false); };
      if (i === chunks.length - 1) u.onend = finish;
      // "interrupted"/"canceled" fire when we cancel on purpose; any error ends speaking
      u.onerror = finish;
      synth.speak(u);
    });
  }, [lang, rate]);

  /** Call from inside a tap handler once, so later replies are allowed to speak. */
  const unlock = useCallback(() => {
    if (!synth || unlocked.current) return;
    unlocked.current = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
  }, []);

  // Stop talking if the page goes away
  useEffect(() => () => synth?.cancel(), []);

  return { supported, speaking, speak, cancel, unlock };
}
