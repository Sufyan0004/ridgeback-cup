/**
 * Hunter, the Ridgeback Cup barista (Role 3's avatar).
 *
 * One illustration, four states. Each state is shown by motion AND a text
 * label, so it still reads with reduced motion or for screen readers:
 *   idle      gentle float                     "Ready to help"
 *   listening head tilt + pulsing green ring   "Listening…"
 *   thinking  "…" bubble                       "Thinking…"
 *   speaking  quick bob + sound waves          "Speaking…"
 */
import type { HunterState } from '../lib/ui';
import fullImg from '../assets/hunter.webp';
import faceImg from '../assets/hunter-face.webp';
import './Hunter.css';

const STATUS: Record<HunterState, string> = {
  idle: 'Ready to help',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

export function Hunter({ state }: { state: HunterState }) {
  return (
    <div className={`hunter hunter--${state}`}>
      <div className="hunter__stage" aria-hidden="true">
        <picture className="hunter__art">
          {/* Phones show the face in a circle; wider screens show the full barista */}
          <source media="(min-width: 900px)" srcSet={fullImg} />
          <img src={faceImg} alt="" width={192} height={192} draggable={false} />
        </picture>
        <span className="hunter__bubble"><i /><i /><i /></span>
        <span className="hunter__waves"><i /><i /></span>
      </div>
      <div className="hunter__text">
        <div className="hunter__name">Hunter</div>
        <div className="hunter__status" role="status" aria-live="polite">{STATUS[state]}</div>
      </div>
    </div>
  );
}
