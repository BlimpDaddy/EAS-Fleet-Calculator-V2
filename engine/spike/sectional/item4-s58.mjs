/**
 * Series 58 adapter for the item-4 corpus: SOLVED + the 62.1 EXPOSED
 * disclosure joined into one map. Data untouched — one source of truth.
 */
import { SOLVED, EXPOSED } from './series58-data.mjs';

export const SOLVED_ALL = Object.fromEntries(
  Object.entries(SOLVED).map(([mid, m]) => [mid, { ...m, exposed: EXPOSED.includes(Number(mid)) }]),
);
