/** The Ridgeback Cup menu: every value Hunter understands, the words that mean it, and each drink's rules. */
export type Temp = 'hot' | 'iced';

/**
 * required: Hunter asks which milk; "No milk" isn't offered (a latte needs milk).
 * optional: Hunter asks which milk and also offers "No milk" (coffee can be black).
 * none:     Hunter skips the milk question entirely (hot chocolate).
 */
export type MilkRule = 'required' | 'optional' | 'none';

export interface Drink {
  /** Display name; also the value stored in the order. */
  name: string;
  /** Used in the read-back for more than one ("2 medium lattes"). */
  plural: string;
  /** "a latte", but "the Ridgeback Roast". */
  article: 'a' | 'the';
  /** Words and phrases that mean this drink. */
  keywords: string[];
  /** Allowed temperatures. One entry means the temperature question is skipped. */
  temps: Temp[];
  milk: MilkRule;
  /** What Hunter says when asked "what's in the ...?" */
  description: string;
}

export const DRINKS: Drink[] = [
  {
    name: 'Coffee',
    plural: 'coffees',
    article: 'a',
    keywords: ['coffee', 'drip coffee', 'brewed coffee', 'regular coffee', 'house coffee', 'filter coffee', 'cup of coffee', 'cup of joe'],
    temps: ['hot', 'iced'],
    milk: 'optional',
    description: 'Our coffee is a fresh house brew. You can have it hot or iced, black or with milk.',
  },
  {
    name: 'Latte',
    plural: 'lattes',
    article: 'a',
    keywords: ['latte', 'caffe latte', 'cafe latte', 'lattay', 'lattee'],
    temps: ['hot', 'iced'],
    milk: 'required',
    description: 'A latte is espresso with steamed milk, hot or iced.',
  },
  {
    name: 'Matcha latte',
    plural: 'matcha lattes',
    article: 'a',
    keywords: ['matcha latte', 'matcha', 'macha', 'macha latte', 'matcha tea', 'matcha green tea', 'green tea latte', 'match a latte'],
    temps: ['hot', 'iced'],
    milk: 'required',
    description: 'Our matcha latte is Japanese green tea powder whisked with milk, hot or iced.',
  },
  {
    name: 'Hot chocolate',
    plural: 'hot chocolates',
    article: 'a',
    keywords: ['hot chocolate', 'hot cocoa', 'cocoa', 'chocolate', 'hot choc', 'hot coco'],
    temps: ['hot'],
    milk: 'none',
    description: 'Our hot chocolate is rich chocolate made with steamed milk. It only comes hot.',
  },
  {
    name: 'Ridgeback Roast',
    plural: 'Ridgeback Roasts',
    article: 'the',
    keywords: [
      'ridgeback roast', 'ridge back roast', 'ridgeback roaster', 'ridge back roaster', 'ridgeback roast coffee',
      'ridgeback', 'ridge back', 'ridgeback coffee', 'dark roast', 'dark roast coffee', 'roast',
      'special', 'the special', 'house special', 'signature', 'signature drink',
    ],
    temps: ['hot', 'iced'],
    milk: 'optional',
    description: 'The Ridgeback Roast is our signature: dark roast coffee with an extra espresso shot and maple syrup. Built for long study days.',
  },
];

export interface Choice {
  value: string;
  keywords: string[];
}

export const SIZES: Choice[] = [
  { value: 'Small', keywords: ['small', 'smaller', 'smallest', 'little', 'short'] },
  { value: 'Medium', keywords: ['medium', 'regular', 'regular size', 'normal', 'normal size', 'mid', 'middle', 'grande'] },
  { value: 'Large', keywords: ['large', 'larger', 'largest', 'big', 'bigger', 'biggest'] },
];

/** Sizes we don't sell. Hunter uses the nearest size and says so. */
export const OFF_SIZES: { said: string; value: string; keywords: string[] }[] = [
  { said: 'extra large', value: 'Large', keywords: ['extra large', 'xl', 'x large', 'extra big', 'venti', 'huge', 'jumbo', 'massive'] },
  { said: 'extra small', value: 'Small', keywords: ['extra small', 'xs', 'x small', 'tiny', 'kids size', 'kid size'] },
];

export const TEMPS: { value: Temp; keywords: string[] }[] = [
  { value: 'hot', keywords: ['hot', 'warm', 'heated'] },
  { value: 'iced', keywords: ['iced', 'ice', 'icy', 'cold', 'on ice', 'over ice', 'chilled'] },
];

export const NO_MILK = 'No milk';

export const MILKS: Choice[] = [
  { value: 'Oat', keywords: ['oat', 'oat milk', 'oatmilk', 'oatly'] },
  { value: 'Almond', keywords: ['almond', 'almond milk', 'almondmilk'] },
  { value: 'Whole', keywords: ['whole', 'whole milk', 'hole milk', 'regular milk', 'normal milk', 'dairy milk', 'cow milk', 'cows milk', 'homo milk', 'full fat milk'] },
  { value: NO_MILK, keywords: ['no milk', 'without milk', 'black', 'hold the milk', 'skip the milk', 'no milk please'] },
];

export const EXTRAS: Choice[] = [
  {
    value: 'Extra espresso shot',
    keywords: ['extra espresso shot', 'extra shot', 'espresso shot', 'extra espresso', 'shot of espresso', 'extra shot of espresso', 'double shot', 'add a shot', 'shot'],
  },
  { value: 'Vanilla syrup', keywords: ['vanilla syrup', 'vanilla', 'french vanilla', 'vanilla flavour', 'vanilla flavor'] },
  { value: 'Caramel syrup', keywords: ['caramel syrup', 'caramel', 'carmel', 'caramel drizzle', 'caramel sauce'] },
  { value: 'Whipped cream', keywords: ['whipped cream', 'whip cream', 'whipped', 'whip', 'whipping cream', 'cream on top'] },
];

/** Always means "no extras", whatever Hunter asked. */
export const NO_EXTRAS_KEYWORDS = [
  'no extras', 'no extra', 'nothing extra', 'no add ons', 'no addons', 'no toppings', 'without extras', 'none of those', 'none of them',
];

export const PICKUPS: Choice[] = [
  { value: 'ASAP', keywords: ['asap', 'a s a p', 'as soon as possible', 'soon as possible', 'right now', 'right away', 'straight away', 'immediately', 'as soon as you can', 'as fast as possible'] },
  { value: 'In 15 minutes', keywords: ['in 15 minutes', '15 minutes', 'fifteen minutes', '15 min', 'fifteen min', 'in 15', 'in fifteen', 'quarter of an hour', 'quarter hour'] },
  { value: 'In 30 minutes', keywords: ['in 30 minutes', '30 minutes', 'thirty minutes', '30 min', 'thirty min', 'in 30', 'in thirty', 'half an hour', 'half hour'] },
];

/**
 * Words that only make sense as an answer to the question Hunter just asked.
 * "No" means "no extras" while he's asking about extras, "no milk" while he's
 * asking about milk, and nothing in particular otherwise.
 */
export const CONTEXT_WORDS: { slot: 'extras' | 'milk' | 'pickup'; value: string; keywords: string[] }[] = [
  {
    slot: 'extras', value: '', // '' = no extras
    keywords: ['no', 'none', 'nothing', 'nope', 'nah', 'no thanks', 'no thank you', 'thats it', 'thats all', 'that is all', 'thats everything', 'just that', 'im good', 'all good', 'not today', 'skip', 'pass', 'no need'],
  },
  { slot: 'milk', value: NO_MILK, keywords: ['no', 'none', 'nope', 'nah', 'no thanks', 'no thank you', 'without', 'skip'] },
  { slot: 'pickup', value: 'ASAP', keywords: ['now', 'soon', 'quick', 'quickly', 'fast', 'whenever'] },
  { slot: 'pickup', value: 'In 15 minutes', keywords: ['15', 'fifteen', 'quarter'] },
  { slot: 'pickup', value: 'In 30 minutes', keywords: ['30', 'thirty', 'half'] },
];

/**
 * Things people ask for that aren't on the menu, and the closest drink we have.
 * No closest drink = Hunter just lists the menu. food = Hunter explains it's drinks only.
 */
export const OFF_MENU: { keywords: string[]; closest?: string; food?: boolean }[] = [
  {
    keywords: ['cappuccino', 'capuccino', 'cappucino', 'flat white', 'cortado', 'macchiato', 'latte macchiato', 'caramel macchiato', 'breve', 'cafe au lait', 'au lait'],
    closest: 'Latte',
  },
  { keywords: ['americano', 'espresso', 'cold brew', 'long black', 'red eye', 'frappuccino', 'frappe', 'iced capp', 'ice capp'], closest: 'Coffee' },
  { keywords: ['mocha', 'white mocha', 'mochaccino', 'chocolate milk'], closest: 'Hot chocolate' },
  {
    keywords: ['chai', 'chai latte', 'dirty chai', 'tea', 'green tea', 'black tea', 'earl grey', 'london fog', 'herbal tea', 'iced tea', 'bubble tea', 'boba'],
    closest: 'Matcha latte',
  },
  { keywords: ['smoothie', 'juice', 'lemonade', 'water', 'soda', 'milkshake', 'shake'] },
  { keywords: ['muffin', 'cookie', 'croissant', 'bagel', 'sandwich', 'donut', 'doughnut', 'cake', 'scone', 'food', 'snack', 'pastry', 'breakfast'], food: true },
];

export const QUANTITY_CHOICES = ['1', '2', '3'];
export const MAX_QUANTITY = 10;
export const MAX_NAME_LENGTH = 20;

export function findDrink(name: string | undefined): Drink | undefined {
  return DRINKS.find((d) => d.name === name);
}
