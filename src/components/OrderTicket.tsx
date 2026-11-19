import type { Order, Slot } from '../engine/types';
import { SLOTS, SLOT_LABELS, formatSlot } from '../lib/ui';

type Props = {
  order: Order;
  asking?: Slot;
  changed: Set<Slot>;
  open: boolean;
  onToggle: () => void;
  onEdit: (slot: Slot) => void;
  locked: boolean; // order submitted: no more edits
};

export function OrderTicket({ order, asking, changed, open, onToggle, onEdit, locked }: Props) {
  const filled = SLOTS.filter((s) => order[s] !== undefined).length;

  return (
    <section className={`ticket ${open ? 'ticket--open' : ''}`} aria-label="Your order">
      <button type="button" className="ticket__header" onClick={onToggle} aria-expanded={open}>
        <span className="ticket__title">Your order</span>
        <span className="ticket__count">{filled}/8</span>
        <span className="ticket__chevron" aria-hidden="true">{open ? '▾' : '▴'}</span>
      </button>

      <ul className="ticket__rows">
        {SLOTS.map((slot) => {
          const value = formatSlot(order, slot);
          const cls = ['ticket__row', asking === slot && 'is-asking', changed.has(slot) && 'is-changed'].filter(Boolean).join(' ');
          return (
            <li key={slot}>
              <button
                type="button"
                className={cls}
                onClick={() => onEdit(slot)}
                disabled={locked || value === undefined}
                aria-label={value ? `${SLOT_LABELS[slot]}: ${value}. Tap to change.` : `${SLOT_LABELS[slot]}: not set yet`}
              >
                <span className="ticket__label">{SLOT_LABELS[slot]}</span>
                <span className="ticket__value">{value ?? '—'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="ticket__foot">
        <strong>Pay at pickup</strong> · no card needed. We only ask for a first name for your cup.
        {filled > 0 && !locked && ' Tap a field to change it.'}
      </p>
    </section>
  );
}
