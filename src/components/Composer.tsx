import { useEffect, useRef, useState } from 'react';

type Props = {
  onSend: (text: string) => void;
  onBack: () => void;
  onRestart: () => void;
  onRepeat: () => void;
  muted: boolean;
  onToggleMute: () => void;
  askingName: boolean;
  disabled?: boolean;
  micSupported: boolean;
  listening: boolean;
  onMic: () => void;
  /** Bump this number to move focus to the text box ("Type instead"). */
  focusToken: number;
};

export function Composer({ onSend, onBack, onRestart, onRepeat, muted, onToggleMute, askingName, disabled, micSupported, listening, onMic, focusToken }: Props) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);

  // Names are typed (speech handles them poorly), so jump to the keyboard.
  useEffect(() => { if (askingName) input.current?.focus(); }, [askingName]);
  useEffect(() => { if (focusToken) input.current?.focus(); }, [focusToken]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="composer">
      <form className="composer__row" onSubmit={submit}>
        <button
          type="button"
          className={`mic ${listening ? 'mic--on' : ''}`}
          onClick={onMic}
          disabled={!micSupported || (disabled && !listening)}
          aria-pressed={listening}
          aria-label={!micSupported ? 'Voice input is not supported in this browser' : listening ? 'Stop listening' : 'Speak your answer'}
          title={!micSupported ? "Voice isn't supported in this browser. Typing works for everything." : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" fill="currentColor"/></svg>
        </button>
        <input
          ref={input}
          className="composer__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={askingName ? 'Type your name…' : 'Type your order…'}
          aria-label={askingName ? 'Your name for the cup' : 'Type your answer'}
          autoComplete={askingName ? 'given-name' : 'off'}
          disabled={disabled}
          enterKeyHint="send"
        />
        <button type="submit" className="send" disabled={disabled || !text.trim()}>Send</button>
      </form>
      {!micSupported && <p className="composer__note">Voice isn't available in this browser. Typing works for everything.</p>}
      <div className="controls" role="group" aria-label="Conversation controls">
        <button type="button" onClick={onRepeat}>Repeat</button>
        <button type="button" onClick={onBack}>Back</button>
        <button type="button" onClick={onRestart}>Start over</button>
        <button type="button" onClick={onToggleMute} aria-pressed={muted}>{muted ? 'Unmute' : 'Mute'}</button>
      </div>
    </div>
  );
}
