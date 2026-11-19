/**
 * FAKE ENGINE (Role 2, temporary).
 *
 * Stands in for Sufyan's real engine so the UI can be built and tested before
 * it's merged. It follows the menu and ask order in CONTEXT.md but only does
 * simple matching: one slot per turn, answers matched against the quick
 * replies. Swap it out in src/lib/engine.ts — nothing else should import it.
 */
import type { Engine, EngineOutput, Order, Slot, UserEvent } from '../engine/types';

type MilkRule = 'required' | 'optional' | 'none';
const DRINKS: Record<string, { hotOnly?: boolean; milk: MilkRule }> = {
  Coffee: { milk: 'optional' },
  Latte: { milk: 'required' },
  'Matcha latte': { milk: 'required' },
  'Hot chocolate': { hotOnly: true, milk: 'none' },
  'Ridgeback Roast': { milk: 'optional' },
};
const SIZES = ['Small', 'Medium', 'Large'];
const MILKS = ['Oat', 'Almond', 'Whole'];
const EXTRAS = ['Extra espresso shot', 'Vanilla syrup', 'Caramel syrup', 'Whipped cream'];
const PICKUPS = ['ASAP', 'In 15 minutes', 'In 30 minutes'];
const ORDER: Slot[] = ['drink', 'size', 'temp', 'milk', 'extras', 'quantity', 'pickup', 'name'];

const QUESTIONS: Record<Slot, string> = {
  drink: 'What can I get started for you?',
  size: 'What size?',
  temp: 'Hot or iced?',
  milk: 'Which milk would you like?',
  extras: 'Any extras? You can pick more than one, or say no extras.',
  quantity: 'How many cups?',
  pickup: 'When would you like to pick it up?',
  name: 'What name should I put on the cup? Please type it.',
};

function options(slot: Slot, order: Order): string[] {
  switch (slot) {
    case 'drink': return Object.keys(DRINKS);
    case 'size': return SIZES;
    case 'temp': return ['Hot', 'Iced'];
    case 'milk': return DRINKS[order.drink ?? '']?.milk === 'optional' ? [...MILKS, 'No milk'] : MILKS;
    case 'extras': return ['No extras', ...EXTRAS];
    case 'quantity': return ['1', '2', '3'];
    case 'pickup': return PICKUPS;
    case 'name': return [];
  }
}

function applies(slot: Slot, order: Order): boolean {
  const d = DRINKS[order.drink ?? ''];
  if (slot === 'temp') return !d?.hotOnly;
  if (slot === 'milk') return d?.milk !== 'none';
  return true;
}

function nextSlot(order: Order): Slot | undefined {
  return ORDER.find((s) => applies(s, order) && order[s] === undefined);
}

export function summarize(o: Order): string {
  const parts = [
    `${o.quantity ?? 1} ${o.size?.toLowerCase() ?? ''}`,
    o.temp,
    o.drink === 'Ridgeback Roast' ? o.drink : o.drink?.toLowerCase(),
    o.milk && o.milk !== 'No milk' ? `with ${o.milk.toLowerCase()} milk` : o.milk === 'No milk' ? 'with no milk' : '',
    o.extras?.length ? `plus ${o.extras.join(', ').toLowerCase()}` : '',
  ].filter(Boolean);
  return `${parts.join(' ')}, pickup ${o.pickup?.toLowerCase()}, for ${o.name}`;
}

export function createFakeEngine(): Engine {
  let order: Order = {};
  let history: Order[] = [];
  let asking: Slot | undefined;
  let phase: EngineOutput['phase'] = 'collecting';

  const out = (reply: string, quickReplies: string[] = []): EngineOutput =>
    ({ reply, order: { ...order }, quickReplies, phase, asking });

  const ask = (prefix = ''): EngineOutput => {
    const slot = nextSlot(order);
    if (!slot) {
      phase = 'confirming';
      asking = undefined;
      return out(`${prefix}Let me read that back: ${summarize(order)}. You'll pay at pickup. Is that right?`, ['Yes', 'No']);
    }
    phase = 'collecting';
    asking = slot;
    return out(prefix + QUESTIONS[slot], options(slot, order));
  };

  const set = (slot: Slot, value: unknown) => {
    history.push({ ...order });
    order = { ...order, [slot]: value };
    if (slot === 'drink') {
      // a new drink can change which questions apply
      if (DRINKS[value as string]?.hotOnly) order.temp = 'hot';
      if (DRINKS[value as string]?.milk === 'none') delete order.milk;
    }
  };

  const greet = (): EngineOutput => {
    order = {}; history = []; phase = 'collecting';
    return ask("Hi! I'm Hunter, your barista at The Ridgeback Cup. You can talk or type. ");
  };

  return {
    start: greet,
    handle(event: UserEvent): EngineOutput {
      switch (event.kind) {
        case 'restart':
          return greet();
        case 'back':
          if (!history.length) return ask("We're at the start already. ");
          order = history.pop()!;
          return ask('Okay, going back. ');
        case 'edit':
          history.push({ ...order });
          order = { ...order };
          delete order[event.slot];
          phase = 'collecting';
          asking = event.slot;
          return out(`Sure, let's change that. ${QUESTIONS[event.slot]}`, options(event.slot, order));
        case 'text': {
          const text = event.text.trim();
          const lower = text.toLowerCase();
          if (phase === 'done') return out('Your order is already in. Tap Start over to place a new one.', ['Start over']);
          if (phase === 'confirming') {
            if (/^(yes|yeah|yep|correct|confirm)/.test(lower)) {
              phase = 'done'; asking = undefined;
              return out(`Your order is confirmed. Thanks, ${order.name}! See you ${order.pickup?.toLowerCase()}.`, ['Start over']);
            }
            return out('No problem. Tap any field on the ticket to change it, or say what to change.', ['Yes', 'No']);
          }
          const slot = asking ?? nextSlot(order);
          if (!slot) return ask();
          if (slot === 'name') {
            if (!text) return out('I need a name for the cup.');
            set('name', text.replace(/^(it'?s|my name is|i'?m)\s+/i, ''));
            return ask(`Thanks, ${order.name}. `);
          }
          if (slot === 'quantity') {
            const n = parseInt(lower.replace(/\bone\b/, '1').replace(/\btwo\b/, '2').replace(/\bthree\b/, '3'), 10);
            if (!(n >= 1 && n <= 10)) return out("Sorry, how many would you like? Between 1 and 10.", options(slot, order));
            set('quantity', n);
            return ask(`${n}, got it. `);
          }
          if (slot === 'extras' && /\b(no|none|nothing)\b/.test(lower)) {
            set('extras', []);
            return ask('No extras. ');
          }
          const opts = options(slot, order);
          const hits = opts.filter((o) => lower.includes(o.toLowerCase()))
            // "matcha latte" contains "latte": prefer the longest match
            .sort((a, b) => b.length - a.length);
          if (!hits.length) {
            return out(`Sorry, I didn't catch that. ${QUESTIONS[slot]} You can choose: ${opts.join(', ')}.`, opts);
          }
          if (slot === 'extras') {
            set('extras', hits);
            return ask(`${hits.join(' and ')}, got it. `);
          }
          const value = slot === 'temp' ? hits[0].toLowerCase() : hits[0];
          set(slot, value);
          return ask(`${hits[0]}, got it. `);
        }
      }
    },
  };
}
