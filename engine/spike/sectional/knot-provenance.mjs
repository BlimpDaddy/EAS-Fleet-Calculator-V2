/**
 * CALIBRATION KNOT 2 — PROVENANCE RECONCILIATION. Spec 85.11.1, step 2.
 *
 * 81.4 recorded that TN614-332 computes proxy 0.186851 through the batch
 * harness while BEING calibration knot 2 at 0.1807885483529704 — a 3.3% gap.
 * 85.4 showed that knot is where the frozen pressure map's slope jumps 27x, and
 * 85.11.1 made reconciling it a priority BEFORE the estimator is used as an
 * optimiser.
 *
 * THE RULES THIS RUNS UNDER, from 85.11.1:
 *   - historical calibration geometry and path ONLY;
 *   - THE SUNSHIP SWEEP IS KEPT COMPLETELY OUT OF IT. No Sunship geometry is
 *     imported, referenced or computed in this file;
 *   - NO KNOT MOVES. This establishes WHY the two numbers differ. It changes
 *     nothing.
 *
 * THE TWO PATHS DIFFER IN EXACTLY TWO PLACES, so this is a 2x2 factorial rather
 * than an argument:
 *
 *   INTERPOLATION   pchip  — monotone cubic through the Table II ordinates,
 *                            used by `tn614-bodies.mjs` and every calibration
 *                            generator
 *                   lerp   — piecewise LINEAR between the same ordinates, used
 *                            by `run-reference-regression.mjs`
 *   MESH            lathe  — `latheProfile(pts, 96, 28)`, rings and segments
 *                   hull   — 12,000 Fibonacci surface samples -> QuickHull
 *
 * `sections.mjs` (spike) and `src/sections.js` (production) were checked and
 * differ only in comments, so the scorer is NOT a variable here.
 */
import { BODIES, pchip } from './tn614-bodies.mjs';
import { PATTERNS, hullMesh } from './hull-bodies.mjs';
import { measureSectionalProxy, ROUNDED_KNOTS, calibratePressure }
  from '../../../site/calcv2/src/cdEstimator.js';

const SEED = 12345;
const KNOT2 = ROUNDED_KNOTS[1][0];
const RECORDED_HARNESS = 0.186851;      // 81.4 / 81.3, the value that disagrees

/** the piecewise-LINEAR reader used by the harness, reproduced exactly */
const lerp = (pts) => (t) => {
  if (t <= pts[0][0] || t >= pts[pts.length - 1][0]) return 0;
  let i = 0; while (i + 2 < pts.length && pts[i + 1][0] < t) i++;
  const [a, ra] = pts[i], [b, rb] = pts[i + 1];
  return ra + ((rb - ra) * (t - a)) / (b - a);
};

/** normalised ordinates for one body, as both paths prepare them */
function ordinates(id) {
  return BODIES[id].pts.map(([s, v]) => [s / 100, v / 100]);
}

/** the historical lathe, but reading the profile through EITHER interpolator */
function latheWith(id, interp, rings = 96, segs = 28) {
  const pts = ordinates(id);
  const f = interp === 'pchip' ? pchip(pts) : lerp(pts);
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const verts = [], faces = [], ringIdx = [];
  for (let i = 0; i <= rings; i++) {
    const x = x0 + ((x1 - x0) * i) / rings;
    const r = Math.max(f(x), 0);
    if (r < 1e-4) { ringIdx.push(verts.push([x, 0, 0]) - 1); continue; }
    const first = verts.length;
    for (let s = 0; s < segs; s++) {
      const th = (2 * Math.PI * s) / segs;
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
    ringIdx.push(first);
  }
  const size = (i) => (i < rings ? ringIdx[i + 1] - ringIdx[i] : verts.length - ringIdx[i]);
  for (let i = 0; i < rings; i++) {
    const a = ringIdx[i], b = ringIdx[i + 1], aP = size(i) === 1, bP = size(i + 1) === 1;
    if (aP && bP) continue;
    for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      if (aP) faces.push([a, b + s, b + s1]);
      else if (bP) faces.push([b, a + s1, a + s]);
      else faces.push([a + s, b + s, b + s1], [a + s, b + s1, a + s1]);
    }
  }
  return { verts, faces };
}

function hullWith(id, interp) {
  const pts = ordinates(id);
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0], half = (x1 - x0) / 2, cx = (x0 + x1) / 2;
  const f = interp === 'pchip' ? pchip(pts) : lerp(pts);
  const m = hullMesh(PATTERNS.fibonacci((X) => f(X + cx), half, 12000, SEED));
  return { verts: m.verts, faces: m.faces };
}

const proxyOf = (s) => measureSectionalProxy(s.verts, s.faces, { axis: '+X' });

console.log('\nCALIBRATION KNOT 2 — PROVENANCE RECONCILIATION (spec 85.11.1, step 2)');
console.log('  Historical geometry and paths ONLY. No Sunship geometry is touched.');
console.log('  NOTHING IS CHANGED — this establishes WHY two numbers differ.\n');
console.log(`  frozen knot 2 (ROUNDED_KNOTS[1])     ${KNOT2}`);
console.log(`  recorded harness value (81.4)        ${RECORDED_HARNESS}`);
console.log(`  gap                                  ${(100 * (RECORDED_HARNESS - KNOT2) / KNOT2).toFixed(2)}%\n`);

console.log('  THE 2x2 — TN614-332, the knot body');
console.log('    interpolation  mesh    proxy       class     vs knot 2   vs harness');
const grid = {};
for (const interp of ['pchip', 'lerp']) {
  for (const mesh of ['lathe', 'hull']) {
    const s = mesh === 'lathe' ? latheWith('332', interp) : hullWith('332', interp);
    const p = proxyOf(s);
    grid[`${interp}/${mesh}`] = p.proxy;
    console.log(`    ${interp.padEnd(14)} ${mesh.padEnd(7)} ${p.proxy.toFixed(6)}  ${p.cls.padEnd(8)}  ` +
      `${((100 * (p.proxy - KNOT2)) / KNOT2).toFixed(2).padStart(7)}%   ` +
      `${((100 * (p.proxy - RECORDED_HARNESS)) / RECORDED_HARNESS).toFixed(2).padStart(7)}%`);
  }
}

/* which factor moves it, and by how much */
const dInterpLathe = grid['lerp/lathe'] - grid['pchip/lathe'];
const dInterpHull = grid['lerp/hull'] - grid['pchip/hull'];
const dMeshPchip = grid['pchip/hull'] - grid['pchip/lathe'];
const dMeshLerp = grid['lerp/hull'] - grid['lerp/lathe'];
console.log('\n  MAIN EFFECTS (absolute proxy)');
console.log(`    interpolation  pchip -> lerp :  ${dInterpLathe >= 0 ? '+' : ''}${dInterpLathe.toFixed(6)} on the lathe,` +
  `  ${dInterpHull >= 0 ? '+' : ''}${dInterpHull.toFixed(6)} on the hull`);
console.log(`    mesh           lathe -> hull :  ${dMeshPchip >= 0 ? '+' : ''}${dMeshPchip.toFixed(6)} under pchip,` +
  `  ${dMeshLerp >= 0 ? '+' : ''}${dMeshLerp.toFixed(6)} under lerp`);

/* the other two real anchors, to show whether the effect is systematic */
console.log('\n  THE OTHER REAL ANCHOR, AND THE REST OF THE TN-614 SET');
console.log('    body      pchip/lathe   lerp/hull    delta      delta %');
for (const id of Object.keys(BODIES)) {
  const a = proxyOf(latheWith(id, 'pchip')).proxy;
  const b = proxyOf(hullWith(id, 'lerp')).proxy;
  console.log(`    ${id.padEnd(9)} ${a.toFixed(6)}     ${b.toFixed(6)}    ${(b - a >= 0 ? '+' : '') + (b - a).toFixed(6)}  ` +
    `${((100 * (b - a)) / a).toFixed(2).padStart(7)}%`);
}

/* what the gap is worth in Cd, at the knot, where 85.4 found the 27x slope */
console.log('\n  WHAT THE GAP IS WORTH IN PRESSURE Cd (rounded line, the knot body is rounded)');
for (const [lab, px] of [['frozen knot', KNOT2], ['harness value', RECORDED_HARNESS]]) {
  console.log(`    ${lab.padEnd(15)} proxy ${px.toFixed(6)}  ->  pressure ${calibratePressure(px, 'rounded').toFixed(6)}`);
}
console.log(`    knot 2 pressure as stored          ${ROUNDED_KNOTS[1][1].toFixed(6)}`);

/* ---------------------------------------------------------------------------
 * THE THIRD FACTOR, WHICH IS NOT A CONVENTION AT ALL: MESH RESOLUTION.
 * Both frozen real knots were generated on a 96 x 28 lathe. If the proxy is not
 * converged in resolution then the knot is a property of THAT MESH, not of the
 * body, and no reconciliation is meaningful until that is known. Both scales
 * double together, as spec 53.6's ladder does.
 * ------------------------------------------------------------------------- */
const LADDER = [[96, 28], [192, 56], [384, 112], [768, 224], [1536, 448]];
console.log('\n  RESOLUTION LADDER — pchip lathe, both scales doubling together');
const ends = {};
for (const [i, id] of ['111', '332'].entries()) {
  const K = ROUNDED_KNOTS[i][0];
  console.log(`\n    TN614-${id}   frozen knot ${K.toFixed(6)}`);
  console.log('      rings x segs      proxy       vs knot   step');
  let prev = null;
  for (const [r, sg] of LADDER) {
    const p = proxyOf(latheWith(id, 'pchip', r, sg)).proxy;
    const step = prev === null ? '' : `${((100 * (p - prev)) / prev).toFixed(2)}%`;
    console.log(`      ${String(r).padStart(5)} x ${String(sg).padEnd(4)}      ${p.toFixed(6)}   ` +
      `${((100 * (p - K)) / K).toFixed(2).padStart(6)}%  ${step.padStart(7)}`);
    prev = p;
    ends[id] = p;
  }
}

/* the quantity that actually decides whether a convention change deforms the
   map: the SPACING between the two real anchors, not either one alone */
const spanFrozen = ROUNDED_KNOTS[1][0] - ROUNDED_KNOTS[0][0];
const spanRefined = ends['332'] - ends['111'];
const spanHarness = proxyOf(hullWith('332', 'lerp')).proxy - proxyOf(hullWith('111', 'lerp')).proxy;
console.log('\n  THE ANCHOR SPACING — what a convention change does to the MAP, not to a point');
console.log(`    frozen  96x28 pchip lathe   ${spanFrozen.toFixed(6)}`);
console.log(`    refined 1536x448 same path  ${spanRefined.toFixed(6)}   ${((100 * (spanRefined - spanFrozen)) / spanFrozen).toFixed(2)}%`);
console.log(`    harness lerp + hull         ${spanHarness.toFixed(6)}   ${((100 * (spanHarness - spanFrozen)) / spanFrozen).toFixed(2)}%`);

console.log('\n  KNOTS UNCHANGED. Nothing written. No Sunship geometry involved.\n');
