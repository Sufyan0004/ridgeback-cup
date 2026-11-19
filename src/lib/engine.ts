/**
 * The single place the UI gets its conversation engine from.
 * When Sufyan's engine is merged, replace the fake with the real one here.
 */
import type { Engine } from '../engine/types';
import { createFakeEngine } from './fakeEngine';

export function createEngine(): Engine {
  return createFakeEngine();
}
