/**
 * Speech-to-text with the browser's Web Speech API.
 *
 * Tap to talk: start() listens for one utterance and stops on its own when the
 * user pauses (continuous = false). Interim words are exposed live; the final
 * transcript goes to onFinal. Errors become friendly messages, never a dead end.
 *
 * Needs HTTPS (or localhost). Best in Chrome; unreliable in Safari on iPhone.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** The parts of the Web Speech API we use (not in TypeScript's DOM types). */
interface SpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type Ctor = new () => SpeechRecognition;

function getRecognitionCtor(): Ctor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type SpeechError = { code: string; message: string };

const MESSAGES: Record<string, string> = {
  'no-speech': "I didn't hear anything. Try again, or type your answer.",
  'audio-capture': "I can't find a microphone. You can type your answer instead.",
  'not-allowed': 'Microphone access is blocked. Allow it in your browser settings, or type instead.',
  'service-not-allowed': 'Voice input is turned off in this browser. You can type instead.',
  network: 'Voice needs an internet connection. Check your connection, or type instead.',
  'language-not-supported': "Voice isn't available in this language here. Please type instead.",
};

type Options = {
  /** Final transcript. confidence is 0–1, or undefined when the browser doesn't report it. */
  onFinal: (transcript: string, confidence: number | undefined) => void;
  lang?: string;
};

export function useSpeechRecognition({ onFinal, lang = 'en-CA' }: Options) {
  const [supported] = useState(() => !!getRecognitionCtor());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);
  const rec = useRef<SpeechRecognition | null>(null);

  // Keep the latest callback without restarting recognition
  const onFinalRef = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError({ code: 'unsupported', message: "Voice isn't supported in this browser. Typing works for everything." });
      return;
    }
    rec.current?.abort();
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;

    let gotFinal = false;

    r.onstart = () => { setListening(true); setInterim(''); setError(null); };

    r.onresult = (e: SpeechRecognitionEvent) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          gotFinal = true;
          const alt = res[0];
          const transcript = alt.transcript.trim();
          // Android Chrome often reports 0 for correct results: treat 0 as "unknown"
          const confidence = alt.confidence > 0 ? alt.confidence : undefined;
          setInterim('');
          if (transcript) onFinalRef.current(transcript, confidence);
          else setError({ code: 'no-speech', message: MESSAGES['no-speech'] });
        } else {
          text += res[0].transcript;
        }
      }
      if (!gotFinal) setInterim(text);
    };

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'aborted') return; // we cancelled it ourselves
      setError({ code: e.error, message: MESSAGES[e.error] ?? "Something went wrong with voice input. Try again, or type instead." });
    };

    r.onend = () => {
      setListening(false);
      setInterim('');
      rec.current = null;
    };

    rec.current = r;
    try {
      r.start();
    } catch {
      setError({ code: 'start-failed', message: "Voice couldn't start. Try again, or type instead." });
    }
  }, [lang]);

  /** Stop listening and use what was heard so far. */
  const stop = useCallback(() => { rec.current?.stop(); }, []);

  /** Stop listening and throw away what was heard. */
  const cancel = useCallback(() => { rec.current?.abort(); setListening(false); setInterim(''); }, []);

  const clearError = useCallback(() => setError(null), []);

  // Don't leave the mic on if the component goes away
  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, interim, error, start, stop, cancel, clearError };
}
