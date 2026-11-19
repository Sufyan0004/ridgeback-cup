/** Hunter's conversation engine: applies each answer to the order and decides what Hunter says next (see docs/flowchart.md). */
import type { Engine, EngineOutput, Order, Slot, UserEvent } from './types';
import { DRINKS, EXTRAS, MAX_NAME_LENGTH, MAX_QUANTITY, MILKS, NO_MILK, PICKUPS, QUANTITY_CHOICES, SIZES, findDrink, type Drink } from './menu';
import { controlOnly, extractName, parse, type Parsed } from './matcher';

type Phase = EngineOutput['phase'];

/** The order Hunter asks in. The drink comes first because it decides which questions apply. */
const ASK_ORDER: Slot[] = ['drink', 'size', 'temp', 'milk', 'extras', 'quantity', 'pickup', 'name'];

const LABELS: Record<Slot, string> = {
  drink: 'drink', size: 'size', temp: 'temperature', milk: 'milk',
  extras: 'extras', quantity: 'quantity', pickup: 'pickup time', name: 'name',
};
const CHIP_LABELS: Record<Slot, string> = {
  drink: 'Drink', size: 'Size', temp: 'Temperature', milk: 'Milk',
  extras: 'Extras', quantity: 'Quantity', pickup: 'Pickup', name: 'Name',
};

const NUMBER_NAMES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const GREETING = "Hello! Welcome to The Ridgeback Cup. I'm Hunter, your barista. I can take your pickup order, and you can speak or type.";

interface Snapshot {
  order: Order;
  autoTemp: boolean;
}

interface Change {
  slot: Slot;
  prev: unknown;
  value: unknown;
}

// ---------- Small text helpers ----------

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const joinOr = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
/** "latte", but keep "Ridgeback Roast" capitalized. */
const drinkWord = (d: Drink, plural = false) => {
  const word = plural ? d.plural : d.name;
  return d.article === 'the' ? word : word.toLowerCase();
};
const withArticle = (d: Drink) => `${d.article} ${drinkWord(d)}`;
const countWord = (n: number) => NUMBER_NAMES[n] ?? String(n);
const pickupText = (p: string) => (p === 'ASAP' ? 'ASAP' : p.toLowerCase());
const milkText = (m: string) => (m === NO_MILK ? 'no milk' : `${m.toLowerCase()} milk`);
const extrasText = (xs: string[]) => (xs.length ? joinAnd(xs.map((x) => x.toLowerCase())) : 'no extras');
const MENU_LINE = 'We have coffee, latte, matcha latte, hot chocolate and our signature Ridgeback Roast.';

function valueText(slot: Slot, value: unknown): string {
  switch (slot) {
    case 'drink': return drinkWord(findDrink(value as string)!);
    case 'temp': return value as string;
    case 'milk': return milkText(value as string);
    case 'extras': return extrasText(value as string[]);
    case 'pickup': return pickupText(value as string);
    case 'quantity': return String(value);
    case 'name': return value as string;
    default: return String(value).toLowerCase();
  }
}

/**
 * Describe the drink part of an order: "two large iced lattes with oat milk, plus vanilla syrup".
 * Leaves out whatever isn't known yet.
 */
function describeDrink(o: Order, includeExtras = true): string {
  const d = findDrink(o.drink);
  const qty = o.quantity ?? 1;
  const parts: string[] = [];
  if (o.quantity !== undefined) parts.push(countWord(qty));
  else if (d) parts.push(d.article);
  if (o.size) parts.push(o.size.toLowerCase());
  // Skip "hot" for hot chocolate, so it doesn't read "hot hot chocolate"
  if (o.temp && !(d && d.name.toLowerCase().startsWith(o.temp))) parts.push(o.temp);
  parts.push(d ? drinkWord(d, qty > 1) : 'drink');
  // "an iced latte", not "a iced latte"
  if (parts[0] === 'a' && /^[aeiou]/.test(parts[1] ?? '')) parts[0] = 'an';
  let text = parts.join(' ');
  if (o.milk && d?.milk !== 'none') text += ` with ${milkText(o.milk)}`;
  if (includeExtras && o.extras) text += o.extras.length ? `, plus ${extrasText(o.extras)}` : ', no extras';
  return text;
}

// ---------- The engine ----------

export function createEngine(): Engine {
  let order: Order = {};
  /** True when temperature was set by a drink rule (hot chocolate), not by the user. */
  let autoTemp = false;
  let phase: Phase = 'collecting';
  /** A slot the user asked to change (ticket tap, or a clarifying question). Asked before anything else. */
  let editing: Slot | undefined;
  /** A drink Hunter just offered ("Would you like a latte?"), so a plain "yes" picks it. */
  let suggestion: string | undefined;
  /** Misunderstood answers in a row on the current question. */
  let misses = 0;
  let missSlot: Slot | 'confirm' | undefined;
  let history: Snapshot[] = [];
  /** Set by greet() and back(), which manage the history themselves. */
  let skipHistory = false;
  let last: EngineOutput;

  const drink = () => findDrink(order.drink);

  /** Whether a question applies to the current drink (hot chocolate skips temperature and milk). */
  function applies(slot: Slot): boolean {
    const d = drink();
    if (slot === 'temp') return !d || d.temps.length > 1;
    if (slot === 'milk') return !d || d.milk !== 'none';
    return true;
  }

  const nextEmpty = () => ASK_ORDER.find((s) => applies(s) && order[s] === undefined);
  const currentQuestion = () => (phase === 'done' ? undefined : editing ?? nextEmpty());

  function options(slot: Slot): string[] {
    switch (slot) {
      case 'drink': {
        const names = DRINKS.map((d) => d.name);
        return suggestion ? [suggestion, ...names.filter((n) => n !== suggestion)] : names;
      }
      case 'size': return SIZES.map((s) => s.value);
      case 'temp': return ['Hot', 'Iced'];
      case 'milk': return MILKS.map((m) => m.value).filter((m) => m !== NO_MILK || drink()?.milk === 'optional');
      case 'extras': return ['No extras', ...EXTRAS.map((e) => e.value)];
      case 'quantity': return QUANTITY_CHOICES;
      case 'pickup': return PICKUPS.map((p) => p.value);
      case 'name': return [];
    }
  }

  function question(slot: Slot): string {
    switch (slot) {
      case 'drink': return `What would you like to drink? ${MENU_LINE}`;
      case 'size': return 'What size would you like: small, medium or large?';
      case 'temp': return 'Would you like it hot or iced?';
      case 'milk':
        return drink()?.milk === 'optional'
          ? 'Which milk would you like: oat, almond, whole, or no milk?'
          : 'Which milk would you like: oat, almond or whole?';
      case 'extras': return 'Any extras? We have an extra espresso shot, vanilla syrup, caramel syrup and whipped cream.';
      case 'quantity': return `How many of those would you like? I can do up to ${MAX_QUANTITY}.`;
      case 'pickup': return 'When would you like to pick it up: ASAP, in 15 minutes or in 30 minutes?';
      case 'name': return 'And what name should I put on the cup? Please type it below.';
    }
  }

  function out(reply: string, quickReplies: string[], asking?: Slot): EngineOutput {
    last = { reply, order: structuredClone(order), quickReplies, phase, asking };
    return last;
  }

  /** Ask the next question, or read the whole order back once nothing is missing. */
  function ask(prefix = ''): EngineOutput {
    const slot = currentQuestion();
    if (!slot) {
      phase = 'confirming';
      if (missSlot !== 'confirm') { misses = 0; missSlot = 'confirm'; }
      const readback = `Just to confirm: ${describeDrink(order)}, ready ${pickupText(order.pickup!)}, for ${order.name}. You'll pay at pickup. Is that right?`;
      return out(`${prefix}${readback}`, ['Yes', 'No']);
    }
    phase = 'collecting';
    if (slot !== missSlot) { misses = 0; missSlot = slot; }
    return out(`${prefix}${question(slot)}`, options(slot), slot);
  }

  function greet(): EngineOutput {
    order = {};
    autoTemp = false;
    phase = 'collecting';
    editing = suggestion = undefined;
    history = [];
    skipHistory = true;
    misses = 0;
    missSlot = undefined;
    return ask(`${GREETING} `);
  }

  function back(): EngineOutput {
    if (phase === 'done') return out('Your order is already in! Tap Start over to place a new order.', []);
    editing = suggestion = undefined;
    skipHistory = true;
    const prev = history.pop();
    if (!prev) return ask("We're already at the start. ");
    order = prev.order;
    autoTemp = prev.autoTemp;
    return ask("Okay, I've undone that. ");
  }

  function edit(slot: Slot): EngineOutput {
    if (phase === 'done') return out('Your order is already in! Tap Start over to place a new order.', []);
    suggestion = undefined;
    const d = drink();
    if (!applies(slot) && d) {
      const why = slot === 'temp' ? `${cap(drinkWord(d))} only comes ${d.temps[0]}` : `${cap(drinkWord(d))} doesn't take a milk choice`;
      return ask(`${why}, so there's nothing to change there. `);
    }
    editing = slot;
    phase = 'collecting';
    misses = 0;
    missSlot = slot;
    return out(`Sure, let's change the ${LABELS[slot]}. ${question(slot)}`, options(slot), slot);
  }

  function placeOrder(): EngineOutput {
    phase = 'done';
    editing = suggestion = undefined;
    const qty = order.quantity ?? 1;
    const verb = qty > 1 ? 'They will' : 'It will';
    return out(
      `Your order is in! ${cap(describeDrink(order, false))}. ${verb} be ready ${pickupText(order.pickup!)}. You can pay when you pick it up. Thanks, ${order.name}!`,
      [],
    );
  }

  function miss(): EngineOutput {
    misses++;
    if (phase === 'confirming') {
      return out(
        misses >= 2
          ? "I'm still having trouble understanding. Tap Confirm order if it's right, or tap a field on the ticket to change it."
          : "Sorry, I didn't catch that. Is your order right? Say yes to place it, or tell me what to change.",
        ['Yes', 'No'],
      );
    }
    return ask(
      misses >= 2
        ? "I'm still having trouble understanding. You can tap an option below or type your answer. "
        : "Sorry, I didn't catch that. ",
    );
  }

  // ---------- Applying what the matcher found ----------

  /** Set one slot and record the change (nothing happens if it already had that value). */
  function set(changes: Change[], slot: Slot, value: unknown): void {
    const prev = order[slot];
    if (same(prev, value)) return;
    order = { ...order, [slot]: value };
    changes.push({ slot, prev, value });
  }

  /** Steps 3 and 4: apply every value the user gave, then check the drink's rules. */
  function apply(p: Parsed, changes: Change[], notes: string[]): void {
    const v = p.values;
    if (v.drink) {
      const before = order.drink;
      set(changes, 'drink', v.drink);
      // A temperature set only because of hot chocolate doesn't carry over to a new drink
      if (before !== v.drink && autoTemp && !v.temp && (findDrink(v.drink)?.temps.length ?? 0) > 1) {
        order = { ...order };
        delete order.temp;
        autoTemp = false;
      }
    }
    if (v.size) set(changes, 'size', v.size);
    if (v.temp) { set(changes, 'temp', v.temp); autoTemp = false; }
    if (v.milk) set(changes, 'milk', v.milk);
    if (v.pickup) set(changes, 'pickup', v.pickup);
    if (p.quantity !== undefined) set(changes, 'quantity', p.quantity);

    // Extras: "no extras", "vanilla and caramel", "add whipped cream", "no whipped cream"
    const { add, remove, none, additive } = p.extras;
    if (add.length || remove.length || none) {
      const current = order.extras ?? [];
      let next: string[];
      if (add.length) next = additive ? [...new Set([...current, ...add])] : add;
      else if (none) next = [];
      else next = current;
      next = next.filter((x) => !remove.includes(x));
      // Keep menu order so the ticket reads the same every time
      next = EXTRAS.map((e) => e.value).filter((x) => next.includes(x));
      set(changes, 'extras', next);
    }

    checkDrinkRules(notes);

    // "Extra large" became large: the note explains it instead of a plain "Large, got it"
    if (p.sizeSwap && order.size === p.sizeSwap.value) {
      const which = p.sizeSwap.value === 'Large' ? 'biggest' : 'smallest';
      const size = p.sizeSwap.value.toLowerCase();
      const i = changes.findIndex((c) => c.slot === 'size');
      notes.push(i >= 0
        ? `We don't have ${p.sizeSwap.said}, so I've made it a ${size}, our ${which} size.`
        : `We don't have ${p.sizeSwap.said}. A ${size} is our ${which} size, and that's what you have.`);
      if (i >= 0) changes.splice(i, 1);
    }

    // If a rule overrode a value ("iced" on hot chocolate), the note explains it, so don't echo it too
    const kept = changes.filter((c) => same(order[c.slot], c.value));
    changes.splice(0, changes.length, ...kept);
  }

  /** Step 4: keep valid answers, fix or drop the ones this drink doesn't allow, and say so. */
  function checkDrinkRules(notes: string[]): void {
    const d = drink();
    if (!d) return;
    order = { ...order };
    if (d.temps.length === 1 && order.temp !== d.temps[0]) {
      const only = d.temps[0];
      if (order.temp !== undefined) notes.push(`${cap(drinkWord(d))} only comes ${only}, so I've made it ${only}.`);
      order.temp = only;
      autoTemp = true;
    }
    if (d.milk === 'none' && order.milk !== undefined) {
      if (order.milk !== NO_MILK) notes.push(`${cap(drinkWord(d))} doesn't take a milk choice, so I've taken off the ${order.milk.toLowerCase()} milk.`);
      delete order.milk;
    }
    if (d.milk === 'required' && order.milk === NO_MILK) {
      notes.push(`${cap(withArticle(d))} needs milk.`);
      delete order.milk;
    }
  }

  /** Step 5: what Hunter says back about the changes ("Medium, got it."). */
  function echo(changes: Change[]): string {
    const lines: string[] = [];
    const fresh = changes.filter((c) => c.prev === undefined);
    const fixed = changes.filter((c) => c.prev !== undefined);

    if (fresh.length >= 2) {
      const freshSlots = new Set(fresh.map((c) => c.slot));
      const pick = (s: Slot) => (freshSlots.has(s) || (s === 'drink' && order.drink) ? order[s] : undefined);
      const partial: Order = {
        drink: pick('drink') as string | undefined,
        size: pick('size') as string | undefined,
        temp: pick('temp') as Order['temp'],
        milk: pick('milk') as string | undefined,
        extras: pick('extras') as string[] | undefined,
        quantity: pick('quantity') as number | undefined,
      };
      if (partial.drink) {
        let text = `Got it: ${describeDrink(partial)}`;
        if (freshSlots.has('pickup')) text += `, ready ${pickupText(order.pickup!)}`;
        lines.push(`${text}.`);
      } else {
        lines.push(`I've noted ${joinAnd(fresh.map((c) => valueText(c.slot, c.value)))}.`);
      }
    } else if (fresh.length === 1) {
      const { slot, value } = fresh[0];
      switch (slot) {
        case 'drink': {
          const d = findDrink(value as string)!;
          lines.push(d.article === 'the' ? `The ${d.name}, our signature!` : `${cap(withArticle(d))}, great choice.`);
          break;
        }
        case 'size': lines.push(`${value}, got it.`); break;
        case 'temp': lines.push(`${cap(value as string)} it is.`); break;
        case 'milk': lines.push(value === NO_MILK ? 'No milk.' : `${cap(milkText(value as string))}, nice.`); break;
        case 'extras': lines.push((value as string[]).length ? `${cap(extrasText(value as string[]))}, got it.` : 'No extras.'); break;
        case 'quantity': lines.push(value === 1 ? 'Just one.' : `${cap(countWord(value as number))}, got it.`); break;
        case 'pickup': lines.push(`${cap(pickupText(value as string))}, got it.`); break;
        case 'name': lines.push(`Thanks, ${value}!`); break;
      }
    }
    for (const { slot, value } of fixed) {
      if (slot === 'drink') lines.push(`Switched to ${withArticle(findDrink(value as string)!)}.`);
      else lines.push(`Changed your ${LABELS[slot]} to ${valueText(slot, value)}.`);
    }
    return lines.join(' ');
  }

  // ---------- Text answers ----------

  function handleName(text: string): EngineOutput {
    const name = extractName(text);
    if (!name) return out('I need a name for the cup. Please type your first name.', [], 'name');
    if (name.length > MAX_NAME_LENGTH) {
      return out(`That's a bit long for the cup. Could you give me a name up to ${MAX_NAME_LENGTH} characters?`, [], 'name');
    }
    const prev = order.name;
    order = { ...order, name };
    editing = undefined;
    return ask(prev && prev !== name ? `Changed the name to ${name}. ` : `Thanks, ${name}! `);
  }

  function handleText(text: string): EngineOutput {
    if (phase === 'done') {
      return controlOnly(text) === 'restart' ? greet() : out('Your order is already in! Tap Start over to place a new order.', []);
    }

    const asking = currentQuestion();

    // The name is free text: the whole answer is the name (unless it's just "start over" or "go back")
    if (asking === 'name') {
      const control = controlOnly(text);
      if (control === 'restart') return greet();
      if (control === 'back') return back();
      if (control === 'repeat') return last;
      return handleName(text);
    }

    const p = parse(text, asking);
    const gaveValues = Object.keys(p.values).length > 0 || p.quantity !== undefined || p.badQuantity !== undefined
      || p.extras.add.length > 0 || p.extras.remove.length > 0 || p.extras.none || !!p.offMenu || !!p.ambiguous;

    // Commands only count when the sentence isn't also giving an answer ("cancel the whipped cream" is an answer)
    if (!gaveValues) {
      if (p.controls.includes('restart')) return greet();
      if (p.controls.includes('back')) return back();
      if (p.controls.includes('repeat')) return last;
      if (p.controls.includes('menu')) return ask(asking === 'drink' ? '' : `${MENU_LINE} `);
    }

    // "What's in the Ridgeback Roast?" is a question, not an order
    if (p.describe && phase === 'collecting') {
      const d = findDrink(p.describe)!;
      if (!order.drink) {
        suggestion = d.name;
        return out(`${d.description} Would you like one?`, options('drink'), 'drink');
      }
      return ask(`${d.description} `);
    }

    // "Yes" to a drink Hunter just offered
    if (p.yes && suggestion && asking === 'drink' && !p.values.drink && !p.offMenu) p.values.drink = suggestion;

    // At the read-back, a plain "yes" places the order
    if (phase === 'confirming' && p.yes && !p.no && !gaveValues) return placeOrder();

    const changes: Change[] = [];
    const notes: string[] = [];

    // Step 2: problems first. Valid parts of the same sentence are still kept.
    if (p.offMenu && !p.values.drink) {
      apply(p, changes, notes);
      const lead = [echo(changes), ...notes].filter(Boolean).join(' ');
      const prefix = lead ? `${lead} ` : '';
      const { label, closest, food } = p.offMenu;
      if (order.drink) return ask(`${prefix}Sorry, we don't have ${label}, so I've kept your ${drinkWord(drink()!)}. `);
      const near = findDrink(closest);
      suggestion = near?.name;
      misses = 0;
      if (food) return out(`${prefix}Sorry, we only serve drinks right now. ${MENU_LINE} What would you like to drink?`, options('drink'), 'drink');
      if (!near) return out(`${prefix}Sorry, we don't have ${label}. ${MENU_LINE} What would you like?`, options('drink'), 'drink');
      const others = DRINKS.filter((d) => d !== near).map((d) => (d.article === 'the' ? `our signature ${d.name}` : drinkWord(d)));
      return out(
        `${prefix}Sorry, we don't have ${label}. The closest thing we have is ${withArticle(near)}. We also have ${joinAnd(others)}. Would you like ${withArticle(near)}?`,
        options('drink'),
        'drink',
      );
    }

    if (p.ambiguous) {
      const { slot, options: choices } = p.ambiguous;
      delete p.values[slot];
      apply(p, changes, notes);
      const lead = [echo(changes), ...notes].filter(Boolean).join(' ');
      editing = slot;
      const shown = choices.map((c) => valueText(slot, c));
      return out(`${lead ? `${lead} ` : ''}Did you want ${joinOr(shown)}?`, choices.map((c) => (slot === 'temp' ? cap(c) : c)), slot);
    }

    if (p.badQuantity !== undefined) {
      apply(p, changes, notes);
      const lead = [echo(changes), ...notes].filter(Boolean).join(' ');
      editing = 'quantity';
      const why = p.badQuantity > MAX_QUANTITY
        ? `I can take up to ${MAX_QUANTITY} drinks per order. For bigger orders, please order at the counter.`
        : `I need a number from 1 to ${MAX_QUANTITY}.`;
      return out(`${lead ? `${lead} ` : ''}${why} How many would you like?`, QUANTITY_CHOICES, 'quantity');
    }

    // Steps 3 and 4
    apply(p, changes, notes);

    // A clarifying question or a ticket edit is finished once that slot has been answered
    const answered = changes.some((c) => c.slot === editing) || (editing !== undefined && (editing in p.values || (editing === 'quantity' && p.quantity !== undefined) || (editing === 'extras' && (p.extras.add.length > 0 || p.extras.none))));
    if (answered) editing = undefined;

    if (changes.length || notes.length) {
      suggestion = undefined;
      misses = 0;
      return ask(`${[echo(changes), ...notes].filter(Boolean).join(' ')} `);
    }
    if (answered) return ask('Okay, no change there. ');
    // "Yes, one large latte" at the read-back: they repeated what's there and agreed
    if (phase === 'confirming' && p.yes && !p.no) return placeOrder();
    // They repeated something that's already on the order ("oat" when it's already oat)
    if (gaveValues) return ask("That's already on your order. ");

    // Nothing changed. Work out what they meant.
    if (phase === 'confirming') {
      if (p.slotNames.length) return edit(p.slotNames[0]);
      if (p.no) {
        const slots = ASK_ORDER.filter((s) => applies(s));
        return out('No problem. What would you like to change?', slots.map((s) => CHIP_LABELS[s]));
      }
      return miss();
    }
    if (asking === 'milk' && p.yes) return ask('Sure. ');
    if (p.slotNames.length && p.slotNames[0] !== asking && order[p.slotNames[0]] !== undefined) return edit(p.slotNames[0]);
    return miss();
  }

  return {
    start: greet,
    handle(event: UserEvent): EngineOutput {
      const before: Snapshot = { order: structuredClone(order), autoTemp };
      skipHistory = false;
      let result: EngineOutput;
      switch (event.kind) {
        case 'restart': return greet();
        case 'back': return back();
        case 'edit': return edit(event.slot);
        case 'text': result = handleText(event.text); break;
      }
      // Remember the order as it was, so Back can undo this answer
      if (!skipHistory && phase !== 'done' && !same(before.order, order)) history.push(before);
      return result;
    },
  };
}
