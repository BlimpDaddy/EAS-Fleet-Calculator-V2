/**
 * BENCH ADAPTER — the page-side harness role, headless-testable.
 *
 * Owns what the engine deliberately does not: the PARKED rule (at v = 0 the
 * engine is NEVER consulted — M3; `stepCalls` counts every consultation so
 * the fixture can assert zero), control persistence while parked, and state
 * reset on payload change (round-3 F2). The real DYNAMIC page adapter will
 * do exactly this against the page's canonical control state; the bench
 * uses it directly.
 */
import { initState, step, DT_S, COUNT_DESKTOP } from './layer2/engine.mjs';

export function createAdapter(payload, { seed = 1, count = COUNT_DESKTOP } = {}) {
  let state = initState(payload, { seed, count });
  let controls = { airspeedMps: 0, smartTail: false, bli: false, selectedCd: 0.04, selectedS: 0 };
  let stepCalls = 0;
  return {
    setControls(partial) { controls = { ...controls, ...partial }; },  // persists while parked
    getControls() { return { ...controls }; },
    get parked() { return !(controls.airspeedMps > 0); },
    get stepCalls() { return stepCalls; },
    getState() { return state; },
    setPayload(newPayload, { seed: s = seed, count: c = count } = {}) {
      state = initState(newPayload, { seed: s, count: c });                // deterministic reset
      payload = newPayload;
    },
    tick(dt = DT_S) {
      if (!(controls.airspeedMps > 0)) return false;                      // PARKED: zero engine calls
      state = step(payload, controls, state, dt);
      stepCalls++;
      return true;
    },
  };
}
