import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineOutput, Slot, UserEvent } from './engine/types';
import { createEngine } from './lib/engine';
import { SLOTS, type HunterState, type Message } from './lib/ui';
import { Hunter } from './components/Hunter';
import { Transcript } from './components/Transcript';
import { QuickReplies } from './components/QuickReplies';
import { OrderTicket } from './components/OrderTicket';
import { Composer } from './components/Composer';
import { ConfirmCard, DoneCard, RestartConfirm } from './components/OrderCards';
import { VoicePanel, type VoiceView } from './components/VoicePanel';
import { useSpeechRecognition } from './lib/useSpeechRecognition';
import { useSpeechSynthesis } from './lib/useSpeechSynthesis';
import './App.css';

const THINK_MS = 350; // brief "thinking" beat so the state change is visible
const LOW_CONFIDENCE = 0.5; // below this, show what was heard and ask before sending

export default function App() {
  const [engine] = useState(createEngine);
  // Greeting comes straight from the engine on first render. It's shown but not
  // spoken: browsers block audio until the user has tapped something.
  const [out, setOut] = useState<EngineOutput>(() => engine.start());
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, from: 'hunter', text: out.reply }]);
  const [hunter, setHunter] = useState<HunterState>('idle');
  const [changed, setChanged] = useState<Set<Slot>>(new Set());
  const [ticketOpen, setTicketOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [review, setReview] = useState<string | null>(null); // low-confidence transcript awaiting a yes
  const [showUndo, setShowUndo] = useState(false);            // last answer came from voice
  const [focusToken, setFocusToken] = useState(0);
  const [confirmRestart, setConfirmRestart] = useState(false); // "Start over?" prompt showing
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);
  const outRef = useRef<EngineOutput>(out);

  const addMessage = (m: Omit<Message, 'id'>) => setMessages((ms) => [...ms, { ...m, id: nextId.current++ }]);

  // ---------- Voice output ----------
  const tts = useSpeechSynthesis();
  const mutedRef = useRef(muted); // read inside timers, so it must never be stale
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const { speak: ttsSpeak, cancel: stopSpeaking } = tts;
  const speak = useCallback((text: string) => {
    if (!mutedRef.current) ttsSpeak(text);
  }, [ttsSpeak]);

  /** The one path every user action goes through. */
  const dispatch = useCallback((event: UserEvent, said?: { text: string; viaVoice?: boolean }) => {
    if (said) addMessage({ from: 'user', ...said });
    stopSpeaking(); // the user has moved on; don't finish the old reply
    setConfirmRestart(false); // any other action means they're not starting over
    setHunter('thinking');
    timers.current.forEach(clearTimeout);

    const result = engine.handle(event);

    // Briefly highlight ticket fields whose value just changed
    const prev = outRef.current.order;
    const diff = new Set(SLOTS.filter((s) => result.order[s] !== undefined && JSON.stringify(prev?.[s]) !== JSON.stringify(result.order[s])));
    outRef.current = result;

    timers.current.push(window.setTimeout(() => {
      setOut(result);
      setChanged(diff);
      timers.current.push(window.setTimeout(() => setChanged(new Set()), 1600));
      addMessage({ from: 'hunter', text: result.reply });
      setHunter('idle');
      speak(result.reply);
    }, THINK_MS));
  }, [engine, speak, stopSpeaking]);

  // Clear pending timers on unmount
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const busy = hunter === 'thinking';
  const order = out.order;
  const phase = out.phase;

  const sendText = (text: string, viaVoice = false) => {
    setShowUndo(viaVoice);
    setReview(null);
    dispatch({ kind: 'text', text }, { text, viaVoice });
  };

  // ---------- Voice input ----------
  const speech = useSpeechRecognition({
    onFinal: (heard, confidence) => {
      if (confidence !== undefined && confidence < LOW_CONFIDENCE) setReview(heard);
      else sendText(heard, true);
    },
  });

  // Stop Hunter first so the speaker isn't picked up as the user's answer
  const startListening = () => { stopSpeaking(); setConfirmRestart(false); setReview(null); setShowUndo(false); speech.clearError(); speech.start(); };
  const onMic = () => (speech.listening ? speech.stop() : startListening());
  const typeInstead = () => {
    speech.cancel();
    speech.clearError();
    setReview(null);
    setFocusToken((n) => n + 1);
  };
  const undoVoice = () => {
    setShowUndo(false);
    dispatch({ kind: 'back' });
    timers.current.push(window.setTimeout(startListening, THINK_MS + 50));
  };

  const voiceView: VoiceView =
    speech.listening ? { kind: 'listening', interim: speech.interim }
    : review ? { kind: 'review', heard: review }
    : speech.error ? { kind: 'error', message: speech.error.message }
    : showUndo && phase !== 'done' && !busy ? { kind: 'undo' }
    : { kind: 'none' };
  const voiceBusy = voiceView.kind === 'listening' || voiceView.kind === 'review' || voiceView.kind === 'error';

  // Non-voice actions clear any voice leftovers
  const clearVoice = () => { setShowUndo(false); setReview(null); speech.clearError(); };

  const restart = () => { clearVoice(); speech.cancel(); setMessages([]); setTicketOpen(false); dispatch({ kind: 'restart' }); };
  // Ask first if there's anything to lose; a finished order restarts straight away
  const filled = SLOTS.filter((s) => order[s] !== undefined).length;
  const requestRestart = () => {
    if (filled === 0 || phase === 'done') return restart();
    clearVoice();
    speech.cancel();
    setConfirmRestart(true);
  };

  // Quick replies show in every phase except done. While confirming, the
  // summary card already has Confirm / Edit, so plain Yes / No chips are dropped.
  const chips = phase === 'done' ? [] : phase === 'confirming'
    ? out.quickReplies.filter((q) => !/^(yes|no)$/i.test(q.trim()))
    : out.quickReplies;
  const lastReply = [...messages].reverse().find((m) => m.from === 'hunter')?.text;

  const hunterState: HunterState =
    speech.listening ? 'listening'
    : hunter === 'thinking' ? 'thinking'
    : tts.speaking ? 'speaking'
    : hunter;

  const toggleMute = () => {
    if (!muted) stopSpeaking();
    setMuted(!muted);
  };

  return (
    // The first tap anywhere unlocks speech (iPhone Safari stays silent until then)
    <div className="app" onClickCapture={tts.unlock}>
      <header className="topbar">
        <div>
          <h1>The Ridgeback Cup</h1>
          <p>Coffee pickup with Hunter</p>
        </div>
      </header>

      <aside className="avatar-panel">
        <Hunter state={hunterState} />
      </aside>

      <main className="conversation">
        <Transcript messages={messages}>
          {phase === 'confirming' && !busy && (
            <ConfirmCard order={order} onConfirm={() => sendText('Yes')} onEdit={() => setTicketOpen(true)} />
          )}
          {phase === 'done' && !busy && <DoneCard order={order} onRestart={restart} />}
        </Transcript>

        {!voiceBusy && !confirmRestart && <QuickReplies options={chips} onPick={(o) => sendText(o)} disabled={busy} />}
        {confirmRestart && <RestartConfirm filled={filled} onKeep={() => setConfirmRestart(false)} onRestart={restart} />}

        <VoicePanel
          view={voiceView}
          onStop={speech.stop}
          onRetry={startListening}
          onTypeInstead={typeInstead}
          onSendHeard={() => review && sendText(review, true)}
          onUndo={undoVoice}
          canRetry={speech.supported && speech.error?.code !== 'not-allowed' && speech.error?.code !== 'service-not-allowed'}
        />

      </main>

      <OrderTicket
        order={order}
        asking={phase === 'collecting' ? out.asking : undefined}
        changed={changed}
        open={ticketOpen}
        onToggle={() => setTicketOpen((o) => !o)}
        onEdit={(slot) => { clearVoice(); setTicketOpen(false); dispatch({ kind: 'edit', slot }); }}
        locked={phase === 'done'}
      />

      <Composer
        onSend={(t) => { speech.cancel(); speech.clearError(); sendText(t); }}
        onBack={() => { clearVoice(); dispatch({ kind: 'back' }); }}
        onRestart={requestRestart}
        onRepeat={() => lastReply && ttsSpeak(lastReply)} // an explicit tap plays even when muted
        muted={muted}
        onToggleMute={toggleMute}
        speechOutSupported={tts.supported}
        askingName={out.asking === 'name'}
        disabled={busy}
        micSupported={speech.supported}
        listening={speech.listening}
        onMic={onMic}
        focusToken={focusToken}
      />
    </div>
  );
}
