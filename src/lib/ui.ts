import type { Order, Slot } from '../engine/types';

export type HunterState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type Message = {
  id: number;
  from: 'hunter' | 'user';
  text: string;
  viaVoice?: boolean; // user message came from speech-to-text ("I heard: …")
};

export const SLOT_LABELS: Record<Slot, string> = {
  drink: 'Drink',
  size: 'Size',
  temp: 'Temperature',
  milk: 'Milk',
  extras: 'Extras',
  quantity: 'Quantity',
  pickup: 'Pickup',
  name: 'Name',
};

export const SLOTS: Slot[] = ['drink', 'size', 'temp', 'milk', 'extras', 'quantity', 'pickup', 'name'];

export function formatSlot(order: Order, slot: Slot): string | undefined {
  const v = order[slot];
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'None';
  if (slot === 'temp') return v === 'iced' ? 'Iced' : 'Hot';
  return String(v);
}
