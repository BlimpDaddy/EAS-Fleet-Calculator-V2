/**
 * JOB A — the deployed body built from the Sunship's TRUE SECTION SHAPE,
 * with the fairing attached TANGENTIALLY.
 *
 * WHY (r20 send-back, 2026-08-19). The shipped SUNSHIP_TAILED is an
 * equal-area axisymmetric surrogate: every station's area is replaced by
 * an equal-area CIRCLE and the whole body lathed. Two objections followed,
 * and they deserve different answers.
 *
 *   "The pressure Cd is scored on a body that isn't the Sunship."
 *      -> MEASURED AND LARGELY FALSE. The proxy is compositeV1 =
 *         max(softAft, softFore), and scoreSections builds both from the
 *         AREA CURVE via its own equivalent-radius conversion — the same
 *         transformation the lathe performs. Real mesh proxy 0.769792 vs
 *         its equal-area lathe 0.770410: 0.08%. The shape-dependent terms
 *         (compactness, cornerPenalty) DO differ, but they feed only the
 *         v0 composite, which the source marks "reported, never consumed".
 *
 *   "Circularising can flatter wetted area, and friction is 44% of the
 *    tailed Cd."  -> REAL, and this file addresses it. Measured on the
 *         hull alone the surrogate came out +3.2% (conservative), but that
 *         is a net of two errors and is not a reason to keep guessing.
 *
 * WHAT THIS BUILDS. Instead of one radius per station, r(x, THETA): the
 * hull's real outline is sampled at every station and every angle, so the
 * body keeps the Sunship's actual (wider-than-tall) sections. Aft of the
 * attach station the SAME outline is scaled by the fairing's profile, so
 * the fairing inherits the hull's cross-sectional shape rather than
 * becoming a cone of revolution.
 *
 * TANGENCY, actually solved. The old generator picked exponent P = 0.8 and
 * the docs claimed the surfaces "meet tangentially". They did not — only
 * the radius matched. Here P is DERIVED from the hull's own slope at the
 * attach point, so the join is C1 by construction:
 *     r(x) = ra * ((xTip - x)/(xTip - xA))^P
 *     r'(xA) = -ra * P / (xTip - xA)  ==  hull slope at xA
 *     =>  P = -hullSlope * (xTip - xA) / ra
 * P is therefore no longer a free parameter.
 *
 * STRUCTURED, so it cannot be non-manifold. Sampling a fixed (station x
 * angle) grid and lofting sidesteps plane-mesh clipping and boundary-loop
 * walking entirely — the two things most likely to emit a broken mesh.
 * Safe by construction rather than by luck, which matters because a
 * broken mesh would not crash the estimator, it would silently make it
 * REFUSE (oddFraction guard) and that is a confusing way to fail.
 *
 * NEVER DEPLOYS: lab/ is not in the bake list. This writes nothing.
 * Run from CalcV2:  node lab/sunship-tail-truesurface.mjs
 */
import { readFileSync } from 'node:fs';
import { parseObjMesh } from '../src/obj.js';
import { measureSections } from '../src/sections.js';
import { measureSectionalProxy, estimateCd } from '../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../src/dynamicsGeometry.js';

const LENGTH_M = 300, EXTRA_M = 216, ATTACH = 0.80, SPEED_KMH = 120;
// Converged settings (sweep 2026-08-19): Cd stable to 4 dp for RINGS>=256,
// STATIONS>=128, SEGS 48-288. STATIONS=64 is too coarse (0.0248).
const RINGS = Number(process.env.RINGS ?? 512), SEGS = Number(process.env.SEGS ?? 96), STATIONS = Number(process.env.STATIONS ?? 192);

const mesh = parseObjMesh(readFileSync(new URL('../../3D OBJ/Sunship.obj', import.meta.url), 'utf8'));

/* ---- 1. the hull's real outline r(x, theta), sampled from the mesh ---- */
// Flight axis is +Z. Scale to metres first so every length below is real.
const zs = mesh.verts.map((v) => v[2]);
const zMin = Math.min(...zs), zMax = Math.max(...zs);
const scale = LENGTH_M / (zMax - zMin);
const P3 = mesh.verts.map((v) => [v[0] * scale, v[1] * scale, (v[2] - zMin) * scale]);

// EXACT OUTLINES BY PLANE-TRIANGLE INTERSECTION.
// The first cut binned VERTICES into a (station x angle) grid and it was
// badly wrong: 2,778 vertices cannot fill 128 x 96 = 12,288 bins, so most
// of the surface was interpolated noise. Result: wetted area 809,452 m2
// against the surrogate's 253,919, and a proxy of 0.56 against 0.16.
// Instructive failure — it did NOT crash or get refused, it produced a
// plausible-looking wrong number. Intersecting FACES instead of sampling
// vertices is exact regardless of how coarse the mesh is.
function outlineAt(z) {
  const segs = [];
  for (const tri of mesh.faces) {
    const p = tri.map((k) => P3[k]);
    const d = p.map((v) => v[2] - z);
    const hits = [];
    for (let e = 0; e < 3; e++) {
      const a = p[e], b = p[(e + 1) % 3], da = d[e], db = d[(e + 1) % 3];
      if ((da <= 0 && db > 0) || (da > 0 && db <= 0)) {
        const t = da / (da - db);
        hits.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    if (hits.length === 2) segs.push(hits);
  }
  // For each ray from the axis, the furthest crossing IS the surface.
  const out = new Float64Array(SEGS);
  for (let s = 0; s < SEGS; s++) {
    const th = -Math.PI + (2 * Math.PI * s) / SEGS;
    const cx = Math.cos(th), cy = Math.sin(th);
    let best = 0;
    for (const [A, B] of segs) {
      // ray (0,0)+t(cx,cy) against segment A-B
      const ex = B[0] - A[0], ey = B[1] - A[1];
      const den = cx * ey - cy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const u = (A[0] * ey - A[1] * ex) / den;      // distance along the ray
      const v = (A[0] * cy - A[1] * cx) / den; // param on the segment
      // (the first cut divided by -den, silently rejecting ~30% of rays)
      if (u > best && v >= 0 && v <= 1) best = u;
    }
    out[s] = best;
  }
  return out;
}
const dxS = LENGTH_M / STATIONS;
const rHull = [];
for (let i = 0; i < STATIONS; i++) rHull.push(outlineAt((i + 0.5) * dxS));

/* ---- 2. the attach station, and the tangency-solved exponent ---- */
const iA = Math.min(STATIONS - 1, Math.round((ATTACH * LENGTH_M) / dxS - 0.5));
const xA = (iA + 0.5) * dxS, xTip = LENGTH_M + EXTRA_M;
const meanR = (i) => rHull[i].reduce((s, v) => s + v, 0) / SEGS;
const ra = meanR(iA);
// Hull slope at the attach point, central difference on the mean radius.
const hullSlope = (meanR(Math.min(STATIONS - 1, iA + 1)) - meanR(Math.max(0, iA - 1))) / (2 * dxS);
let P = process.env.FORCE_P ? Number(process.env.FORCE_P) : (-hullSlope * (xTip - xA)) / ra;
const P_CLAMPED = !(P > 0.15 && P < 4);
if (P_CLAMPED) P = 0.8;   // hull slope unusable — fall back to the authored value

/* ---- 3. loft: real outline forward, scaled real outline aft ---- */
// LINEAR INTERPOLATION BETWEEN STATIONS, not nearest-station snapping.
// Snapping makes the surface piecewise-CONSTANT in x, so every extra ring
// adds another step and the wetted area grows without bound: measured
// 266,518 -> 286,302 m2 going from 128 to 1024 rings, still climbing. That
// is a non-convergent construction and no number taken from it means
// anything. (The SHIPPED lathe has the same defect - it is why the
// surrogate came out +3.2% on hull wetted area.)
const shapeAt = (x) => {
  if (x <= xA) {
    const t = Math.max(0, Math.min(STATIONS - 1.0001, x / dxS - 0.5));
    const i = Math.floor(t), fr = t - i, j = Math.min(STATIONS - 1, i + 1);
    const a = rHull[i], b = rHull[j];
    return Array.from({ length: SEGS }, (_, k) => a[k] * (1 - fr) + b[k] * fr);
  }
  if (x >= xTip) return null;
  const k = Math.pow((xTip - x) / (xTip - xA), P);
  return Array.from(rHull[iA], (r) => r * k);
};
const verts = [], faces = [], ringStart = [];
for (let i = 0; i <= RINGS; i++) {
  const x = (xTip * i) / RINGS;
  const shape = shapeAt(x);
  const rmax = shape ? Math.max(...shape) : 0;
  if (!shape || rmax < 1e-6) { ringStart.push(verts.push([x, 0, 0]) - 1); continue; }
  ringStart.push(verts.length);
  for (let s = 0; s < SEGS; s++) {
    const th = -Math.PI + (2 * Math.PI * s) / SEGS;
    verts.push([x, shape[s] * Math.cos(th), shape[s] * Math.sin(th)]);
  }
}
const ringSize = (i) => (i < RINGS ? ringStart[i + 1] - ringStart[i] : verts.length - ringStart[i]);
for (let i = 0; i < RINGS; i++) {
  const a = ringStart[i], b = ringStart[i + 1];
  const aPole = ringSize(i) === 1, bPole = ringSize(i + 1) === 1;
  if (aPole && bPole) continue;
  for (let s = 0; s < SEGS; s++) {
    const s1 = (s + 1) % SEGS;
    if (aPole) faces.push([a, b + s, b + s1]);
    else if (bPole) faces.push([a + s, b, a + s1]);
    else { faces.push([a + s, b + s, b + s1]); faces.push([a + s, b + s1, a + s1]); }
  }
}

/* ---- 4. score it down the PRODUCTION path ---- */
const proxy = measureSectionalProxy(verts, faces, { axis: '+X' });
const geom = measureDynamicsGeometry(verts, faces, { flightAxis: 'X', lengthM: xTip });
const est = estimateCd(proxy, geom, SPEED_KMH);

const f = (x, n = 4) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : Number(x).toFixed(n));
const n0 = (x) => Math.round(x).toLocaleString('en-US');
const SHIPPED = { proxy: 0.16446152373387418, cd: 0.02145214901183327, frontal: 40056, wetted: 253919, friction: 0.00954, pressure: 0.01191 };

console.log('\n== TRUE-SECTION DEPLOYED BODY vs the shipped equal-area surrogate ==\n');
console.log(`  attach station   x = ${xA.toFixed(1)} m (${(100 * ATTACH).toFixed(0)}% of ${LENGTH_M} m), mean r = ${ra.toFixed(1)} m`);
console.log(`  hull slope there dr/dx = ${hullSlope.toFixed(4)}`);
console.log(`  TANGENCY-SOLVED exponent P = ${f(P, 3)}${P_CLAMPED ? '  (SOLVE REJECTED — fell back to the authored 0.8)' : '  (was an authored 0.8)'}`);
console.log(`  mesh ${n0(verts.length)} verts / ${n0(faces.length)} faces · oddFraction ${f(proxy.quality?.oddFraction, 5)}\n`);
console.log('                        SHIPPED surrogate     TRUE-section       delta');
const row = (label, a, b, dp = 4) => {
  const d = a ? `${(((b - a) / a) * 100).toFixed(2)}%` : '—';
  console.log(`  ${label.padEnd(20)} ${String(dp === 0 ? n0(a) : f(a, dp)).padStart(14)} ${String(dp === 0 ? n0(b) : f(b, dp)).padStart(16)} ${d.padStart(11)}`);
};
row('proxy', SHIPPED.proxy, proxy.proxy);
row('frontal area m2', SHIPPED.frontal, geom.frontalArea, 0);
row('WETTED area m2', SHIPPED.wetted, geom.wettedArea, 0);
row('friction Cd', SHIPPED.friction, est.frictionCd);
row('pressure Cd', SHIPPED.pressure, est.pressureCd);
row('Cd TOTAL', SHIPPED.cd, est.cdEstimate);
console.log(`\n  class ${proxy.cls} · status ${est.status}`);
console.log('\n  Reminder of what can and cannot move here: the proxy is a function of');
console.log('  the AREA curve, which both constructions preserve, so the pressure term');
console.log('  should barely shift. Wetted area is the term with something to say.');
