/**
 * FROZEN WAKE-WIDTH METRIC — sealed plan §4, verbatim:
 * p95 of |lateral offset| of wake-flagged particles, sampled over ≥ 10 s of
 * simulation across the declared downstream window (tail tip to tail tip +
 * 0.5 L), normalized to the body's maximum radius. Comparative assertions
 * require separation ≥ 0.1 in that normalized unit — no renderer units
 * appear here (round-3 F7). `worldBounds` is required to cover the window
 * (it does, by construction: wakeMarginFrac = 0.5).
 *
 * Headless: consumes engine states, knows nothing about pixels.
 */

export function makeWakeAccumulator(payload, controls) {
  const geo = (controls.smartTail && payload.extended) ? payload.extended : payload.retracted;
  const x1 = geo.extentM.x1M, L = geo.extentM.lengthM, R = geo.maxRadiusM;
  const winLo = x1, winHi = x1 + 0.5 * L;
  const samples = [];
  let simSpanS = 0, firstT = null, lastT = null;
  return {
    sample(state) {
      if (firstT === null) firstT = state.simTimeS;
      lastT = state.simTimeS;
      simSpanS = lastT - firstT;
      for (const p of state.particles) {
        if (p.wake && p.x >= winLo && p.x <= winHi) samples.push(p.r / R);   // r IS the lateral offset in 3D
      }
    },
    result() {
      if (simSpanS < 10) throw new Error(`wake metric: sampled ${simSpanS.toFixed(1)} s < the required 10 s`);
      if (!samples.length) return { p95: 0, n: 0, simSpanS };
      const s = [...samples].sort((a, b) => a - b);
      return { p95: s[Math.min(s.length - 1, Math.floor(0.95 * s.length))], n: s.length, simSpanS };
    },
  };
}
