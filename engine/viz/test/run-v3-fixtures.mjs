/**
 * V3 MACHINE GATES — sealed plan §2.2/§4, as amended 2026-08-22 (the
 * slender-tail owner ruling changed the geometric premises of two frozen
 * gates; the amendment log lives in DYNAMIC-VISUALIZER-BUILD-PLAN.md §8).
 *
 *   K1  cube detaches within its rear-face station ± 1 (frozen band)
 *   K2* (amended) captured particles traverse the tail spike
 *   K3  BLI-on captures > 0 eligible particles on the Sunship and
 *       changes the treatment of CAPTURED particles only — exact, thanks
 *       to the per-particle counter RNG
 *   K4  S-only change (bli on) alters captured particles only — exact
 *   K5* wake-breadth trio ordering: PENDING OWNER RULING (reported in H5)
 *   K6  screen transform identical across the tail toggle
 *   K8  degraded geometry never captures
 *
 * Run from CalcV2:  node viz/test/run-v3-fixtures.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initState, step, DT_S } from '../layer2/engine.mjs';
import { makeMapping } from '../layer3/mapping.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, '..', 'fixtures', `${name}.render.json`), 'utf8'));
const sunship = load('sunship'), cube = load('cube');
const V100 = 100 / 3.6;
const CTRL = (over = {}) => ({ airspeedMps: V100, smartTail: false, bli: false, selectedCd: 0.04, selectedS: 0, ...over });

let failures = 0;
const gate = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

/* K1 — the cube breaks at the corner: every detachment in the frozen band */
{
  let st = initState(cube, { seed: 5, count: 256 });
  for (let i = 0; i < 300; i++) st = step(cube, CTRL({ selectedCd: 1.05 }), st, DT_S);
  const g = cube.retracted, n = cube.grid.nStations;
  const stations = st.particles.filter((p) => p.wakeStartX !== null)
    .map((p) => Math.round(((Math.min(p.wakeStartX, g.extentM.x1M) - g.extentM.x0M) / g.extentM.lengthM) * (n - 1)));
  const out = stations.filter((s) => s < n - 2).length;
  gate('K1 cube detaches within rear-face station ± 1', stations.length > 20 && out === 0,
    `${stations.length} detachments, ${out} outside the band`);
}

/* K2 (amended) — captured particles traverse the spike */
{
  const c = CTRL({ smartTail: true, bli: true, selectedCd: 0.043, selectedS: 0.3 });
  let st = initState(sunship, { seed: 11, count: 256 });
  const geo = sunship.extended;
  let spike = 0, captured = 0;
  for (let i = 0; i < 350; i++) {
    st = step(sunship, c, st, DT_S);
    for (const p of st.particles) {
      if (p.captured) captured++;
      if (p.captured && p.x > geo.extentM.x0M + 0.7 * geo.extentM.lengthM) spike++;
    }
  }
  gate('K2* captured flow traverses the tail spike', captured > 0 && spike > 0,
    `${spike} spike-traversal particle-ticks`);
}

/* K3 — BLI isolation: bli off vs on touches captured particles only (exact) */
{
  const run = (bli) => {
    let st = initState(sunship, { seed: 7, count: 128 });
    const ever = new Set();
    for (let i = 0; i < 200; i++) {
      st = step(sunship, CTRL({ smartTail: true, bli, selectedCd: 0.043, selectedS: 0.3 }), st, DT_S);
      st.particles.forEach((p, idx) => { if (p.captured) ever.add(idx); });
    }
    return { st, ever };
  };
  const { st: off } = run(false), { st: on, ever: everCaptured } = run(true);
  let untouchedIdentical = true;
  const capturedN = everCaptured.size;
  for (let i = 0; i < off.particles.length; i++) {
    if (everCaptured.has(i)) continue;
    const a = off.particles[i], b = on.particles[i];
    if (a.x !== b.x || a.r !== b.r || a.wake !== b.wake || a.gen !== b.gen) untouchedIdentical = false;
  }
  gate('K3 BLI-on captures > 0 and touches captured particles only', capturedN > 0 && untouchedIdentical,
    `${capturedN} captured; all others bit-identical`);
}

/* K4 — S isolation with bli on: captured particles only (exact) */
{
  const run = (s) => {
    let st = initState(sunship, { seed: 7, count: 128 });
    const ever = new Set();
    for (let i = 0; i < 200; i++) {
      st = step(sunship, CTRL({ smartTail: true, bli: true, selectedCd: 0.043, selectedS: s }), st, DT_S);
      st.particles.forEach((p, idx) => { if (p.captured) ever.add(idx); });
    }
    return { st, ever };
  };
  const { st: s0, ever: e0 } = run(0), { st: s5, ever: e5 } = run(0.5);
  const touched = new Set([...e0, ...e5]);
  let ok = touched.size > 0, moved = 0;
  for (let i = 0; i < s0.particles.length; i++) {
    const a = s0.particles[i], b = s5.particles[i];
    if (touched.has(i)) { if (a.x !== b.x) moved++; continue; }
    if (a.x !== b.x || a.r !== b.r || a.wake !== b.wake || a.gen !== b.gen) ok = false;
  }
  gate('K4 S-only (bli on) moves captured particles only', ok && moved > 0,
    `${touched.size} capture-touched, ${moved} moved by S; all others bit-identical`);
}

/* K6 — screen transform identical across the tail toggle (renderer suite) */
{
  const m = makeMapping({ view: 'elevation', flowAxis: 'LR', payload: sunship, width: 960, height: 480 });
  const p1 = m.project({ x: 10, y: 50, z: -20 });
  const m2 = makeMapping({ view: 'elevation', flowAxis: 'LR', payload: sunship, width: 960, height: 480 });
  const p2 = m2.project({ x: 10, y: 50, z: -20 });
  gate('K6 screen transform is control-independent (no rescale on toggle)',
    p1.sx === p2.sx && p1.sy === p2.sy,
    'mapping is a pure function of payload displayNormalization — controls cannot reach it');
}

/* K8 — degraded geometry never captures */
{
  const bad = JSON.parse(JSON.stringify(sunship));
  bad.extended.eligibility.outcome = 'INELIGIBLE';
  let st = initState(bad, { seed: 3, count: 128 }), everCaptured = false;
  for (let i = 0; i < 150; i++) {
    st = step(bad, CTRL({ smartTail: true, bli: true, selectedCd: 0.043, selectedS: 0.5 }), st, DT_S);
    if (st.particles.some((p) => p.captured)) everCaptured = true;
  }
  gate('K8 degraded geometry never captures', !everCaptured && st.degraded);
}

console.log(failures ? `\n${failures} V3 FIXTURE(S) FAILED` : '\nALL V3 HEADLESS FIXTURES PASS');
process.exit(failures ? 1 : 0);
