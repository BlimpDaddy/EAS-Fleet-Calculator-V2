/**
 * PHASE 1B — FALSE-NON-MONOTONICITY ENVELOPE FROM ANALYTIC TRUTH (2026-08-20)
 *
 * TERMINOLOGY, FROZEN BY RULING: `turningExcess` is a NON-MONOTONICITY
 * metric, not a noise metric. It acts as a noise diagnostic ONLY on
 * controls whose true tangent history is known to be monotone. On a
 * compound body, non-monotonicity is real design geometry — the tailed
 * Sunship's 31.4% localises exactly to its hull-to-tail handover.
 *
 * TWO GEOMETRIC SIGNALS, BOTH WANTED, NEVER TO BE CONFLATED OR ERASED:
 *   1. monotone distributed turning — smooth continuous evolution;
 *   2. easing / handover events — local non-monotonicity where one
 *      geometry regime hands over to another. The Smart Tail IS one.
 *
 * PURPOSE. Every body here has an analytically MONOTONE phi(x), so any
 * reversal observed is FALSE by construction. Corrupting only the
 * tessellation — never the surface — measures how much false
 * non-monotonicity a given mesh quality manufactures. That envelope is
 * what lets a real handover be told apart from mesh junk.
 *
 * The tailed Sunship is NOT used to choose anything here: its
 * non-monotonicity is real and would contaminate the gate.
 *
 * No smoothing. No reconstruction. No corpus tuning. Frozen extractor.
 */
import { extractRibbons, ribbonMetrics, CONTROLS, SECANT_FRAC } from './ribbons.mjs';

const DEG = 180 / Math.PI, TIP = 0.025;

/** Analytic body on EXPLICIT axial stations — surface exact, sampling controlled. */
function bodyAt(rFn, halfLen, xs, nt) {
  const verts = [], faces = [], ring = [];
  for (const x of xs) {
    const r0 = Math.max(0, rFn(x, 0));
    if (r0 < 1e-9) { ring.push(verts.push([x, 0, 0]) - 1); continue; }
    const first = verts.length;
    for (let j = 0; j < nt; j++) {
      const th = (2 * Math.PI * j) / nt, r = Math.max(0, rFn(x, th));
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
    ring.push(first);
  }
  const n = xs.length - 1;
  const size = (i) => (i < n ? ring[i + 1] - ring[i] : verts.length - ring[i]);
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[i + 1], ap = size(i) === 1, bp = size(i + 1) === 1;
    if (ap && bp) continue;
    for (let j = 0; j < nt; j++) {
      const j1 = (j + 1) % nt;
      if (ap) faces.push([a, b + j, b + j1]);
      else if (bp) faces.push([b, a + j1, a + j]);
      else faces.push([a + j, b + j, b + j1], [a + j, b + j1, a + j1]);
    }
  }
  return { verts, faces };
}

/** Deterministic irregular spacing: alternating s and rho*s, exact max/median = rho. */
function irregularStations(halfLen, nFacets, rho) {
  const w = []; for (let i = 0; i < nFacets; i++) w.push(i % 2 ? rho : 1);
  const tot = w.reduce((a, b) => a + b, 0);
  const xs = [-halfLen]; let acc = 0;
  for (const wi of w) { acc += wi; xs.push(-halfLen + (2 * halfLen * acc) / tot); }
  return xs;
}

/** Largest FALSE reversal on a known-monotone body, in degrees. */
function falseReversal(mesh, planes = 12) {
  const F = extractRibbons(mesh.verts, mesh.faces, { axis: 'X', up: 'Y', planes });
  let worstStep = 0, worstExcess = 0;
  for (const rib of F.ribbons) {
    const g = ribbonMetrics(rib, F.L, { tipFrac: TIP });
    if (g.turningExcess > worstExcess) worstExcess = g.turningExcess;
    const N = rib.length, dx = F.L / (N - 1);
    const half = Math.max(1, Math.round(((SECANT_FRAC / 2) * F.L) / dx));
    let prev = null;
    for (let i = g.i0; i <= g.i1; i++) {
      const a = Math.max(0, i - half), b = Math.min(N - 1, i + half);
      const p = Math.atan2(rib[b] - rib[a], (b - a) * dx) * DEG;
      if (prev !== null && p - prev > worstStep) worstStep = p - prev;
      prev = p;
    }
  }
  return { step: worstStep, excess: worstExcess };
}

/**
 * UNSTRUCTURED corruption: move every vertex ALONG the exact analytic
 * surface, destroying ring alignment while keeping each vertex exactly on
 * the true surface. Deterministic (no RNG). This is the corruption the
 * bare Sunship actually has — scattered in BOTH axial and azimuthal
 * directions — as opposed to axial-spacing irregularity, which a convex
 * body is immune to because chord slopes stay monotone at any spacing.
 */
function unstructured(rFn, halfLen, nFacets, nt, jitter) {
  const xs = irregularStations(halfLen, nFacets, 1);
  const dx = (2 * halfLen) / nFacets, dth = (2 * Math.PI) / nt;
  const h = (i, j, k) => { const v = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
  const verts = [], faces = [], ring = [];
  for (let i = 0; i < xs.length; i++) {
    const xr = xs[i];
    if (Math.max(0, rFn(xr, 0)) < 1e-9) { ring.push(verts.push([xr, 0, 0]) - 1); continue; }
    const first = verts.length;
    for (let j = 0; j < nt; j++) {
      const edge = (i === 0 || i === xs.length - 1) ? 0 : 1;   // keep the tips put
      const x = xr + edge * jitter * dx * h(i, j, 1);
      const th = (2 * Math.PI * j) / nt + jitter * dth * h(i, j, 2);
      const r = Math.max(0, rFn(x, th));                       // EXACTLY on the surface
      verts.push([x, r * Math.cos(th), r * Math.sin(th)]);
    }
    ring.push(first);
  }
  const n = xs.length - 1;
  const size = (i) => (i < n ? ring[i + 1] - ring[i] : verts.length - ring[i]);
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[i + 1], ap = size(i) === 1, bp = size(i + 1) === 1;
    if (ap && bp) continue;
    for (let j = 0; j < nt; j++) {
      const j1 = (j + 1) % nt;
      if (ap) faces.push([a, b + j, b + j1]);
      else if (bp) faces.push([b, a + j1, a + j]);
      else faces.push([a + j, b + j, b + j1], [a + j, b + j1, a + j1]);
    }
  }
  return { verts, faces };
}

const BODY = CONTROLS[1];          // prolate f=3 — monotone phi, mid-fineness
console.log('== PHASE 1B — FALSE NON-MONOTONICITY vs MESH QUALITY ==');
console.log(`analytic body: ${BODY.name}. phi(x) is monotone by construction, so every`);
console.log('reversal below is FALSE. Surface never changes; only tessellation does.\n');
console.log('               irregularity rho = max/median axial facet spacing');
console.log('facets |    1x        2x        4x        8x       16x       32x');
const RHOS = [1, 2, 4, 8, 16, 32];
const table = {};
for (const nf of [32, 64, 128, 240, 400]) {
  const row = [];
  for (const rho of RHOS) {
    const xs = irregularStations(BODY.A, nf, rho);
    const r = falseReversal(bodyAt(BODY.rFn, BODY.A, xs, 96));
    row.push(r.step);
  }
  table[nf] = row;
  console.log(`${String(nf).padStart(6)} | ${row.map((v) => (v.toFixed(2) + 'deg').padStart(9)).join(' ')}`);
}
console.log('\n(cells are the LARGEST false single-step tangent reversal, degrees)');

console.log('\n-- THE REAL EVENTS, for comparison. NOT used to set anything. --');
console.log('  Sunship TAILED hull/tail handover : +5.5 deg largest step, 12.8 deg total');
console.log('                 mesh: 320 uniform facets, rho 1.0  -> envelope above says '
  + `${table[240][0].toFixed(2)}-${table[400][0].toFixed(2)} deg false at rho 1`);
console.log('  Sunship BARE near-tip reversals   : +6.5 deg largest step, 13.0 deg total');
console.log('                 mesh: unstructured, rho 32.1  -> envelope at rho 32 says '
  + `${Math.min(...Object.values(table).map((r) => r[5])).toFixed(2)}-${Math.max(...Object.values(table).map((r) => r[5])).toFixed(2)} deg false`);
console.log('\nA reversal is TRUSTWORTHY only if it exceeds the envelope for its own mesh quality.');
