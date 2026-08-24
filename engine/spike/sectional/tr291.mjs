/**
 * TR-291 C-CLASS FINENESS-RATIO EXAM — PUBLISHED-OFFSET GEOMETRY, EIGHT HULLS (2026-08-19).
 *
 * The third instance of the tn614 / tr432-akron pipeline, and the first
 * one aimed squarely at the estimator's WEAKEST region: the fat-body
 * mid-map where the bare Sunship (fineness 1.33, proxy 0.77) lives and
 * where the calibration currently interpolates between real streamlined
 * knots and TEXTBOOK bluff anchors with nothing measured between.
 *
 * HELD OUT PERMANENTLY. See TR291-PREREGISTRATION.md, committed BEFORE
 * the PDF was opened. None of these eight may become a calibration knot,
 * whatever the result. TN-614 carries the scar of spending validation
 * data as calibration; this file does not repeat it.
 *
 * SOURCE: NACA Report No. 291, "Drag of C-Class Airship Hulls of Various
 * Fineness Ratios", A. F. Zahm, R. H. Smith, F. A. Louden (NTRS
 * 19930091360, public domain, fetched 2026-08-19). Navy Aerodynamic
 * Laboratory, Washington, 8 BY 8 FOOT tunnel, models at 0 deg pitch and
 * 0 deg yaw, 20-60 mph.
 *
 * GEOMETRY (Table I, page 11, read from a 300-dpi render; clean reprint,
 * no ambiguous glyphs): 33 stations, "specified radius" in INCHES. The
 * eight hulls are ONE profile axially stretched — identical radius
 * ordinates and an identical 7.700 in maximum diameter for all eight,
 * with only the inter-station interval changing (0.16042 in at fineness
 * 1.0 to 1.60417 in at 10.0). Two consequences worth stating:
 *   - FRONTAL AREA IS IDENTICAL ACROSS THE FAMILY, so ordering by
 *     measured drag FORCE is exactly ordering by frontal Cd. No
 *     conversion is needed to rank them.
 *   - it is a pure fineness sweep: nose and tail stretch too, so this is
 *     not "same nose, longer parallel body".
 *
 * TRANSCRIPTION VERIFIED against an independently published quantity:
 * the lathe volume reproduces all eight of Table I's published model
 * volumes (worst 0.8%, most under 0.1%), and L/D from the transcribed
 * geometry returns 1.000/1.500/2.000/3.000/4.621/6.000/8.000/10.000
 * against the nominal fineness ratios. Fixtures passing is not
 * correctness; this is the independent check.
 *
 * MEASURED DRAG (Table IV, page 14): net resistance at 40 mph, plus the
 * disk ratio. Self-verifying — R x disk-ratio returns the report's own
 * 1.544 lb disk force for all eight rows. Reduced to frontal Cd here
 * with q from the report's own density; the thin-disk cross-check comes
 * out at Cd 1.169 against the textbook 1.17, which independently
 * confirms the area and unit chain.
 *
 * COEFFICIENT BASIS: the report's "shape coefficient" is VOLUMETRIC,
 * Cs = 2R/[rho (Vol)^(2/3) V^2] — not frontal. This file does not use
 * it as the comparison basis; it goes to the force in pounds directly
 * and forms frontal Cd itself. Cs is reproduced only as a check that the
 * reduction agrees with the report's own Table III (it does, to
 * rounding).
 *
 * BLOCKAGE: frontal 0.3234 sq ft in a 64 sq ft tunnel = 0.505%, and
 * IDENTICAL for all eight because the diameter is. The handover's worry
 * that the fineness-1.0 point would be blockage-spoiled does not
 * survive contact with the report. No blockage correction is warranted
 * and the report applies none; its "corrections" (figs. 5-12) are
 * mounting tare, gross vs net.
 *
 * REYNOLDS — THE REAL LIMITATION HERE. 2.3e5 (fineness 1.0) to 2.3e6
 * (fineness 10) on length at 40 mph. That is LOW, and below the range
 * ITTC-1957 is meant for. The models are varnished laminated pine and
 * almost certainly carry a substantial laminar run, while the estimator
 * applies a fully-turbulent friction line. This inflates the predicted
 * friction, MOST at high fineness (where wetted/frontal is large) and
 * LEAST at low fineness — i.e. least where we care most. A laminar
 * (Blasius) sensitivity is printed alongside so the reader can see how
 * much of any gap is this confound rather than the shape mapping.
 * Nothing here tests the Re 1e9 extrapolation. Separate problem.
 *
 * ROUGHNESS: the production ks = 0.43 mm allowance switches on above
 * Re_on = [10/(cbrt(ks/L) + 0.000125/0.044)]^3. Every one of these
 * models sits BELOW its own switch-on, so the allowance is exactly zero
 * throughout — which is the physically right answer for small varnished
 * models. Asserted in the run, not assumed.
 *
 * DISCIPLINE: frozen estimator, frozen calibration, production entry
 * point (estimateCd), nothing tuned, no calibration change follows.
 */
import { measureSectionalProxy, estimateCd } from '../../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf, roughnessAllowanceCf, NU_M2_S } from '../../src/dynamicsCore.js';
import { latheProfile } from './tn614-bodies.mjs';

/* ---- Table I: specified radius in inches, by station (0 = nose, 48 = stern) ---- */
export const TR291_OFFSETS_IN = [
  [0, 0], [1, 1.001], [2, 1.747], [3, 2.286], [4, 2.688], [5, 2.982], [6, 3.204],
  [7, 3.379], [8, 3.511], [10, 3.683], [12, 3.779], [14, 3.830], [16, 3.849],
  [16.6, 3.850], [18, 3.840], [20, 3.797], [22, 3.738], [24, 3.659], [26, 3.558],
  [28, 3.443], [30, 3.318], [32, 3.170], [34, 3.005], [36, 2.817], [38, 2.608],
  [40, 2.369], [41, 2.236], [42, 2.098], [43, 1.945], [44, 1.766], [45, 1.554],
  [46, 1.281], [47, 0.912], [48, 0],
];
const N_STATIONS = 48;

/* ---- Table I dimensions block + Table IV net resistance at 40 mph ---- */
export const TR291_HULLS = [
  { fr: 1.00, interval: 0.16042, lengthIn: 7.700, volFt3: 0.134, r40: 0.1182, diskRatio: 13.06 },
  { fr: 1.50, interval: 0.24063, lengthIn: 11.550, volFt3: 0.202, r40: 0.0714, diskRatio: 21.62 },
  { fr: 2.00, interval: 0.32083, lengthIn: 15.400, volFt3: 0.269, r40: 0.0610, diskRatio: 25.31 },
  { fr: 3.00, interval: 0.48125, lengthIn: 23.100, volFt3: 0.404, r40: 0.0681, diskRatio: 22.67 },
  { fr: 4.62, interval: 0.74125, lengthIn: 35.580, volFt3: 0.627, r40: 0.0836, diskRatio: 18.47 },
  { fr: 6.00, interval: 0.96250, lengthIn: 46.200, volFt3: 0.807, r40: 0.1058, diskRatio: 14.59 },
  { fr: 8.00, interval: 1.28333, lengthIn: 61.600, volFt3: 1.077, r40: 0.1363, diskRatio: 11.33 },
  { fr: 10.00, interval: 1.60417, lengthIn: 77.000, volFt3: 1.345, r40: 0.1624, diskRatio: 9.51 },
];

/* ---- test condition ---- */
const D_FT = 0.6417;                       // max model diameter, all eight (Table III note)
const A_FT2 = Math.PI * D_FT * D_FT / 4;
const RHO = 0.00237;                       // slug/ft^3, the report's own value
const MPH = 40;
const V_FPS = MPH * 5280 / 3600;
const Q = 0.5 * RHO * V_FPS * V_FPS;
const KMH = MPH * 1.609344;
const K_DISK = 0.00298;                    // lb/ft^2/mi^2/hr^2 (report)

const f3 = (x) => x.toFixed(3);
const f4 = (x) => x.toFixed(4);
const pct = (a, b) => `${a >= b ? '+' : ''}${(100 * (a - b) / b).toFixed(1)}%`;

/** Profile as the lathe wants it: [x %L, r %L]. */
function profileFor(lengthIn) {
  return TR291_OFFSETS_IN.map(([st, rIn]) => [
    (st / N_STATIONS) * 100,
    (rIn / lengthIn) * 100,
  ]);
}

function scoreHull(h, rings, segs) {
  const lengthM = h.lengthIn * 0.0254;
  const mesh = latheProfile(profileFor(h.lengthIn), rings, segs);
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM });
  const p = measureSectionalProxy(mesh.verts, mesh.faces, { axis: '+X' });
  const est = estimateCd(p, g, KMH);
  return { h, g, p, est, lengthM };
}

console.log('== TR-291 C-CLASS FINENESS EXAM — eight published hulls vs the frozen estimator ==');
console.log('HELD OUT. Pre-registered in TR291-PREREGISTRATION.md before the PDF was opened.\n');

/* ---------- 1. the measured data, and its independent checks ---------- */
const rDisk = K_DISK * A_FT2 * MPH * MPH;
console.log('-- measured data reduction --');
console.log(`frontal area ${f4(A_FT2)} ft^2 (all eight) · q40 ${f4(Q)} lb/ft^2 · blockage ${(100 * A_FT2 / 64).toFixed(3)}% of 8x8 ft`);
console.log(`disk force ${f3(rDisk)} lb vs report 1.544 · implied disk Cd ${f4(rDisk / (Q * A_FT2))} vs textbook thin disk ~1.17`);
for (const h of TR291_HULLS) {
  h.cdMeasured = h.r40 / (Q * A_FT2);
  h.csVol = 2 * h.r40 / (RHO * Math.pow(h.volFt3, 2 / 3) * V_FPS * V_FPS);
  const back = rDisk / h.diskRatio;
  if (Math.abs(back - h.r40) > 0.0008) console.log(`  !! disk-ratio mismatch at f.r. ${h.fr}: ${f4(back)} vs ${f4(h.r40)}`);
}
console.log('disk-ratio round-trip: all eight consistent\n');

/* ---------- 2. discretisation sweep (never quote an unconverged mesh) ---------- */
console.log('-- discretisation sweep, fineness 1.00 and 10.00 (the extremes) --');
console.log('rings x segs   proxy(f.r.1)  Cd(f.r.1)   proxy(f.r.10)  Cd(f.r.10)');
for (const [rings, segs] of [[64, 24], [96, 28], [128, 36], [192, 48], [256, 64]]) {
  const a = scoreHull(TR291_HULLS[0], rings, segs);
  const b = scoreHull(TR291_HULLS[7], rings, segs);
  console.log(`${String(rings).padStart(4)} x ${String(segs).padStart(3)}     ${f4(a.p.proxy).padEnd(13)} ${f4(a.est.cdEstimate).padEnd(11)} ${f4(b.p.proxy).padEnd(14)} ${f4(b.est.cdEstimate)}`);
}
console.log();

/* ---------- 3. the exam ---------- */
const RINGS = 192, SEGS = 48;
console.log(`-- scored at ${RINGS} x ${SEGS}, production path (measureSectionalProxy -> estimateCd), ${MPH} mph --\n`);
const rows = TR291_HULLS.map((h) => scoreHull(h, RINGS, SEGS));

console.log('f.r.   L(m)     Re_L      w/f     proxy   class    friction  pressure  PREDICTED  MEASURED  error');
for (const r of rows) {
  const { h, g, p, est } = r;
  const re = (KMH / 3.6) * r.lengthM / NU_M2_S;
  h.cdPredicted = est.cdEstimate;
  h.proxy = p.proxy;
  h.cls = p.cls;
  h.friction = est.frictionCd;
  h.pressure = est.pressureCd;
  h.wf = g.wettedOverFrontal;
  h.re = re;
  // roughness must be zero at these scales — assert, do not assume
  const rough = roughnessAllowanceCf(r.lengthM, re);
  if (rough !== 0) console.log(`  !! roughness allowance non-zero at f.r. ${h.fr}: ${rough}`);
  console.log(
    `${String(h.fr).padEnd(6)} ${f3(r.lengthM).padEnd(8)} ${re.toExponential(2).padEnd(9)} ${f3(g.wettedOverFrontal).padEnd(7)} ${f3(p.proxy).padEnd(7)} ${String(p.cls).padEnd(8)} ${f4(est.frictionCd).padEnd(9)} ${f4(est.pressureCd).padEnd(9)} ${f4(est.cdEstimate).padEnd(10)} ${f4(h.cdMeasured).padEnd(9)} ${pct(est.cdEstimate, h.cdMeasured)}`,
  );
}
console.log('\nroughness allowance: zero for all eight (all below their own switch-on Re) — asserted above');

/* ---------- 4. geometry cross-check against the report's own volumes ---------- */
console.log('\n-- mesh vs published geometry --');
console.log('f.r.   frontal mesh/pub              volume mesh/pub');
for (const r of rows) {
  const frontalFt2 = r.g.frontalArea / (0.3048 * 0.3048);
  const volFt3 = (r.g.volume ?? NaN) / Math.pow(0.3048, 3);
  console.log(`${String(r.h.fr).padEnd(6)} ${f4(frontalFt2)} / ${f4(A_FT2)}  ${pct(frontalFt2, A_FT2).padEnd(8)}  ${Number.isFinite(volFt3) ? `${f3(volFt3)} / ${f3(r.h.volFt3)}  ${pct(volFt3, r.h.volFt3)}` : 'n/a'}`);
}

/* ---------- 5. ORDERING — the primary result ---------- */
console.log('\n-- ORDERING (the primary result, as in TN-614) --');
const byMeas = [...TR291_HULLS].sort((a, b) => a.cdMeasured - b.cdMeasured);
const byPred = [...TR291_HULLS].sort((a, b) => a.cdPredicted - b.cdPredicted);
console.log('measured  (low Cd -> high): ' + byMeas.map((h) => h.fr.toFixed(2)).join('  '));
console.log('predicted (low Cd -> high): ' + byPred.map((h) => h.fr.toFixed(2)).join('  '));

let inversions = 0; const inv = [];
for (let i = 0; i < TR291_HULLS.length; i++) {
  for (let j = i + 1; j < TR291_HULLS.length; j++) {
    const a = TR291_HULLS[i], b = TR291_HULLS[j];
    const dm = Math.sign(a.cdMeasured - b.cdMeasured);
    const dp = Math.sign(a.cdPredicted - b.cdPredicted);
    if (dm !== dp) { inversions++; inv.push(`${a.fr} vs ${b.fr} (measured ${f4(a.cdMeasured)}/${f4(b.cdMeasured)}, predicted ${f4(a.cdPredicted)}/${f4(b.cdPredicted)})`); }
  }
}
const nPairs = 28;
console.log(`pairwise inversions: ${inversions} of ${nPairs}  ->  rank agreement ${((1 - inversions / nPairs) * 100).toFixed(0)}%`);
for (const s of inv) console.log('   inverted: ' + s);

const rank = (arr, key) => { const s = [...arr].sort((a, b) => a[key] - b[key]); return arr.map((h) => s.indexOf(h) + 1); };
const rm = rank(TR291_HULLS, 'cdMeasured'), rp = rank(TR291_HULLS, 'cdPredicted');
const n = TR291_HULLS.length;
const d2 = rm.reduce((s, v, i) => s + (v - rp[i]) ** 2, 0);
console.log(`Spearman rho = ${(1 - 6 * d2 / (n * (n * n - 1))).toFixed(3)}`);

/* ---------- 6. the minimum, and the fat end ---------- */
console.log('\n-- the two questions that matter --');
console.log(`measured minimum-drag fineness:  ${byMeas[0].fr}  (Cd ${f4(byMeas[0].cdMeasured)})`);
console.log(`predicted minimum-drag fineness: ${byPred[0].fr}  (Cd ${f4(byPred[0].cdPredicted)})`);
const fat = TR291_HULLS.filter((h) => h.fr <= 1.5);
console.log('\nTHE FAT END — the region the bare Sunship (fineness 1.33, proxy 0.77) actually lives in:');
for (const h of fat) {
  console.log(`  f.r. ${h.fr}: proxy ${f3(h.proxy)} class ${h.cls} · predicted ${f4(h.cdPredicted)} vs measured ${f4(h.cdMeasured)} → ${pct(h.cdPredicted, h.cdMeasured)}`);
}

/* ---------- 7. laminar sensitivity — how much of the gap is the low-Re confound ---------- */
console.log('\n-- laminar (Blasius) friction sensitivity: the low-Re confound, bounded --');
console.log('The truth lies between these two lines; ITTC is the production choice.');
console.log('f.r.   Cf_ITTC   Cf_lam    pred(ITTC)  pred(laminar)  measured   err(ITTC)  err(lam)');
for (const h of TR291_HULLS) {
  const cfT = ittcCf(h.re);
  const cfL = 1.328 / Math.sqrt(h.re);
  const predL = cfL * h.wf + h.pressure;
  console.log(`${String(h.fr).padEnd(6)} ${f4(cfT).padEnd(9)} ${f4(cfL).padEnd(9)} ${f4(h.cdPredicted).padEnd(11)} ${f4(predL).padEnd(14)} ${f4(h.cdMeasured).padEnd(10)} ${pct(h.cdPredicted, h.cdMeasured).padEnd(10)} ${pct(predL, h.cdMeasured)}`);
}

console.log('\nZERO tracing in this chain. Frozen estimator, frozen calibration, production entry point.');
console.log('No calibration change follows from this file. These eight are held out permanently.');

/* ---------- 8. DIAGNOSIS — isolate the pressure term, and the regime ---------- */
import { calibratePressure, crisisBlend, CRISIS_WINDOW_RED } from '../../src/cdEstimator.js';

console.log('\n\n== DIAGNOSIS: which part of the estimator produced the gap? ==');
console.log('\nThe calibration predicts PRESSURE. Isolate it: implied measured pressure =');
console.log('measured total Cd - ITTC friction (the ledger\'s own standard knot method).');
console.log('Both calibration lines are shown at each hull\'s proxy, so the regime blend');
console.log('is separated from the shape mapping.\n');
console.log('f.r.   proxy   Re_D      blend  P_sub    P_high   P_impl(meas)  sub/meas  high/meas');
for (const h of TR291_HULLS) {
  const reD = h.re / (h.lengthIn / (2 * 3.850));       // Re on equivalent diameter
  const b = crisisBlend(reD);
  const pSub = calibratePressure(h.proxy, 'rounded', 1);          // reD=1 -> fully subcritical
  const pHigh = calibratePressure(h.proxy, 'rounded');            // omitted reD -> high line
  const pImpl = h.cdMeasured - h.friction;
  console.log(`${String(h.fr).padEnd(6)} ${f3(h.proxy).padEnd(7)} ${reD.toExponential(2).padEnd(9)} ${b.toFixed(2).padEnd(6)} ${f4(pSub).padEnd(8)} ${f4(pHigh).padEnd(8)} ${f4(pImpl).padEnd(13)} ${(pSub / pImpl).toFixed(1).padStart(5)}x    ${(pHigh / pImpl).toFixed(1).padStart(5)}x`);
}
console.log(`\ncrisis window (declared) Re_D ${CRISIS_WINDOW_RED[0].toExponential(1)}..${CRISIS_WINDOW_RED[1].toExponential(1)}`);
console.log('Every hull shares the SAME diameter, so every hull sits at the SAME Re_D and');
console.log('the SAME blend. The regime choice therefore cannot explain a fineness-dependent');
console.log('failure — it is common to all eight.');

console.log('\n-- the same question at the bare Sunship\'s proxy --');
for (const x of [0.707, 0.770]) {
  console.log(`  proxy ${x.toFixed(3)}: subcritical line ${f4(calibratePressure(x, 'rounded', 1))} · high-Re line ${f4(calibratePressure(x, 'rounded'))}`);
}
console.log('  TR-291 measured, at proxy 0.707: implied pressure ' + f4(TR291_HULLS[0].cdMeasured - TR291_HULLS[0].friction) + ' (subcritical Re_D, so the high-Re value would be this or LOWER)');
