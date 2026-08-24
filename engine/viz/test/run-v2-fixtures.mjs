/**
 * V2 MACHINE GATES — sealed plan §4 (V2 DoD): one engine state renders
 * correctly in all three views; view-mapping anchors green for every
 * view × flowAxis combination including portrait; frontal occlusion gate.
 * Headless — the mapping module is pure arithmetic.
 *
 * The fixtures duplicate the mapping SPEC's arithmetic independently where
 * exactness is asserted — that duplication is the point: two competent
 * implementers must land on the same pixels.
 *
 * Run from CalcV2:  node viz/test/run-v2-fixtures.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMapping, frontalVisible, hullOutline } from '../layer3/mapping.mjs';
import { initState, step, DT_S } from '../layer2/engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, '..', 'fixtures', `${name}.render.json`), 'utf8'));
const sunship = load('sunship'), sphere = load('sphere');
const W = 960, H = 480;
const V100 = 100 / 3.6;
const CTRL = (over = {}) => ({ airspeedMps: V100, smartTail: false, bli: false, selectedCd: 0.04, selectedS: 0, ...over });

let failures = 0;
const gate = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

/* J1 — anchors, all six view × flowAxis combinations.
   AMENDED 2026-08-23 (wide-instrument owner ruling): sphere 1 sits at
   the VIEW_UP/(VIEW_UP+VIEW_DOWN) = 2.0/5.2 station ALONG THE FLOW AXIS
   (left in LR, upper in TB) — the wake gets the run-out, the approach
   stays put. The CROSS axis stays centred; frontal stays fully centred.
   The fixture keeps its independent arithmetic: 2.0/5.2 is written out
   here, not imported.
   AMENDED 2026-08-24 (M7 portrait layout): the sphere scale rides the
   CROSS-FLOW screen dimension — height in LR (unchanged), WIDTH in TB
   (the portrait instrument is the 2.6 rectangle turned tall), the short
   side in frontal. The TB span arithmetic below is width-based. */
{
  const ret = sunship.retracted.extentM;
  const c = sunship.spheres.sphere1.centerM;
  const frac = sunship.displayNormalization.sphere1ViewportFrac;
  const r1 = sunship.spheres.sphere1.radiusM;
  const F = 2.0 / 5.2;                                       // VIEW_UP / (VIEW_UP + VIEW_DOWN)
  for (const view of ['elevation', 'plan', 'frontal']) {
    for (const flowAxis of ['LR', 'TB']) {
      const m = makeMapping({ view, flowAxis, payload: sunship, width: W, height: H });
      const a = m.anchors();
      const k = ((view === 'frontal' ? Math.min(W, H) : flowAxis === 'TB' ? W : H) * frac) / r1;
      const wantX = view === 'frontal' ? W / 2 : (flowAxis === 'TB' ? W / 2 : W * F);
      const wantY = view === 'frontal' ? H / 2 : (flowAxis === 'TB' ? H * F : H / 2);
      let ok = close(a.sphere1Center.sx, wantX) && close(a.sphere1Center.sy, wantY);
      if (view !== 'frontal') {
        const span = flowAxis === 'TB' ? a.tail.sy - a.nose.sy : a.tail.sx - a.nose.sx;
        ok = ok && close(span, ret.lengthM * k, 1e-6)          // nose→tail spacing exact
          && (flowAxis === 'TB' ? a.flowScreenDir.dy === 1 : a.flowScreenDir.dx === 1);
      } else {
        ok = ok && a.flowScreenDir === null;                   // flow is into the screen
      }
      gate(`J1 anchors ${view}/${flowAxis}`, ok);
    }
  }
}

/* J2 — one hand-made particle, exact projection in all three views */
{
  const p = { x: 50, r: 80, thetaIdx: 0 };                     // θ=0 = UP: world (50, 80, 0)
  const th = sunship.grid.thetaRad[0];
  gate('J2 θ index 0 is UP', close(th, 0));
  const c = sunship.spheres.sphere1.centerM;
  const k = (H * sunship.displayNormalization.sphere1ViewportFrac) / sunship.spheres.sphere1.radiusM;
  const world = { x: p.x, y: p.r * Math.cos(th), z: p.r * Math.sin(th) };

  /* AMENDED 2026-08-23 (wide instrument): the flow-axis origin is the
     2.0/5.2 station, not the centre. */
  const F2 = 2.0 / 5.2;
  const el = makeMapping({ view: 'elevation', flowAxis: 'LR', payload: sunship, width: W, height: H }).project(world);
  gate('J2 elevation: x→sx, y→up', close(el.sx, W * F2 + (world.x - c[0]) * k) && close(el.sy, H / 2 - (world.y - c[1]) * k) && el.near === false);

  const pl = makeMapping({ view: 'plan', flowAxis: 'LR', payload: sunship, width: W, height: H }).project(world);
  gate('J2 plan: z=0 → screen centreline; over-the-top flagged near', close(pl.sy, H / 2 + (0 - c[2]) * k) && pl.near === true);

  const wbn = sunship.worldBounds;
  /* true-perspective recession (2026-08-22): camera 0.35 spans upstream;
     unit scale at the sphere-1 centre plane; clamped [0.22, 2.2] */
  const xCam = wbn.xMinM - 0.35 * (wbn.xMaxM - wbn.xMinM);
  const f = Math.min(2.2, Math.max(0.22, (c[0] - xCam) / (world.x - xCam)));
  const fr = makeMapping({ view: 'frontal', flowAxis: 'LR', payload: sunship, width: W, height: H }).project(world);
  gate('J2 frontal: recession scale + up is up', close(fr.scale, f) && close(fr.sy, H / 2 - (world.y - c[1]) * k * f) && close(fr.sx, W / 2 - (world.z - c[2]) * k * f));
}

/* J3 — frontal occlusion rule on real engine output */
{
  const controls = CTRL({ smartTail: true, selectedCd: 0.3 });
  let st = initState(sunship, { seed: 9, count: 256 });
  for (let i = 0; i < 250; i++) st = step(sunship, controls, st, DT_S);
  const geo = sunship.extended;
  const n = sunship.grid.nStations;
  let ridingHiddenDownstream = 0, wakeOutsideVisible = 0, violations = 0;
  for (const p of st.particles) {
    const vis = frontalVisible(sunship, geo, p);
    const peakX = geo.extentM.x0M + (geo.frontalContourStation[p.thetaIdx] / (n - 1)) * geo.extentM.lengthM;
    const inside = p.r < geo.frontalContourRM[p.thetaIdx];
    if (p.x > peakX && inside && vis) violations++;            // the gate: never visible while occluded
    if (p.riding && p.x > peakX && !vis) ridingHiddenDownstream++;
    if (p.wake && !inside && vis) wakeOutsideVisible++;
  }
  gate('J3 frontal occlusion: zero occluded-but-visible particles', violations === 0,
    `${ridingHiddenDownstream} riding hidden downstream (tailed wake stays inside the contour — the tidy-wake story itself)`);
  gate('J3 hidden-downstream behaviour exercised', ridingHiddenDownstream > 0);

  /* wake OUTSIDE the contour: the CUBE — its corner-shed radius rides at
     the contour and the swirl's wave peaks cross it (the sphere's wake now
     decays inward under the swirl aesthetic and never escapes — correct,
     not a defect) */
  const cube = load('cube');
  let st2 = initState(cube, { seed: 9, count: 256 });
  for (let i = 0; i < 250; i++) st2 = step(cube, CTRL({ selectedCd: 1.0 }), st2, DT_S);
  const g2 = cube.retracted, n2 = cube.grid.nStations;
  let outsideVisible = 0, violations2 = 0;
  for (const p of st2.particles) {
    const vis = frontalVisible(cube, g2, p);
    const peakX = g2.extentM.x0M + (g2.frontalContourStation[p.thetaIdx] / (n2 - 1)) * g2.extentM.lengthM;
    const inside = p.r < g2.frontalContourRM[p.thetaIdx];
    if (p.x > peakX && inside && vis) violations2++;
    if (p.wake && !inside && vis) outsideVisible++;
  }
  gate('J3 cube: wake outside the contour stays visible, occlusion still clean',
    violations2 === 0 && outsideVisible > 0, `${outsideVisible} wake particles visible outside the silhouette`);
}

/* J4 — same engine state, three views: projections stay consistent */
{
  let st = initState(sunship, { seed: 4, count: 64 });
  const controls = CTRL({ smartTail: true });
  for (let i = 0; i < 100; i++) st = step(sunship, controls, st, DT_S);
  const maps = ['elevation', 'plan', 'frontal'].map((view) => makeMapping({ view, flowAxis: 'LR', payload: sunship, width: W, height: H }));
  const th = sunship.grid.thetaRad;
  let ok = true;
  for (const p of st.particles) {
    const world = { x: p.x, y: p.r * Math.cos(th[p.thetaIdx]), z: p.r * Math.sin(th[p.thetaIdx]) };
    const [el, pl, fr] = maps.map((m) => m.project(world));
    if (!close(el.sx, pl.sx)) ok = false;                      // same flow coordinate in both LR side/top views
    if (![el, pl, fr].every((q) => Number.isFinite(q.sx) && Number.isFinite(q.sy))) ok = false;
  }
  gate('J4 one state, three views, consistent + finite', ok);
}

/* J5 — degraded path: rail-follow disabled entirely */
{
  const bad = JSON.parse(JSON.stringify(sphere));
  bad.retracted.eligibility.outcome = 'INELIGIBLE';
  let st = initState(bad, { seed: 5, count: 128 }), everRode = false, threw = false;
  try {
    for (let i = 0; i < 200; i++) { st = step(bad, CTRL({ selectedCd: 0.47 }), st, DT_S); if (st.particles.some((p) => p.riding)) everRode = true; }
  } catch { threw = true; }
  const wakes = st.particles.filter((p) => p.wake).length;
  gate('J5 ineligible: no rail-follow, Cd wake only, no error', !threw && !everRode && st.degraded && wakes > 0, `${wakes} wake particles aft of body`);
}

/* J6 — hull outlines project finite in every view (renderer draws only these) */
{
  let ok = true;
  for (const view of ['elevation', 'plan', 'frontal']) {
    const m = makeMapping({ view, flowAxis: 'LR', payload: sunship, width: W, height: H });
    for (const geoName of ['retracted', 'extended']) {
      for (const pt of hullOutline(sunship, sunship[geoName], view)) {
        const q = m.project(pt);
        if (!Number.isFinite(q.sx) || !Number.isFinite(q.sy)) ok = false;
      }
    }
  }
  gate('J6 hull outlines finite in all views, both states', ok);
}

console.log(failures ? `\n${failures} V2 FIXTURE(S) FAILED` : '\nALL V2 HEADLESS FIXTURES PASS');
process.exit(failures ? 1 : 0);
