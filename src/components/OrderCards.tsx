import type { Order } from '../engine/types';
import { SLOTS, SLOT_LABELS, formatSlot } from '../lib/ui';

/** 05_Confirmation: full read-back before submitting. */
export function ConfirmCard({ order, onConfirm, onEdit }: { order: Order; onConfirm: () => void; onEdit: () => void }) {
  return (
    <div className="card confirm-card">
      <h2>Your order summary</h2>
      <dl>
        {SLOTS.filter((s) => order[s] !== undefined).map((s) => (
          <div key={s}><dt>{SLOT_LABELS[s]}</dt><dd>{formatSlot(order, s)}</dd></div>
        ))}
        <div><dt>Payment</dt><dd>Pay at pickup</dd></div>
      </dl>
      <div className="card__actions">
        <button type="button" className="btn" onClick={onEdit}>Edit order</button>
        <button type="button" className="btn btn--primary" onClick={onConfirm}>Confirm order</button>
      </div>
    </div>
  );
}

/** Shown before Start over wipes a partly-filled order (matches the flowchart). */
export function RestartConfirm({ filled, onKeep, onRestart }: { filled: number; onKeep: () => void; onRestart: () => void }) {
  return (
    <div className="voice-panel voice-panel--error" role="group" aria-labelledby="restart-title">
      <div className="voice-panel__title" id="restart-title">Start over?</div>
      <p className="voice-panel__hint">This clears your order ({filled} of 8 details so far).</p>
      <div className="voice-panel__actions">
        {/* Keeping the order is the safe default, so it gets focus */}
        <button type="button" className="btn btn--primary" onClick={onKeep} autoFocus>Keep my order</button>
        <button type="button" className="btn" onClick={onRestart}>Start over</button>
      </div>
    </div>
  );
}

/** 06_Order_Complete */
export function DoneCard({ order, onRestart }: { order: Order; onRestart: () => void }) {
  return (
    <div className="card done-card">
      <div className="done-card__check" aria-hidden="true">✓</div>
      <h2>Order confirmed!</h2>
      <p>Thanks, {order.name}. See you soon.</p>
      <div className="done-card__pickup">
        <strong>Pickup: {order.pickup}</strong>
        <span>Pay at pickup · No card required</span>
      </div>
      <button type="button" className="btn" onClick={onRestart}>Start another order</button>
    </div>
  );
}
