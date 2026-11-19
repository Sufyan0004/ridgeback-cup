/**
 * The 6 minimum conversation test cases from the project handout (section 11),
 * plus the design questions they depend on (section 13).
 *
 * These drive whatever engine src/lib/engine.ts returns, by feeding it the
 * same strings a user would type or say. They check the ORDER and PHASE, not
 * exact wording, so they work for any engine that follows CONTEXT.md.
 *
 * Run: npm test
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Engine, EngineOutput, Order } from '../src/engine/types';
import { createEngine } from '../src/lib/engine';

let engine: Engine;
let out: EngineOutput;

const say = (text: string) => (out = engine.handle({ kind: 'text', text }));
const sayAll = (...lines: string[]) => lines.forEach(say);
const lc = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : v);

/** Compare order values without caring about capitalisation. */
function expectOrder(expected: Order) {
  for (const [slot, value] of Object.entries(expected)) {
    const actual = out.order[slot as keyof Order];
    if (Array.isArray(value)) expect((actual as string[] | undefined)?.map(lc), slot).toEqual(value.map(lc));
    else expect(lc(actual), slot).toBe(lc(value));
  }
}

const offers = (option: string) => out.quickReplies.map((q) => q.toLowerCase()).includes(option.toLowerCase());
const MENU = ['coffee', 'latte', 'matcha latte', 'hot chocolate', 'ridgeback roast'];

/** A full valid order, answering one question at a time. */
const FULL_ORDER = ['latte', 'medium', 'hot', 'oat', 'no extras', '2', 'in 15 minutes', 'Sam'];

beforeEach(() => {
  engine = createEngine();
  out = engine.start();
});

describe('1. Normal completion', () => {
  it('greets the user, says what it can do, and asks the first question', () => {
    expect(out.reply.length).toBeGreaterThan(0);
    expect(out.phase).toBe('collecting');
    expect(MENU.filter(offers).length).toBeGreaterThanOrEqual(3); // drink choices offered
  });

  it('completes a full order and places it after "yes"', () => {
    sayAll(...FULL_ORDER);
    expect(out.phase).toBe('confirming');
    expectOrder({ drink: 'Latte', size: 'Medium', temp: 'hot', milk: 'Oat', extras: [], quantity: 2, pickup: 'In 15 minutes', name: 'Sam' });
    say('yes');
    expect(out.phase).toBe('done');
  });

  it('skips questions that do not apply (hot chocolate: no temperature or milk question)', () => {
    sayAll('hot chocolate', 'small');
    expect(out.order.temp).toBe('hot');
    expect(out.order.milk).toBeUndefined();
    expect(offers('Iced')).toBe(false);
    expect(offers('Oat')).toBe(false);
  });
});

describe('2. Missing information', () => {
  it('"a latte" fills the drink and asks for the missing size', () => {
    say('a latte');
    expectOrder({ drink: 'Latte' });
    expect(out.order.size).toBeUndefined();
    expect(offers('Small') && offers('Medium') && offers('Large')).toBe(true);
  });

  it('two or more details at once: "a large iced oat latte" fills four slots in one turn', () => {
    say('a large iced oat latte');
    expectOrder({ drink: 'Latte', size: 'Large', temp: 'iced', milk: 'Oat' });
    expect(out.phase).toBe('collecting'); // still needs extras, quantity, pickup, name
  });
});

describe('3. Invalid answer', () => {
  it('a drink not on the menu is not accepted, and the available drinks are explained', () => {
    say('a cappuccino');
    expect(out.order.drink).toBeUndefined();
    const reply = out.reply.toLowerCase();
    expect(MENU.some((d) => reply.includes(d)) || MENU.filter(offers).length >= 3).toBe(true);
  });

  it('a choice that breaks the drink rules is fixed, not silently accepted ("iced hot chocolate")', () => {
    say('iced hot chocolate');
    expectOrder({ drink: 'Hot chocolate' });
    expect(out.order.temp).not.toBe('iced');
  });

  it('a quantity outside 1–10 is rejected', () => {
    sayAll('latte', 'medium', 'hot', 'oat', 'no extras', '50');
    expect(out.order.quantity).toBeUndefined();
  });
});

describe('4. Correction', () => {
  it('tapping a ticket field changes only that answer', () => {
    sayAll('latte', 'medium', 'hot', 'oat');
    out = engine.handle({ kind: 'edit', slot: 'milk' });
    say('almond');
    expectOrder({ drink: 'Latte', size: 'Medium', temp: 'hot', milk: 'Almond' });
  });

  it('Back undoes the last answer', () => {
    sayAll('latte', 'medium');
    out = engine.handle({ kind: 'back' });
    expect(out.order.size).toBeUndefined();
    expectOrder({ drink: 'Latte' });
  });

  it('saying a correction mid-order: "actually, make it almond milk"', () => {
    sayAll('latte', 'medium', 'hot', 'oat');
    say('actually, make it almond milk');
    expectOrder({ drink: 'Latte', size: 'Medium', temp: 'hot', milk: 'Almond' });
  });

  it('correcting at the confirmation: "no, make it large"', () => {
    sayAll(...FULL_ORDER);
    say('no, make it large');
    expectOrder({ size: 'Large', drink: 'Latte', name: 'Sam' });
    expect(out.phase).not.toBe('done');
  });
});

describe('5. Voice recognition problem (engine side)', () => {
  // The UI side (I heard / Retry / Type instead) is checked in docs/test-cases.md.
  it('a garbled transcript fills nothing and re-offers the choices to tap', () => {
    say('lodge');
    expect(out.order.drink).toBeUndefined();
    expect(out.phase).toBe('collecting');
    expect(MENU.filter(offers).length).toBeGreaterThanOrEqual(3);
  });

  it('after a second miss, Hunter suggests tapping or typing', () => {
    sayAll('lodge', 'blarg');
    expect(out.reply.toLowerCase()).toMatch(/tap|type/);
  });
});

describe('6. Final confirmation', () => {
  it('reads back every detail before placing the order', () => {
    sayAll(...FULL_ORDER);
    const reply = out.reply.toLowerCase();
    for (const part of ['latte', 'medium', 'hot', 'oat', 'sam', '15']) expect(reply, part).toContain(part);
    expect(reply).toMatch(/\b(2|two)\b/);
    expect(out.phase).toBe('confirming');
  });

  it('does not place the order until the user says yes', () => {
    sayAll(...FULL_ORDER);
    expect(out.phase).not.toBe('done');
  });
});
