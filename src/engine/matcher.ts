/** Reads one user sentence and finds values for every slot, plus negations, corrections and ambiguity. */
import type { Slot } from './types';
import { CONTEXT_WORDS, DRINKS, EXTRAS, MAX_QUANTITY, MILKS, NO_EXTRAS_KEYWORDS, OFF_MENU, OFF_SIZES, PICKUPS, SIZES, TEMPS } from './menu';

export type Control = 'restart' | 'back' | 'repeat' | 'menu';
type Marker = 'correct' | 'or' | 'add' | 'describe';
type SingleSlot = 'drink' | 'size' | 'temp' | 'milk' | 'pickup';

type Entry = { phrase: string[]; context?: Slot } & (
  | { kind: 'value'; slot: SingleSlot | 'extras'; value: string; said?: string }
  | { kind: 'noExtras' }
  | { kind: 'offMenu'; closest?: string; food?: boolean }
  | { kind: 'control'; control: Control }
  | { kind: 'slotName'; slot: Slot }
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'marker'; marker: Marker }
);

type Hit = { entry: Entry; start: number; end: number } | { entry: { kind: 'number'; n: number }; start: number; end: number };

export interface Parsed {
  /** One value per single-choice slot that the user clearly gave. */
  values: Partial<Record<SingleSlot, string>>;
  /** Two different values for one slot with no way to tell which they meant ("oat or almond"). */
  ambiguous?: { slot: SingleSlot; options: string[] };
  extras: {
    add: string[];      // extras mentioned ("vanilla and caramel")
    remove: string[];   // extras negated ("no whipped cream")
    none: boolean;      // "no extras"
    additive: boolean;  // "add vanilla", "also caramel": keep the existing ones
  };
  /** A size we don't sell ("extra large") that was swapped for the nearest one. */
  sizeSwap?: { said: string; value: string };
  /** A valid quantity (1 to MAX_QUANTITY). */
  quantity?: number;
  /** A number outside the allowed range ("50"). */
  badQuantity?: number;
  /** Something that isn't on our menu ("a cappuccino"). */
  offMenu?: { label: string; closest?: string; food: boolean };
  controls: Control[];
  /** Slots named without a value ("change the milk"). */
  slotNames: Slot[];
  yes: boolean;
  no: boolean;
  /** "What's in the Ridgeback Roast?": a question about a drink, not an order for one. */
  describe?: string;
  /** Nothing at all was recognized. */
  empty: boolean;
}

// ---------- Vocabulary that isn't menu data ----------

const CONTROL_WORDS: Record<Control, string[]> = {
  restart: ['start over', 'restart', 'start again', 'begin again', 'reset', 'new order', 'cancel my order', 'cancel order', 'cancel'],
  back: ['go back', 'undo', 'undo that', 'previous question', 'back up'],
  repeat: ['repeat', 'repeat that', 'say that again', 'come again', 'pardon', 'what did you say'],
  menu: ['menu', 'whats on the menu', 'what do you have', 'what do you sell', 'what drinks', 'what drinks do you have', 'what are my options', 'what are the options', 'options', 'help', 'what can i order', 'what do you offer'],
};

const SLOT_WORDS: Record<Slot, string[]> = {
  drink: ['drink', 'beverage'],
  size: ['size', 'cup size'],
  temp: ['temperature', 'temp'],
  milk: ['milk', 'milk choice'],
  extras: ['extras', 'extra', 'add ons', 'addons', 'toppings', 'syrup'],
  quantity: ['quantity', 'how many', 'amount', 'number of drinks', 'number of cups'],
  pickup: ['pickup', 'pick up', 'pickup time', 'pick up time', 'time'],
  name: ['name', 'cup name'],
};

const YES_WORDS = [
  'yes', 'yeah', 'yep', 'yup', 'ya', 'yea', 'yah', 'sure', 'correct', 'right', 'thats right', 'that is right', 'perfect', 'ok', 'okay',
  'confirm', 'confirmed', 'absolutely', 'definitely', 'sounds good', 'looks good', 'all good', 'great', 'good', 'yes please', 'sure thing',
  'of course', 'go ahead', 'place it', 'place the order', 'place my order', 'do it',
];
const NO_WORDS = ['no', 'nope', 'nah', 'not quite', 'wrong', 'incorrect', 'thats wrong', 'not right', 'thats not right'];

const MARKER_WORDS: Record<Marker, string[]> = {
  // A later value replaces an earlier one: "medium, actually large"
  correct: ['actually', 'i mean', 'sorry', 'wait', 'no wait', 'instead', 'rather', 'change', 'change it to', 'make it', 'switch', 'switch to', 'scratch that', 'on second thought'],
  // Real ambiguity: "oat or almond"
  or: ['or', 'either'],
  // Keep the existing extras: "add vanilla", "also caramel"
  add: ['add', 'also', 'plus', 'as well', 'too', 'another'],
  // A question about a drink rather than an order: "what's in the Ridgeback Roast?"
  describe: ['whats in', 'what is in', 'whats the', 'what is the', 'whats a', 'what is a', 'tell me about', 'describe', 'what kind of', 'whats that', 'what is that'],
};

/** Words right before a value that cancel it: "not oat", "no whipped cream". */
const NEGATORS = new Set(['not', 'no', 'without', 'minus', 'remove', 'hold', 'skip']);
/** Two-word negators: "almond instead of oat". */
const NEGATOR_PAIRS = [['instead', 'of'], ['rather', 'than'], ['dont', 'want'], ['take', 'off'], ['get', 'rid']];

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, dozen: 12, couple: 2,
};

// ---------- Text handling ----------

/** Lowercase, drop apostrophes and punctuation, split into words. "I'd like 2 Lattes!" → ["id","like","2","lattes"] */
export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘`']/g, '')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** Crude singular, so "lattes", "oats" and "minutes" match "latte", "oat" and "minute". */
const stem = (word: string) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);
const toWords = (phrase: string) => normalize(phrase).map(stem);

function toNumber(word: string): number | undefined {
  if (/^\d+$/.test(word)) return parseInt(word, 10);
  return NUMBER_WORDS[word];
}

// ---------- Build the vocabulary once ----------

const ENTRIES: Entry[] = (() => {
  const list: Entry[] = [];
  const add = (phrases: string[], make: (phrase: string[]) => Entry) => phrases.forEach((p) => list.push(make(toWords(p))));

  for (const d of DRINKS) add(d.keywords, (phrase) => ({ phrase, kind: 'value', slot: 'drink', value: d.name }));
  for (const s of SIZES) add(s.keywords, (phrase) => ({ phrase, kind: 'value', slot: 'size', value: s.value }));
  for (const s of OFF_SIZES) add(s.keywords, (phrase) => ({ phrase, kind: 'value', slot: 'size', value: s.value, said: s.said }));
  for (const t of TEMPS) add(t.keywords, (phrase) => ({ phrase, kind: 'value', slot: 'temp', value: t.value }));
  for (const m of MILKS) add(m.keywords, (phrase) => ({ phrase, kind: 'value', slot: 'milk', value: m.value }));
  for (const e of EXTRAS) add(e.keywords, (phrase) => ({ phrase, kind: 'value', slot: 'extras', value: e.value }));
  for (const p of PICKUPS) add(p.keywords, (phrase) => ({ phrase, kind: 'value', slot: 'pickup', value: p.value }));
  add(NO_EXTRAS_KEYWORDS, (phrase) => ({ phrase, kind: 'noExtras' }));
  for (const c of CONTEXT_WORDS) {
    add(c.keywords, (phrase) =>
      c.slot === 'extras' ? { phrase, context: 'extras', kind: 'noExtras' } : { phrase, context: c.slot, kind: 'value', slot: c.slot, value: c.value });
  }
  for (const o of OFF_MENU) add(o.keywords, (phrase) => ({ phrase, kind: 'offMenu', closest: o.closest, food: o.food }));
  for (const [control, words] of Object.entries(CONTROL_WORDS)) add(words, (phrase) => ({ phrase, kind: 'control', control: control as Control }));
  for (const [slot, words] of Object.entries(SLOT_WORDS)) add(words, (phrase) => ({ phrase, kind: 'slotName', slot: slot as Slot }));
  add(YES_WORDS, (phrase) => ({ phrase, kind: 'yes' }));
  add(NO_WORDS, (phrase) => ({ phrase, kind: 'no' }));
  for (const [marker, words] of Object.entries(MARKER_WORDS)) add(words, (phrase) => ({ phrase, kind: 'marker', marker: marker as Marker }));

  // Longest phrases first; at equal length, words that depend on the question come first.
  return list.sort((a, b) => b.phrase.length - a.phrase.length || Number(!!b.context) - Number(!!a.context));
})();

function matchesAt(words: string[], i: number, phrase: string[]): boolean {
  if (i + phrase.length > words.length) return false;
  return phrase.every((p, k) => words[i + k] === p);
}

/** Step 2: find every phrase and number in the sentence, longest match first. */
function scan(words: string[], asking: Slot | undefined): Hit[] {
  const hits: Hit[] = [];
  for (let i = 0; i < words.length; ) {
    const entry = ENTRIES.find((e) => (!e.context || e.context === asking) && matchesAt(words, i, e.phrase));
    if (entry) {
      hits.push({ entry, start: i, end: i + entry.phrase.length });
      i += entry.phrase.length;
      continue;
    }
    const n = toNumber(words[i]);
    if (n !== undefined) hits.push({ entry: { kind: 'number', n }, start: i, end: i + 1 });
    i++;
  }
  return hits;
}

function isNegated(words: string[], start: number): boolean {
  if (NEGATORS.has(words[start - 1])) return true;
  return NEGATOR_PAIRS.some(([a, b]) => words[start - 2] === a && words[start - 1] === b);
}

const unique = <T,>(xs: T[]) => [...new Set(xs)];

/**
 * Read one sentence. `asking` is the slot Hunter just asked about: it decides what
 * context words like "no" or "15" mean.
 */
export function parse(text: string, asking?: Slot): Parsed {
  const raw = normalize(text);
  const words = raw.map(stem);
  const hits = scan(words, asking);
  const kinds = (k: string) => hits.filter((h) => h.entry.kind === k);
  const markerAt = (m: Marker, from: number, to: number) =>
    hits.some((h) => h.entry.kind === 'marker' && h.entry.marker === m && h.start >= from && h.start < to);

  const parsed: Parsed = {
    values: {},
    extras: { add: [], remove: [], none: false, additive: false },
    controls: unique(kinds('control').map((h) => (h.entry as { control: Control }).control)),
    slotNames: unique(kinds('slotName').map((h) => (h.entry as { slot: Slot }).slot)),
    yes: kinds('yes').length > 0,
    no: kinds('no').length > 0,
    empty: hits.every((h) => h.entry.kind === 'marker'),
  };

  // Values, minus the negated ones ("not oat")
  const valueHits = hits.filter((h) => h.entry.kind === 'value') as { entry: Extract<Entry, { kind: 'value' }>; start: number; end: number }[];
  const kept = valueHits.filter((h) => !isNegated(raw, h.start));
  const negated = valueHits.filter((h) => isNegated(raw, h.start));

  // Single-choice slots: one value, a self-correction (take the last), or ambiguity (ask)
  for (const slot of ['drink', 'size', 'temp', 'milk', 'pickup'] as SingleSlot[]) {
    const mine = kept.filter((h) => h.entry.slot === slot);
    const distinct = unique(mine.map((h) => h.entry.value));
    if (distinct.length === 1) parsed.values[slot] = distinct[0];
    else if (distinct.length > 1) {
      const from = mine[0].start;
      const to = mine[mine.length - 1].start;
      if (!markerAt('or', from, to) && markerAt('correct', from, to)) parsed.values[slot] = mine[mine.length - 1].entry.value;
      else parsed.ambiguous ??= { slot, options: distinct };
    }
  }

  // "Extra large": remember what they said, so Hunter can explain the swap
  const sizeHit = [...kept].reverse().find((h) => h.entry.slot === 'size' && h.entry.value === parsed.values.size);
  if (sizeHit?.entry.said) parsed.sizeSwap = { said: sizeHit.entry.said, value: sizeHit.entry.value };

  // Extras can be several at once
  parsed.extras.add = unique(kept.filter((h) => h.entry.slot === 'extras').map((h) => h.entry.value));
  parsed.extras.remove = unique(negated.filter((h) => h.entry.slot === 'extras').map((h) => h.entry.value));
  parsed.extras.none = kinds('noExtras').length > 0;
  parsed.extras.additive = markerAt('add', 0, words.length);

  // Not on the menu
  const off = kinds('offMenu')[0];
  if (off) {
    const e = off.entry as Extract<Entry, { kind: 'offMenu' }>;
    const label = raw.slice(off.start, off.end).join(' ');
    // "espresso" next to a real drink, or while picking extras, means an extra shot
    if (label === 'espresso' && (parsed.values.drink || (asking && asking !== 'drink'))) {
      parsed.extras.add = unique([...parsed.extras.add, 'Extra espresso shot']);
    } else {
      parsed.offMenu = { label, closest: e.closest, food: !!e.food };
    }
  }

  // Quantity: the first number, or the last one after a self-correction ("2... actually 3")
  const numbers = hits.filter((h) => h.entry.kind === 'number').map((h) => (h.entry as { n: number }).n);
  if (numbers.length) {
    const n = markerAt('correct', 0, words.length) ? numbers[numbers.length - 1] : numbers[0];
    if (n >= 1 && n <= MAX_QUANTITY) parsed.quantity = n;
    else parsed.badQuantity = n;
  }

  // "What's in the Ridgeback Roast?"
  if (markerAt('describe', 0, words.length) && parsed.values.drink) parsed.describe = parsed.values.drink;

  return parsed;
}

/** The name is the whole answer, minus "my name is", "it's", "please" and similar. */
export function extractName(text: string): string {
  const name = text
    .trim()
    .replace(/[.!?,;:]+$/g, '')
    .replace(/^(hi|hey|hello)[,!\s]+/i, '')
    .replace(/^(my name is|my names|my name's|name is|the name is|it is|it's|its|i am|i'm|im|this is|call me|put|use|for)\s+/i, '')
    .replace(/\s+(please|thanks|thank you)$/i, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** True when the whole message is just a control phrase ("start over"), so it isn't taken as a name. */
export function controlOnly(text: string): Control | undefined {
  const words = normalize(text).map(stem);
  for (const [control, phrases] of Object.entries(CONTROL_WORDS)) {
    if (phrases.some((p) => toWords(p).join(' ') === words.join(' '))) return control as Control;
  }
  return undefined;
}
