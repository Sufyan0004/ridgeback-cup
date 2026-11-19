/**
 * The single place the UI gets its conversation engine from.
 * The real engine lives in src/engine/; fakeEngine.ts is the old stand-in, kept for reference.
 */
import type { Engine } from '../engine/types';
import { createEngine as createConversationEngine } from '../engine/engine';

export function createEngine(): Engine {
  return createConversationEngine();
}
