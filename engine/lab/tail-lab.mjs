/**
 * TAIL LAB — a dev-only SCREENING INSTRUMENT for tail-shape variations
 * (Toby's ask, 2026-08-16: "I use this calculator to try variations" —
 * cone vs needle, aft-angle trades, minimal-material tails).
 *
 * NEVER DEPLOYS: lab/ is not in the bake list (only src/vendor/web bake).
 * Run from CalcV2: `node lab/tail-lab.mjs`
 *
 * THE TRICK (and why no CAD is needed): the estimator's CONSUMED score
 * depends only on the sectional area profile A(x) — the equal-A(x)
 * blindness that is a documented limitation elsewhere is an exact
 * EQUIVALENCE here. Grafting an axisymmetric tail onto the Sunship's own
 * MEASURED r(x) profile produces, at the scorer's level, exactly what a
 * meshed hull+tail body would produce. So: measure the real hull once,
 * append parametric tails as pure profile math, score with the FROZEN
 * estimator. No mesh surgery, no ray noise, instant sweeps.
 *
 * TAIL MODEL — the TANGENT CONE fairing: for a chosen aft half-angle α,
 * the tightest cone (apex on the axis, surface slope tan α) that clears
 * the hull's aft profile. Where the cone governs, closure slope is
 * exactly tan α; where the hull is already gentler, the hull's own shape
 * survives. One parameter, physically the "fairing" a real tail creates.
 * The NEEDLE variant models Toby's suspected CAD tail: a steep shoulder
 * cone down to a thin hub, then an ultra-long thin spike.
 *
 * HONESTY GRADE: everything here inherits the estimator's screening
 * character (±20% band, smooth-body calibration) — these are estimates
 * for RANKING tail variants, not validations of any authored number.
 * The Smart Tail's ACTIVE claims (wake conditioning, BLI) are outside
 * geometry entirely; this lab measures the tail-as-fairing half only.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjMesh } from '../src/obj.js';
import { measureSections, scoreSections } from '../src/sections.js';
import { calibratePressure, classifySections } from '../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../src/dynamicsGeometry.js';
import { ittcCf, NU_M2_S } from '../src/dynamicsCore.js';

const here = dirname(fileURLToPath(import.meta.url));
const SUNSHIP = join(here, '..', '..', '..', '3D OBJ', 'Sunship.obj');
const LENGTH_M = 300, SPEED_KMH = 100;
const V = SPEED_KMH / 3.6;

// ---- 1. Measure the real hull once (the same call the engine makes) ----
const mesh = parseObjMesh(readFileSync(SUNSHIP, 'utf8'));
const m = measureSections(mesh.verts, mesh.faces, { axis: '+Z', STATIONS: 256 });
const geom = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'Z', lengthM: LENGTH_M });

const N = m.A.length;
const scale = LENGTH_M / m.L;              // metres per mesh unit
const cellM = m.cell * scale;              // station cell size in metres
const dx = LENGTH_M / N;                   // station spacing in metres
// Equivalent radius per station, metres (same-area circle — the scorer's view).
const rHull = Array.from(m.A, (a) => Math.sqrt((a * cellM * cellM) / Math.PI));

// ---- 2. Profile → estimate, via the frozen production pipeline ----
/** Wetted area of a surface of revolution r(x), plus closing disc(s). */
function lateralArea(r, step) {
  let s = 0;
  for (let i = 0; i + 1 < r.length; i++) {
    s += Math.PI * (r[i] + r[i + 1]) * Math.hypot(step, r[i + 1] - r[i]);
  }
  return s;
}
/** Score + estimate a radius profile (metres). Returns the frozen-API view. */
function evaluate(r, label) {
  const L = r.length * dx;
  const A = new Float64Array(r.length);
  for (let i = 0; i < r.length; i++) A[i] = (Math.PI * r[i] * r[i]) / (cellM * cellM);
  const rec = { A, L, cell: cellM, minX: 0, maxX: L, frontalCells: m.frontalCells, compactness: m.compactness, quality: m.quality, silhouettes: null };
  const s = scoreSections(rec);
  // Wetted: the real hull's TRUSTED wetted area + the tail's added skin
  // (lateral surface beyond the hull's own length, minus the base disc
  // the tail now covers). Screening-grade bookkeeping, stated openly.
  const baseDisc = Math.PI * rHull[N - 1] * rHull[N - 1];
  const tailLateral = lateralArea(r.slice(N - 1), dx);
  const wetted = geom.wettedArea - baseDisc + tailLateral;
  const re = (V * L) / NU_M2_S;
  const friction = ittcCf(re) * (wetted / geom.frontalArea);
  // DEFECT 1, fixed 2026-08-18: this used to be `calibratePressure(proxy)`
  // with no class, so the default parameter (`cls = 'pinned'`) applied and
  // EVERY row — including the bare-hull sanity row — was priced on the
  // conservative line. Production classifies this hull as ROUNDED, so the
  // lab reported the bare Sunship at 0.438 where the shipped estimator says
  // 0.179, inflating every tail's apparent benefit. The sanity row existed
  // to catch exactly this and could not, because it was never compared
  // against the production value. Now the class comes from the SAME
  // classifier the engine uses, and Re travels too (vRE).
  const { cls, triggers } = classifySections(rec, s);
  const reD = (V * Math.sqrt((4 * geom.frontalArea) / Math.PI)) / NU_M2_S;
  const pressure = calibratePressure(s.compositeV1, cls, reD);
  return {
    label,
    addedLenM: L - LENGTH_M,
    addedWettedPct: 100 * (wetted - geom.wettedArea) / geom.wettedArea,
    softAft: s.softAft,
    proxy: s.compositeV1,
    cls,
    reExpansion: s.softAft > 1e-9 ? s.softAftRaw / s.softAft : 1,
    triggers,
    friction,
    pressure,
    cd: friction + pressure,
  };
}

/** Tangent-cone fairing at aft half-angle alphaDeg.
 *
 *  FIXED 2026-08-18, same defect as curvedClosure: the old version built
 *  the tightest cone clearing the WHOLE hull and then appended it beyond
 *  x = 300 m, which on a hull that has already closed to 4.11 m produces
 *  a backward-facing step of tens of metres. Now the cone is anchored to
 *  the station where it is genuinely TANGENT — the attach point whose
 *  cone encloses everything aft of it — and governs from there, so the
 *  surfaces meet. Where the cone lies inside the hull forward of that
 *  station, the hull's own shape survives, which was always the intent. */
function tangentCone(alphaDeg) {
  const t = Math.tan((alphaDeg * Math.PI) / 180);
  // Tangency: the anchor whose cone tip lies furthest aft is the one that
  // clears every station behind it.
  let ia = 0, xTip = 0;
  for (let i = 0; i < N; i++) {
    const tip = (i + 0.5) * dx + rHull[i] / t;
    if (tip > xTip) { xTip = tip; ia = i; }
  }
  const xA = (ia + 0.5) * dx;
  const total = Math.ceil(xTip / dx);
  const r = new Array(total);
  for (let i = 0; i < total; i++) {
    const x = (i + 0.5) * dx;
    r[i] = i <= ia ? rHull[i] : Math.max(0, t * (xTip - x));
  }
  return r;
}

/** Needle tail: steep shoulder cone (shoulderDeg) from the hull base down
 *  to rHub, then a thin linear spike of needleLenM to a point. */
function needleTail(shoulderDeg, rHubM, needleLenM) {
  const t = Math.tan((shoulderDeg * Math.PI) / 180);
  const r0 = rHull[N - 1];
  const shoulderLen = Math.max(0, (r0 - rHubM) / t);
  const total = N + Math.ceil((shoulderLen + needleLenM) / dx);
  const r = new Array(total);
  for (let i = 0; i < total; i++) {
    if (i < N) { r[i] = rHull[i]; continue; }
    const x = (i - N + 0.5) * dx; // distance beyond the hull base
    r[i] = x < shoulderLen
      ? r0 - t * x
      : Math.max(0, rHubM * (1 - (x - shoulderLen) / needleLenM));
  }
  return r;
}

/** DEFECT 2, fixed 2026-08-18 — THE STEP.
 *
 *  The original construction set C from "the minimal curve clearing the
 *  WHOLE hull", then appended that curve beyond x = 300 m. That is right
 *  for a BLUNT-STERNED body, where the curve meets the hull near its flat
 *  base. The Sunship is not one: it already closes from 113 m radius to
 *  4.11 m by x = 300. The minimal clearing curve still stands at 91.7 m
 *  when it gets there, so the profile jumped 4.11 -> 91.7 m in one
 *  station — an 87.6 m BACKWARD-FACING STEP. Re-expansion ratio 4.79
 *  against the classifier's 1.15 trigger; the lab never saw it because it
 *  bypassed the classifier (defect 1). Every "curved" row in the old
 *  table was scored on a body that cannot exist.
 *
 *  THE FIX: anchor the fairing to a station on the hull and let it govern
 *  from there, so the surfaces meet. r(x) = ra · ((x_tip − x)/(x_tip −
 *  x_a))^p passes exactly through (x_a, r_a) — no step, by construction.
 *  A tail can only REPLACE the hull's own aft closure; it cannot be
 *  bolted onto a body that has already closed (a needle at the real aft
 *  point measures 0.1777 against a bare 0.1786 — i.e. nothing).
 *
 *  p < 1 is fat/bulging, p > 1 is thin/needle-like, p = 1 is a straight
 *  cone. Both extremes lose: fat drowns in skin friction, thin sheds the
 *  body's area too abruptly at the shoulder. Optimum ~0.8.
 *
 *  @param attachFrac  where the fairing picks up, as a fraction of hull
 *                     length. 0.80 wraps the rear 20%.
 */
function curvedClosure(addedLenM, p, attachFrac = 0.80) {
  const xTip = LENGTH_M + addedLenM;
  const ia = Math.min(N - 1, Math.max(0, Math.round((attachFrac * LENGTH_M) / dx - 0.5)));
  const ra = rHull[ia];
  const xA = (ia + 0.5) * dx;
  const total = Math.ceil(xTip / dx);
  const r = new Array(total);
  for (let i = 0; i < total; i++) {
    const x = (i + 0.5) * dx;
    r[i] = i <= ia
      ? rHull[i]
      : (x < xTip ? ra * Math.pow((xTip - x) / (xTip - xA), p) : 0);
  }
  return r;
}

/** STEPPED construction (Toby clarification: the cones are 3D SOLIDS —
 *  nested shells — so the real outer surface has small radial steps at
 *  each layer transition, not one smooth skin). Model: the curved
 *  envelope plus an offset that drops by stepM at each of K evenly
 *  spaced transitions — nested shells thick at the shoulder, flush at
 *  the tip. Each step is a tiny cliff; the estimator prices it. */
function steppedEnvelope(addedLenM, p, K, stepM) {
  const smooth = curvedClosure(addedLenM, p);
  const tailStart = N, tailLen = smooth.length - N;
  const r = smooth.slice();
  for (let i = tailStart; i < smooth.length; i++) {
    const frac = (i - tailStart) / tailLen;
    const layersRemaining = K - Math.floor(frac * K) - 1;
    r[i] = smooth[i] + Math.max(0, layersRemaining) * stepM;
  }
  return r;
}

/** CABLE ALLOWANCE (Toby: "many many thin cables... may have some
 *  effect"). The cables are sub-cell for the sectional model — priced
 *  here as a declared appendage allowance instead, the same discipline
 *  TR-397 demands: ΔCd_A ≈ n · Cd_cable · d · L_exposed / A_frontal.
 *  Round cylinder at cable Re (~1e5–1e6): Cd ≈ 1.0 (worse in the
 *  subcritical regime); a streamlined cable FAIRING cuts that ~10×.
 *  NOT part of any estimate — a stated add-on, screening grade. */
function cableAllowanceTable() {
  console.log('\n== cable appendage allowance (NOT in the estimates above — add to taste) ==');
  console.log('n cables  diam m  exposed m   ΔCd round   ΔCd faired(≈/10)   vs 0.043');
  for (const [n, d, L] of [[50, 0.02, 250], [100, 0.02, 250], [100, 0.05, 250], [200, 0.05, 300]]) {
    const dCd = (n * 1.0 * d * L) / geom.frontalArea;
    console.log(`${String(n).padStart(8)} ${d.toFixed(2).padStart(7)} ${String(L).padStart(10)}` +
      `  ${dCd.toFixed(4).padStart(10)} ${(dCd / 10).toFixed(4).padStart(12)}` +
      `        ${(100 * dCd / 0.043).toFixed(0).padStart(5)}%`);
  }
  console.log('round cables are NOT negligible at scale — fairings (or keeping cables inside the skin) matter.');
}

// ---- 3. The sweep ----
const f3 = (x) => x.toFixed(3);
console.log('== TAIL LAB — frozen estimator over parametric tails on the MEASURED Sunship profile ==');
console.log(`hull: ${LENGTH_M} m, frontal ${Math.round(geom.frontalArea).toLocaleString()} m², wetted ${Math.round(geom.wettedArea).toLocaleString()} m², base radius ${f3(rHull[N - 1])} m`);
console.log(`estimates at ${SPEED_KMH} km/h · screening grade (±20% band) · authored with-tail claim: 0.043\n`);
console.log('variant                          +len m  +wet %   softAft   Cd est   vs bare  vs 0.043');

const bare = evaluate(rHull.slice(), 'BARE HULL (sanity)');
const rows = [bare];
for (const a of [40, 30, 25, 20, 15, 12, 10, 8]) rows.push(evaluate(tangentCone(a), `tangent cone ${a}°`));
rows.push(evaluate(needleTail(45, 2, 60), 'NEEDLE: 45° shoulder + 60 m spike'));
rows.push(evaluate(needleTail(45, 2, 150), 'NEEDLE: 45° shoulder + 150 m spike'));
rows.push(evaluate(needleTail(25, 4, 80), 'hybrid: 25° cone + 80 m spike'));
// Toby's sketched architecture: curved (concave) envelope, fixed lengths.
for (const len of [150, 200, 300, 400]) {
  for (const p of [0.6, 0.8, 1.0, 1.4]) {
    rows.push(evaluate(curvedClosure(len, p), `curved +${len} m, p=${p}${p === 1 ? ' (straight)' : p < 1 ? ' (concave)' : ' (convex)'}`));
  }
}
// Nested-shell construction: the same +300 m concave envelope with K
// layer-transition steps of stepM — how much does stepped skin cost?
for (const [K, step] of [[4, 0.3], [6, 0.3], [6, 1.0], [6, 2.0]]) {
  rows.push(evaluate(steppedEnvelope(300, 0.6, K, step), `stepped +300 m p=0.6, ${K}×${step} m steps`));
}

for (const r of rows) {
  console.log(
    `${r.label.padEnd(32)} ${r.addedLenM.toFixed(0).padStart(5)} ${r.addedWettedPct.toFixed(1).padStart(7)}` +
    `  ${f3(r.softAft).padStart(8)} ${f3(r.cd).padStart(8)}  ${(100 * r.cd / bare.cd).toFixed(0).padStart(6)}%` +
    `  ${(r.cd / 0.043).toFixed(1).padStart(6)}×`);
}
// ---- 4. Length ladder + crossing finder (Toby's ask 2026-08-16:
// "the point of length at which concave / gentler concave reach ~0.05
// — don't just assume 300 m") ----
function cdAt(len, p) { return evaluate(curvedClosure(len, p), '').cd; }
/** Bisect the added length where Cd first reaches target (Cd is
 *  monotone-decreasing in length until the friction floor; guarded). */
function lengthFor(target, p, lo = 40, hi = 600) {
  if (cdAt(hi, p) > target) return NaN;   // never reaches it before the floor
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    (cdAt(mid, p) > target) ? (lo = mid) : (hi = mid);
  }
  return (lo + hi) / 2;
}
console.log('\n== length ladder, concave envelopes (25 m steps) ==');
console.log('+len m    p=0.6 Cd   p=0.8 Cd');
for (let len = 150; len <= 350; len += 25) {
  console.log(`${String(len).padStart(6)}   ${cdAt(len, 0.6).toFixed(4).padStart(8)}   ${cdAt(len, 0.8).toFixed(4).padStart(8)}`);
}
console.log('\n== crossing lengths (bisection, ±1 m) ==');
for (const target of [0.09, 0.05, 0.043, 0.03]) {
  const a = lengthFor(target, 0.6), b = lengthFor(target, 0.8);
  console.log(`Cd ${target.toFixed(3)}:  p=0.6 at +${Number.isFinite(a) ? a.toFixed(0) : '—'} m   p=0.8 at +${Number.isFinite(b) ? b.toFixed(0) : '—'} m`);
}
console.log('(screening grade: the ±20% band applies to every number above)');

cableAllowanceTable();

console.log('\nsanity: BARE must reproduce the engine estimate ~0.438 (same profile, same pipeline).');
console.log('Reading: softAft is "how hard air is asked to close behind" — the cone angle IS the knob.');
