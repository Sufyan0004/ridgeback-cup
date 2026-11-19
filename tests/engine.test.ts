/** Engine tests for the design decisions beyond the 6 required cases. Run: npm test */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Engine, EngineOutput } from '../src/engine/types';
import { createEngine } from '../src/lib/engine';

let engine: Engine;
let out: EngineOutput;

const say = (text: string) => (out = engine.handle({ kind: 'text', text }));
const sayAll = (...lines: string[]) => lines.forEach(say);
const reply = () => out.reply.toLowerCase();

beforeEach(() => {
  engine = createEngine();
  out = engine.start();
});

describe('Natural phrasing', () => {
  it('ignores filler words', () => {
    say('um, hi, can I get uh a latte please');
    expect(out.order.drink).toBe('Latte');
  });

  it('accepts short names: "ridgeback" and "matcha"', () => {
    say('the ridgeback');
    expect(out.order.drink).toBe('Ridgeback Roast');
    engine.handle({ kind: 'restart' });
    say('a matcha');
    expect(out.order.drink).toBe('Matcha latte');
  });

  it('accepts speech-to-text spellings: "ridge back roaster"', () => {
    say('ridge back roaster');
    expect(out.order.drink).toBe('Ridgeback Roast');
  });

  it('"matcha latte" is a matcha latte, not a latte', () => {
    say('matcha latte');
    expect(out.order.drink).toBe('Matcha latte');
  });

  it('"iced coffee, black" fills temperature and no milk', () => {
    say('iced coffee, black');
    expect(out.order.drink).toBe('Coffee');
    expect(out.order.temp).toBe('iced');
    expect(out.order.milk).toBe('No milk');
  });

  it('fills many slots in one sentence and asks only for what is left', () => {
    say('two large iced oat matcha lattes with vanilla, ready in 30 minutes');
    expect(out.order.quantity).toBe(2);
    expect(out.order.size).toBe('Large');
    expect(out.order.milk).toBe('Oat');
    expect(out.order.extras).toEqual(['Vanilla syrup']);
    expect(out.order.pickup).toBe('In 30 minutes');
    expect(out.asking).toBe('name');
  });

  it('"extra large" becomes large, and Hunter says so', () => {
    say('an extra large latte');
    expect(out.order.size).toBe('Large');
    expect(reply()).toContain("don't have extra large");
    engine.handle({ kind: 'restart' });
    sayAll('latte', 'extra small');
    expect(out.order.size).toBe('Small');
    expect(reply()).toContain("don't have extra small");
  });

  it('echoes what it understood', () => {
    sayAll('latte', 'medium');
    expect(reply()).toContain('medium');
  });
});

describe('Drink rules', () => {
  it('coffee offers "No milk"; latte does not', () => {
    sayAll('coffee', 'small', 'hot');
    expect(out.quickReplies).toContain('No milk');
    engine.handle({ kind: 'restart' });
    sayAll('latte', 'small', 'hot');
    expect(out.quickReplies.includes('No milk')).toBe(false);
  });

  it('"no" to milk on a latte is explained, and milk is asked again', () => {
    sayAll('latte', 'small', 'hot', 'no');
    expect(out.order.milk).toBeUndefined();
    expect(out.asking).toBe('milk');
    expect(reply()).toContain('needs milk');
  });

  it('switching to hot chocolate keeps the size, makes it hot, drops the milk, and says so', () => {
    sayAll('a large iced latte with oat milk', 'actually make it a hot chocolate');
    expect(out.order.drink).toBe('Hot chocolate');
    expect(out.order.size).toBe('Large');
    expect(out.order.temp).toBe('hot');
    expect(out.order.milk).toBeUndefined();
    expect(reply()).toContain('only comes hot');
    expect(reply()).toContain('milk');
  });

  it('switching away from hot chocolate asks the temperature again', () => {
    sayAll('hot chocolate', 'small', 'actually a latte');
    expect(out.order.temp).toBeUndefined();
    expect(out.asking).toBe('temp');
  });
});

describe('Not on the menu', () => {
  it('suggests the closest drink, keeps the rest, and "yes" accepts it', () => {
    say('a large iced cappuccino with oat milk');
    expect(out.order.drink).toBeUndefined();
    expect(out.order.size).toBe('Large');
    expect(reply()).toContain('latte');
    expect(out.quickReplies[0]).toBe('Latte');
    say('yes');
    expect(out.order.drink).toBe('Latte');
    expect(out.order.milk).toBe('Oat');
  });

  it('food gets a drinks-only answer', () => {
    say('can I get a muffin');
    expect(reply()).toContain('only serve drinks');
  });

  it('"espresso" next to a real drink means an extra shot', () => {
    say('a latte with espresso');
    expect(out.order.drink).toBe('Latte');
    expect(out.order.extras).toEqual(['Extra espresso shot']);
  });
});

describe('Ambiguity and self-corrections', () => {
  it('"oat or almond" asks which one instead of guessing', () => {
    sayAll('latte', 'medium', 'hot', 'oat or almond');
    expect(out.order.milk).toBeUndefined();
    expect(out.asking).toBe('milk');
    expect(out.quickReplies).toEqual(['Oat', 'Almond']);
    say('almond');
    expect(out.order.milk).toBe('Almond');
  });

  it('"medium, actually large" takes the last one', () => {
    say('a medium, actually large, latte');
    expect(out.order.size).toBe('Large');
  });

  it('"almond instead of oat" ignores the negated value', () => {
    sayAll('latte', 'medium', 'hot', 'oat', 'almond instead of oat');
    expect(out.order.milk).toBe('Almond');
  });

  it('corrections work however they are phrased', () => {
    sayAll('latte', 'medium', 'hot', 'oat');
    for (const [text, milk] of [['oat milk instead', 'Oat'], ['can I switch to almond', 'Almond'], ['sorry I meant whole', 'Whole']]) {
      say(text);
      expect(out.order.milk).toBe(milk);
    }
    expect(out.asking).toBe('extras'); // still on the question Hunter was asking
  });

  it('"add" keeps existing extras; "no whipped cream" removes one', () => {
    sayAll('latte', 'medium', 'hot', 'oat', 'vanilla', 'also add whipped cream');
    expect(out.order.extras).toEqual(['Vanilla syrup', 'Whipped cream']);
    say('no whipped cream');
    expect(out.order.extras).toEqual(['Vanilla syrup']);
  });
});

describe('Read-back and controls', () => {
  const FULL = ['coffee', 'small', 'hot', 'no milk', 'no extras', '1', 'asap', 'Lee'];

  it('"no" at the read-back offers the fields to change, then returns to the read-back', () => {
    sayAll(...FULL, 'no');
    expect(out.phase).toBe('confirming');
    expect(out.quickReplies).toContain('Milk');
    say('Milk');
    expect(out.asking).toBe('milk');
    say('oat');
    expect(out.phase).toBe('confirming');
    expect(out.order.milk).toBe('Oat');
  });

  it('"yes" with a repeated detail still places the order', () => {
    sayAll(...FULL, 'yes, one small coffee');
    expect(out.phase).toBe('done');
  });

  it('Back undoes one answer at a time', () => {
    sayAll('latte', 'medium', 'hot');
    engine.handle({ kind: 'back' });
    out = engine.handle({ kind: 'back' });
    expect(out.order.size).toBeUndefined();
    expect(out.order.drink).toBe('Latte');
  });

  it('typing "start over" restarts', () => {
    sayAll('latte', 'medium', 'start over');
    expect(out.order.drink).toBeUndefined();
  });

  it('after the order is placed, extra input does not change it', () => {
    sayAll(...FULL, 'yes', 'make it large');
    expect(out.phase).toBe('done');
    expect(out.order.size).toBe('Small');
  });

  it('tapping temperature on hot chocolate explains there is nothing to change', () => {
    say('hot chocolate');
    out = engine.handle({ kind: 'edit', slot: 'temp' });
    expect(reply()).toContain('only comes hot');
  });
});

describe('Quantity and name', () => {
  it('quantity must be 1 to 10', () => {
    say('50 lattes');
    expect(out.order.quantity).toBeUndefined();
    expect(reply()).toContain('up to 10');
    say('zero');
    expect(out.order.quantity).toBeUndefined();
    say('three');
    expect(out.order.quantity).toBe(3);
  });

  it('a name is the whole answer, minus "my name is"', () => {
    sayAll('latte', 'medium', 'hot', 'oat', 'no', '1', 'asap', 'my name is jordan');
    expect(out.order.name).toBe('Jordan');
  });

  it('a name that matches a menu word is still a name', () => {
    sayAll('latte', 'medium', 'hot', 'oat', 'no', '1', 'asap', 'Mocha');
    expect(out.order.name).toBe('Mocha');
    expect(out.order.drink).toBe('Latte');
  });

  it('names longer than 20 characters are refused', () => {
    sayAll('latte', 'medium', 'hot', 'oat', 'no', '1', 'asap', 'Bartholomew Montgomery Fitzgerald');
    expect(out.order.name).toBeUndefined();
    expect(out.asking).toBe('name');
  });
});
