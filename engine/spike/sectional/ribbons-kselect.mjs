/**
 * K SELECTION — spec 28 / 28a rule, spec 33 parameterisation. REBUILT AND
 * COMMITTED (the original driver was ad-hoc and lost; see spec 33.5).
 *
 *   node ribbons-kselect.mjs polar        <- 32 reproduction run
 *   node ribbons-kselect.mjs cartesian    <- the 1E-R1 run
 *
 * DESIGNATED CONTROLS ONLY. The independent chine gate (28a amendment 1)
 * is deliberately NOT importable from here: contamination is prevented
 * structurally, not by discipline. Nothing in this file may read Sunship.
 *
 * GEOMETRY, RECOVERED FROM THE RECORD, NOT INVENTED. Prolate spheroid
 * A = 3, B = 1, nx = 240. Designated chine = the same body cut by the plane
 * y = -0.700, nt = 96 (192 section segments, matching spec 31). Test
 * station x = 0.3125, which is the MIDPOINT between mesh rings 132 and 133
 * -- the frozen "never cut on a ring" trap -- and gives a circle radius
 * 0.994559, matching the 0.9945 in spec 32.
 *
 * The exact arithmetic that spec 32 approximated: the mesh flat runs
 * between vertices at theta = 135 and 225 deg, whose radius is
 * 0.700 / cos 45 = 0.98995. Truth at theta = 180 is 0.700. The difference
 * is 0.28995 -- the recorded error to five digits. Spec 32 rationalised it
 * as R - d = 0.2945, which is a near miss for the right reason.
 */
import { analyticBody, ribbonMetrics } from './ribbons.mjs';
import { GENERATORS } from './ribbons-generators.mjs';
import { chainContour } from './ribbons-contour.mjs';
import { reconstructContour, reconstructContourCartesian } from './ribbons-reconstruct.mjs';
import { sectionSegments, stationGrid, RAYS } from './ribbons-section.mjs';

const DEG = 180 / Math.PI;
const A = 3, B = 1, NX = 240;
const STATIONS = 128, TIP = 0.025;         // tip frozen at 2.5% per spec 12
const D_FLAT = 0.700;
const CHINE_NT = 96;
const CHINE_X = 0.3125;
const SMOOTH_NT = [30, 118];               // "wildly different tessellations", spec 28 test 1
const JITTER = 0.4;                        // spec 31: 0.5 is the analytic degeneracy boundary
const K_SET = [1.5, 2, 3, 4, 5, 6, 8, 12, 20];

/** FROZEN TOLERANCES. Nothing new is invented here (28a amendment 2 rule 3). */
const TOL_FALSE_TURN_MAX = 0.5;            // deg, spec 4 / 28 test 1
const TOL_FALSE_TURN_MED = 0.1;            // deg, spec 4 / 28 test 1
const TOL_PROFILE = 0.02;                  // 2% of rMax, TOL.profile in ribbons.mjs

const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2)) * B;
const smoothFn = (x) => rc(x);
const chineFn = (x, th) => {
  const c = Math.cos(th);
  return c < -1e-12 ? Math.min(rc(x), D_FLAT / -c) : rc(x);
};

const basis = (process.argv[2] || 'cartesian').toLowerCase();
if (!['polar', 'cartesian', 'raw'].includes(basis)) { console.error('basis must be polar, cartesian or raw'); process.exit(2); }

/**
 * NO RECONSTRUCTION AT ALL — ray against the chained polygon's own edges.
 * This is the control that says whether reconstruction HELPS, HURTS or is
 * NEUTRAL. Without it, a failing gate cannot be attributed to the method
 * rather than to the sampling it was handed.
 */
function rawIntersect(loop, rays) {
  const n = loop.length;
  return rays.map((th) => {
    const ct = Math.cos(th), st = Math.sin(th);
    let best = 0;
    for (let i = 0; i < n; i++) {
      const p = loop[i], q = loop[(i + 1) % n];
      const g1 = p[0] * st - p[1] * ct, g2 = q[0] * st - q[1] * ct;
      if (g1 === g2 || (g1 < 0 && g2 < 0) || (g1 > 0 && g2 > 0)) continue;
      const t = g1 / (g1 - g2);
      const X = p[0] + t * (q[0] - p[0]), Y = p[1] + t * (q[1] - p[1]);
      const proj = X * ct + Y * st;
      if (proj > best) best = proj;
    }
    return best;
  });
}

const recon = (loop, K) => (basis === 'polar'
  ? { r: reconstructContour(loop, RAYS, K), diag: null }
  : basis === 'raw'
    ? { r: rawIntersect(loop, RAYS), diag: null }
    : reconstructContourCartesian(loop, RAYS, K));

/* ---------------------------------------------------------------- */
/* section extraction — done ONCE per body, reused across every K     */
/* ---------------------------------------------------------------- */
function loopsFor(mesh, xs) {
  const out = [];
  let faults = 0, chainFails = 0;
  for (const xi of xs) {
    const { segs, onPlane, tripleHit } = sectionSegments(mesh.verts, mesh.faces, xi);
    if (onPlane || tripleHit) faults++;
    if (segs.length < 3) { out.push(null); continue; }
    const c = chainContour(segs);
    if (!c.ok) { chainFails++; out.push(null); continue; }
    out.push(c.loop);
  }
  return { loops: out, faults, chainFails };
}

/** Linear gap fill over failed stations, matching extractRibbons 4.4. */
function fillGaps(rib) {
  const N = rib.length;
  let prev = -1;
  for (let i = 0; i < N; i++) {
    if (Number.isNaN(rib[i])) continue;
    if (prev < 0) { for (let j = 0; j < i; j++) rib[j] = 0; }
    else if (i - prev > 1) for (let j = prev + 1; j < i; j++) rib[j] = rib[prev] + ((rib[i] - rib[prev]) * (j - prev)) / (i - prev);
    prev = i;
  }
  if (prev < 0) rib.fill(0); else for (let j = prev + 1; j < N; j++) rib[j] = 0;
  return rib;
}

/* ---------------------------------------------------------------- */
/* SMOOTH GATE — false turning must collapse, on a body whose tangent */
/* angle is monotone by construction, so excess IS extraction noise   */
/* ---------------------------------------------------------------- */
function smoothRun(nt, K, pre) {
  const nRib = RAYS.length;
  const R = Array.from({ length: nRib }, () => new Array(STATIONS).fill(NaN));
  const diagSum = { features: 0, multiHitRays: 0, missedRays: 0, twoPointRuns: 0 };
  pre.loops.forEach((loop, i) => {
    if (!loop) return;
    const { r, diag } = recon(loop, K);
    if (diag) { diagSum.features += diag.features; diagSum.multiHitRays += diag.multiHitRays;
      diagSum.missedRays += diag.missedRays; diagSum.twoPointRuns += diag.twoPointRuns; }
    for (let k = 0; k < nRib; k++) R[k][i] = r[k];
  });
  R.forEach(fillGaps);
  const L = 2 * A;
  const ft = R.map((rib) => {
    const m = ribbonMetrics(rib, L, { tipFrac: TIP });
    return (m.absTurn - Math.abs(m.netTurn)) * DEG;
  });
  const sorted = [...ft].sort((a, b) => a - b);
  const st = pre.loops.filter(Boolean).length || 1;
  return { R, maxFalse: Math.max(...ft), medFalse: sorted[Math.floor(nRib / 2)],
    featPerStation: diagSum.features / st, diagSum };
}

/* ---------------------------------------------------------------- */
/* CHINE GATE — one designated station, radius vs exact analytic      */
/* ---------------------------------------------------------------- */
function chineRun(mesh, K) {
  const { segs, onPlane, tripleHit } = sectionSegments(mesh.verts, mesh.faces, CHINE_X);
  const c = chainContour(segs);
  if (!c.ok) return { err: NaN, reason: c.reason, segs: segs.length };
  const { r, diag } = recon(c.loop, K);
  let worst = 0, worstTh = 0;
  RAYS.forEach((th, k) => {
    const want = chineFn(CHINE_X, th);
    const e = Math.abs(r[k] - want) / B;
    if (e > worst) { worst = e; worstTh = th; }
  });
  return { err: worst, atTheta: worstTh * DEG, segs: segs.length, vertices: c.loop.length, onPlane, tripleHit, diag, r };
}

/* ---------------------------------------------------------------- */
/* start-index invariance — declared in spec 33, MEASURED not assumed */
/* ---------------------------------------------------------------- */
function startInvariance(loop, K) {
  const base = recon(loop, K).r;
  let worst = 0;
  for (const shift of [1, 7, 19, Math.floor(loop.length / 2)]) {
    const rot = loop.slice(shift).concat(loop.slice(0, shift));
    const got = recon(rot, K).r;
    for (let k = 0; k < base.length; k++) worst = Math.max(worst, Math.abs(got[k] - base[k]));
  }
  return worst;
}

/* ---------------------------------------------------------------- */
console.log(`\nK SELECTION — basis: ${basis.toUpperCase()}   (spec 28/28a rule, spec 33 parameterisation)`);
console.log(`designated controls only | K set ${K_SET.join(', ')} | ${RAYS.length} rays | ${STATIONS} stations | tip ${TIP}`);

const xs = stationGrid(A, STATIONS);
const smoothMeshes = SMOOTH_NT.map((nt) => ({ nt, mesh: GENERATORS.sineJitter(smoothFn, A, NX, nt, JITTER) }));
const smoothPre = smoothMeshes.map(({ nt, mesh }) => {
  const pre = loopsFor(mesh, xs);
  console.log(`  smooth nt=${nt}: ${mesh.faces.length} faces, ${pre.loops.filter(Boolean).length}/${STATIONS} stations chained` +
    (pre.faults ? `, ${pre.faults} PLANE FAULTS` : '') + (pre.chainFails ? `, ${pre.chainFails} chain failures` : ''));
  return { nt, pre };
});
const chineMesh = analyticBody(chineFn, A, { nx: NX, nt: CHINE_NT });

const probe = chineRun(chineMesh, 3);
console.log(`  chine  nt=${CHINE_NT}: station x=${CHINE_X} -> ${probe.segs} segments, ${probe.vertices} vertices after collinear removal` +
  (probe.onPlane || probe.tripleHit ? `  *** PLANE FAULT ${probe.onPlane}/${probe.tripleHit} ***` : ''));
console.log(`  analytic truth: circle radius ${rc(CHINE_X).toFixed(6)}, flat at ${D_FLAT}, mesh flat corner radius ${(D_FLAT / Math.cos(Math.PI / 4)).toFixed(6)}`);

console.log('\n  K     smooth nt=30           smooth nt=118          chine        feat/run diagnostics');
console.log('        maxFalse  medFalse     maxFalse  medFalse     maxRadErr');
const rows = [];
for (const K of K_SET) {
  const s = smoothPre.map(({ nt, pre }) => smoothRun(nt, K, pre));
  const ch = chineRun(chineMesh, K);
  rows.push({ K, s, ch });
  const d = ch.diag ? ` feat ${ch.diag.features} runs ${ch.diag.runs} 2pt ${ch.diag.twoPointRuns} multi ${ch.diag.multiHitRays} miss ${ch.diag.missedRays}` : '';
  console.log(`  ${String(K).padEnd(4)}  ${s[0].maxFalse.toFixed(3).padStart(8)}  ${s[0].medFalse.toFixed(3).padStart(8)}     ` +
    `${s[1].maxFalse.toFixed(3).padStart(8)}  ${s[1].medFalse.toFixed(3).padStart(8)}     ` +
    `${(100 * ch.err).toFixed(3).padStart(8)}%  ${d}` +
    (basis === 'cartesian' ? `  | smooth feat/station ${s[0].featPerStation.toFixed(1)} / ${s[1].featPerStation.toFixed(1)}` : ''));
}

/* cross-tessellation agreement, spec 28 test 1 second half */
console.log('\n  cross-tessellation agreement (nt=30 vs nt=118, retained domain):');
const i0 = Math.ceil(TIP * (STATIONS - 1)), i1 = Math.floor((1 - TIP) * (STATIONS - 1));
for (const row of rows) {
  let worst = 0;
  for (let k = 0; k < RAYS.length; k++) for (let i = i0; i <= i1; i++)
    worst = Math.max(worst, Math.abs(row.s[0].R[k][i] - row.s[1].R[k][i]));
  console.log(`    K=${String(row.K).padEnd(4)}  max |dr| = ${(100 * worst / B).toFixed(3)}% of rMax`);
}

/* baseline: the raw polygon, no reconstruction at all */
{
  const { segs } = sectionSegments(chineMesh.verts, chineMesh.faces, CHINE_X);
  const c = chainContour(segs);
  let worst = 0;
  if (c.ok) RAYS.forEach((th) => {
    let best = 0;
    for (let i = 0; i < c.loop.length; i++) {
      const p = c.loop[i], q = c.loop[(i + 1) % c.loop.length];
      const ct = Math.cos(th), st = Math.sin(th);
      const g1 = p[0] * st - p[1] * ct, g2 = q[0] * st - q[1] * ct;
      if (g1 === g2 || (g1 < 0 && g2 < 0) || (g1 > 0 && g2 > 0)) continue;
      const t = g1 / (g1 - g2);
      const X = p[0] + t * (q[0] - p[0]), Y = p[1] + t * (q[1] - p[1]);
      const proj = X * ct + Y * st;
      if (proj > best) best = proj;
    }
    worst = Math.max(worst, Math.abs(best - chineFn(CHINE_X, th)) / B);
  });
  console.log(`\n  BASELINE, raw chained polygon with NO reconstruction: chine maxRadErr ${(100 * worst).toFixed(3)}%`);
}

if (basis === 'cartesian') {
  const { segs } = sectionSegments(chineMesh.verts, chineMesh.faces, CHINE_X);
  const c = chainContour(segs);
  const sm = smoothPre[0].pre.loops[64];
  console.log('\n  start-index invariance (spec 33 seam handling, measured):');
  for (const K of [1.5, 3, 8, 20]) {
    const a = c.ok ? startInvariance(c.loop, K) : NaN;
    const b = sm ? startInvariance(sm, K) : NaN;
    console.log(`    K=${String(K).padEnd(4)}  chine ${a.toExponential(2)}   smooth ${b.toExponential(2)}`);
  }
}

/* ---------------------------------------------------------------- */
/* THE FROZEN DECISION RULE — smallest K passing BOTH                */
/* ---------------------------------------------------------------- */
console.log('\n  DECISION RULE (frozen, spec 28.3): smallest K that removes the smooth');
console.log(`  polygon artefact (maxFalse <= ${TOL_FALSE_TURN_MAX} deg AND medFalse <= ${TOL_FALSE_TURN_MED} deg, BOTH`);
console.log(`  tessellations) AND preserves the designated chine (maxRadErr <= ${100 * TOL_PROFILE}%).`);
const passing = rows.filter((r) =>
  r.s.every((x) => x.maxFalse <= TOL_FALSE_TURN_MAX && x.medFalse <= TOL_FALSE_TURN_MED) &&
  r.ch.err <= TOL_PROFILE);
if (passing.length) console.log(`\n  ==> K = ${passing[0].K}  (smallest of ${passing.map((p) => p.K).join(', ')})`);
else console.log('\n  ==> NO K PASSES.');
