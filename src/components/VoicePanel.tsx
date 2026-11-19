/**
 * Everything voice-related that sits above the composer:
 *  - listening   : live words while the user speaks (wireframe 02)
 *  - review      : low-confidence result, not sent until the user agrees
 *  - error       : friendly message with a way forward (wireframe 04)
 *  - undo        : after a voice answer, "Not what you said?" undoes it
 */
export type VoiceView =
  | { kind: 'listening'; interim: string }
  | { kind: 'review'; heard: string }
  | { kind: 'error'; message: string }
  | { kind: 'undo' }
  | { kind: 'none' };

type Props = {
  view: VoiceView;
  onStop: () => void;
  onRetry: () => void;
  onTypeInstead: () => void;
  onSendHeard: () => void;
  onUndo: () => void;
  canRetry: boolean;
};

export function VoicePanel({ view, onStop, onRetry, onTypeInstead, onSendHeard, onUndo, canRetry }: Props) {
  switch (view.kind) {
    case 'none':
      return null;

    case 'undo':
      return (
        <p className="voice-undo">
          Not what you said? <button type="button" onClick={onUndo}>Undo and try again</button>
        </p>
      );

    case 'listening':
      return (
        <div className="voice-panel voice-panel--listening" role="status" aria-live="polite">
          <div className="voice-panel__title">Listening to your order</div>
          <div className="wave" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <span key={i} />)}</div>
          <p className="voice-panel__live">{view.interim || 'Speak naturally, or switch to typing.'}</p>
          <div className="voice-panel__actions">
            <button type="button" className="btn" onClick={onStop}>Stop listening</button>
            <button type="button" className="btn" onClick={onTypeInstead}>Type instead</button>
          </div>
        </div>
      );

    case 'review':
      return (
        <div className="voice-panel" role="alert">
          <div className="voice-panel__title">I heard: “{view.heard}”</div>
          <p className="voice-panel__hint">I'm not sure I got that right. Is it correct?</p>
          <div className="voice-panel__actions">
            <button type="button" className="btn btn--primary" onClick={onSendHeard}>Yes, send it</button>
            <button type="button" className="btn" onClick={onRetry}>Retry voice</button>
            <button type="button" className="btn" onClick={onTypeInstead}>Type instead</button>
          </div>
        </div>
      );

    case 'error':
      return (
        <div className="voice-panel voice-panel--error" role="alert">
          <p className="voice-panel__hint">{view.message}</p>
          <div className="voice-panel__actions">
            {canRetry && <button type="button" className="btn" onClick={onRetry}>Retry voice</button>}
            <button type="button" className="btn btn--primary" onClick={onTypeInstead}>Type instead</button>
          </div>
        </div>
      );
  }
}
