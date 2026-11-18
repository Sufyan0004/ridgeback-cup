/**
 * Placeholder for Viet's <Hunter /> avatar. Same props, so swapping it in is
 * a one-line import change in App.tsx.
 */
import type { HunterState } from '../lib/ui';

const STATUS: Record<HunterState, string> = {
  idle: 'Ready to help',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

export function HunterPlaceholder({ state }: { state: HunterState }) {
  return (
    <div className={`hunter hunter--${state}`}>
      <div className="hunter__face" aria-hidden="true">H</div>
      <div className="hunter__name">Hunter</div>
      {/* Status is always shown as text, never by animation alone */}
      <div className="hunter__status" role="status" aria-live="polite">{STATUS[state]}</div>
    </div>
  );
}
