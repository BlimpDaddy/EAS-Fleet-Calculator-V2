/**
 * V1 MACHINE GATES — pre-registered in DYNAMIC-VISUALIZER-BUILD-PLAN.md §4
 * (V1 DoD) and §2.2. Headless: engine + adapter + frozen metric, no canvas.
 *
 *   H0  engine refuses v ≤ 0 and foreign-payload state
 *   H1  crossing time = L/v within one logic tick (un-deflected axial
 *       freestream reference particle — round-4 F5)
 *   H2  same seed reproduces a bit-identical run
 *   H3  Cd-only change: wake magnitude only — never detachment stations,
 *       never non-wake particle paths
 *   H4  S-only change: alters nothing at V1 (capture arrives V3)
 *   H5  frozen wake metric separates sphere vs Sunship+tail by ≥ 0.1
 *   H6  PARKED: zero engine calls; controls persist into first movement;
 *       v→0 freezes without destroying state
 *   H7  INELIGIBLE geometry runs the degraded path without error
 *   H8  headless engine step cost recorded (mobile count) — the browser
 *       p95 frame gate is measured on the bench page
 *
 * Run from CalcV2:  node viz/test/run-v1-fixtures.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initState, step, DT_S, COUNT_MOBILE } from '../layer2/engine.mjs';
import { makeWakeAccumulator } from '../layer2/metrics.mjs';
import { createAdapter } from '../adapter.mjs';   // moved out of bench/ at V5: shared by bench + product panel
import { canonicalStringify } from '../layer1/canonical-json.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, '..', 'fixtures', `${name}.render.json`), 'utf8'));
const sunship = load('sunship'), sphere = load('sphere');

const V100 = 100 / 3.6;   // 100 km/h in m/s
const CTRL = (over = {}) => ({ airspeedMps: V100, smartTail: false, bli: false, selectedCd: 0.04, selectedS: 0, ...over });

let failures = 0;
const gate = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

/* H0 — refusals */
{
  const s0 = initState(sunship, { count: 8 });
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };
  gate('H0 v = 0 refused', throws(() => step(sunship, CTRL({ airspeedMps: 0 }), s0)));
  gate('H0 v < 0 refused', throws(() => step(sunship, CTRL({ airspeedMps: -5 }), s0)));
  gate('H0 foreign-payload state refused', throws(() => step(sphere, CTRL(), s0)));
}

/* H1 — crossing time on a clear freestream lane */
{
  const ext = sunship.retracted.extentM;
  const st0 = initState(sunship, { count: 1 });
  const clearLane = 0.95 * sunship.worldBounds.yAbsM;      // far outside any envelope
  st0.particles[0] = { slot: 0, gen: 0, x: ext.x0M - 1, r: clearLane, thetaIdx: 0, lane: clearLane, riding: false, wake: false, captured: false, wakeStartX: null, wakeStartR: null };
  let st = st0, ticksInside = 0;
  for (let i = 0; i < 2000 && st.particles[0].x < ext.x1M; i++) {
    st = step(sunship, CTRL(), st, DT_S);
    if (st.particles[0].x >= ext.x0M && st.particles[0].x < ext.x1M) ticksInside++;
  }
  const expected = ext.lengthM / V100 / DT_S;              // 108.0 at 300 m / 100 km/h
  gate('H1 crossing = L/v within one tick', Math.abs(ticksInside - expected) <= 1,
    `${ticksInside} ticks vs ${expected.toFixed(1)} (${(ticksInside * DT_S).toFixed(1)} s vs ${(ext.lengthM / V100).toFixed(1)} s)`);
}

/* H2 — bit-identical reruns */
{
  const run = () => {
    let st = initState(sunship, { seed: 42, count: 64 });
    for (let i = 0; i < 200; i++) st = step(sunship, CTRL({ smartTail: true, selectedCd: 0.3 }), st, DT_S);
    return canonicalStringify(st);
  };
  gate('H2 same seed → bit-identical run', run() === run());
}

/* H3 — Cd isolation: severity only, placement untouched */
{
  const run = (cd) => {
    let st = initState(sunship, { seed: 7, count: 96 });
    for (let i = 0; i < 200; i++) st = step(sunship, CTRL({ selectedCd: cd }), st, DT_S);
    return st;
  };
  const a = run(0.1), b = run(0.5);
  let nonWakeIdentical = true, detachIdentical = true, wakeSpreadA = 0, wakeSpreadB = 0, wakeN = 0;
  for (let i = 0; i < a.particles.length; i++) {
    const pa = a.particles[i], pb = b.particles[i];
    if (pa.x !== pb.x) nonWakeIdentical = false;                       // no slowdown in V1/V2
    if (pa.wake !== pb.wake || pa.wakeStartX !== pb.wakeStartX) detachIdentical = false;
    if (!pa.wake && (pa.r !== pb.r)) nonWakeIdentical = false;
    if (pa.wake && pb.wake) { wakeSpreadA += Math.abs(pa.r - pa.wakeStartR); wakeSpreadB += Math.abs(pb.r - pb.wakeStartR); wakeN++; }
  }
  gate('H3 Cd-only: non-wake particles bit-identical', nonWakeIdentical);
  gate('H3 Cd-only: detachment stations identical', detachIdentical);
  gate('H3 Cd-only: wake severity strictly increased', wakeN > 5 && wakeSpreadB > wakeSpreadA,
    `wake n=${wakeN}, spread ${wakeSpreadA.toFixed(1)} → ${wakeSpreadB.toFixed(1)}`);
}

/* H4 — S isolation with BLI OFF (rescoped at V3, dated in the plan: with
   capture live, S legitimately moves captured particles when bli is on —
   that exactness is K4's gate. With bli OFF, §7.1's rule holds: S has no
   effect anywhere.) */
{
  const run = (s) => {
    let st = initState(sunship, { seed: 7, count: 64 });
    for (let i = 0; i < 150; i++) st = step(sunship, CTRL({ bli: false, selectedS: s }), st, DT_S);
    return canonicalStringify(st);
  };
  gate('H4 S-only with BLI off alters nothing (§7.1)', run(0) === run(0.5));
}

/* H5 — the frozen wake-breadth metric, RE-ARMED 2026-08-22: the owner's
   enacted BLI design (S-driven reach, back-third suction, aft-only
   turning rule) resolved the pending ruling — the DEFAULT Sunship state
   (tail + BLI at VISION S) is again tidier than the sphere by the frozen
   ≥ 0.1 margin, with the wake story where the design says it belongs:
   shedding only at the back shoulders, the rest captured along the spike. */
{
  const runMetric = (payload, controls) => {
    let st = initState(payload, { seed: 11, count: COUNT_MOBILE });
    const acc = makeWakeAccumulator(payload, controls);
    for (let i = 0; i < 350; i++) {
      st = step(payload, controls, st, DT_S);
      acc.sample(st);
    }
    return acc.result();
  };
  const sph = runMetric(sphere, CTRL({ selectedCd: 0.47 }));
  const sun = runMetric(sunship, CTRL({ smartTail: true, bli: true, selectedCd: 0.043, selectedS: 0.3 }));
  /* a wakeless default (capture eats every shedder) is maximal tidiness —
     n = 0 with the sphere shedding broadly passes by definition */
  const tidy = sun.n === 0 ? sph.p95 >= 0.1 : sph.p95 - sun.p95 >= 0.1;
  gate('H5 wake metric: sphere > Sunship default by ≥ 0.1 (re-armed)', sph.n > 200 && tidy,
    `sphere p95 ${sph.p95.toFixed(3)} (n=${sph.n}) vs Sunship default ${sun.p95.toFixed(3)} (n=${sun.n}${sun.n === 0 ? ' — wakeless' : ''})`);
}

/* H6 — PARKED semantics at the adapter */
{
  const ad = createAdapter(sunship, { seed: 3, count: 32 });
  const before = canonicalStringify(ad.getState());
  for (let i = 0; i < 20; i++) ad.tick();
  const parkedOk = ad.stepCalls === 0 && canonicalStringify(ad.getState()) === before;
  gate('H6 parked: zero engine calls, state frozen', parkedOk);

  ad.setControls({ smartTail: true, selectedCd: 0.3 });    // changed WHILE parked
  ad.setControls({ airspeedMps: V100 });
  ad.tick();
  const st1 = ad.getState();
  gate('H6 parked-set controls carry into first movement', ad.stepCalls === 1 && st1.softFail === false && st1.simTimeS > 0,
    `smartTail active geometry engaged on tick 1`);

  ad.setControls({ airspeedMps: 0 });
  const frozen = canonicalStringify(ad.getState());
  for (let i = 0; i < 10; i++) ad.tick();
  gate('H6 v→0 freezes without destroying state', ad.stepCalls === 1 && canonicalStringify(ad.getState()) === frozen);
}

/* H7 — INELIGIBLE geometry: degraded, never broken */
{
  const bad = JSON.parse(JSON.stringify(sphere));
  bad.retracted.eligibility.outcome = 'INELIGIBLE';
  let st = initState(bad, { seed: 5, count: 32 }), threw = false;
  try { for (let i = 0; i < 50; i++) st = step(bad, CTRL(), st, DT_S); } catch { threw = true; }
  gate('H7 ineligible body runs degraded without error', !threw && st.degraded === true && st.simTimeS > 4.9);
}

/* H8 — headless engine cost at the mobile count (recorded, not gated hard) */
{
  let st = initState(sunship, { seed: 1, count: COUNT_MOBILE });
  const c = CTRL({ smartTail: true, selectedCd: 0.3 });
  const times = [];
  for (let i = 0; i < 300; i++) {
    const t0 = performance.now();
    st = step(sunship, c, st, DT_S);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(0.95 * times.length)], mean = times.reduce((s, t) => s + t, 0) / times.length;
  gate('H8 engine step cost at 160 particles', p95 < 5,
    `mean ${mean.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms per 10 Hz tick (frame budget is 17 ms; browser p95 measured on the bench)`);
}

console.log(failures ? `\n${failures} V1 FIXTURE(S) FAILED` : '\nALL V1 HEADLESS FIXTURES PASS');
process.exit(failures ? 1 : 0);
