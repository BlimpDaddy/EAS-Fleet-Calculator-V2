/**
 * GÖTTINGEN ERGEBNISSE II ELLIPSOIDS — MID-MAP CORPUS HUNT, STAGING
 * ONLY (2026-08-16). NOT an exam run. This file answers the hunt's
 * gating question — do these bodies POPULATE the unvalidated proxy
 * region 0.2–0.8? — and stages the data for a future exam under
 * frozen rules. NO predictions-vs-measured comparison is printed
 * here; that is the exam, and it runs only after pre-registration
 * (owner + reviewer), per the standing kill-test discipline (r14).
 *
 * SOURCE: "Ergebnisse der Aerodynamischen Versuchsanstalt zu
 * Göttingen", II. Lieferung (Prandtl/Betz/Wieselsberger), R.
 * Oldenbourg, München 1923 — section 3b "Der Widerstand von Kugeln,
 * Ellipsoiden und Scheiben", pp. 28–32. Public domain. Acquired
 * 2026-08-16 from the archive.org scan `ergebnissederaer02betzuoft`
 * (OCR full text; page images available in the same item).
 *
 * BODIES (the only ellipsoids in this volume):
 *  - Zahlentafel 35: OBLATE ellipsoid of revolution, transverse
 *    diameter d = 200 mm, length along flow l = 150 mm
 *    (Achsenverhältnis 1:0.75) — flies short-axis-first.
 *  - Zahlentafel 36: PROLATE ellipsoid of revolution, d = 200 mm,
 *    l = 360 mm (Achsenverhältnis 1:1.8) — the rounded-both-ends
 *    low-fineness class, geometrically the cigar-preset's cousin.
 *
 * GEOMETRY IS ANALYTIC — an ellipsoid is a formula; ZERO tracing,
 * zero transcription risk on the shape side. The lathe below samples
 * r(x) = (d/2)·sqrt(1 − ((x−l/2)/(l/2))²) exactly.
 *
 * BASIS (verified by recomputation): Widerstandszahl c is FRONTAL —
 * c = W / (q · πd²/4). Spot checks: T36 row (q 9.21 kg/m², W 16.2 g)
 * → 0.056 vs printed 0.055; T35 row (q 39.5, W 723.5 g) → 0.583 vs
 * printed 0.580. Rounding-level agreement.
 *
 * TRANSCRIPTION STATUS: VERIFIED AGAINST THE PAGE IMAGE (2026-08-16,
 * owner's go: "do the exam"). Printed page 32 = archive.org leaf 40,
 * fetched at 1200 px via IIIF and read row-by-row. ALL rows of both
 * tables match the print exactly. The staging-flagged T36 row 3
 * (q 2.81 / W 11.7 / c 0.117) reads exactly so IN PRINT — the
 * inconsistency (c recomputed from W/(q·F) = 0.133) is a typo in the
 * 1923 original, not OCR; the row is EXCLUDED from the exam
 * (subcritical, immaterial). The Reynolds column is DIAMETER-based
 * for both tables (verified: v·0.2/ν ≈ printed R); length-based
 * Re = R × l/d (×1.8 prolate, ×0.75 oblate).
 *
 * ============================ EXAM =============================
 * RULES, FROZEN BEFORE ANY PREDICTION WAS COMPUTED (this header and
 * the exam code are committed before first run — the commit IS the
 * pre-registration; owner's go on record, same-day):
 *  1. Frozen estimator + frozen calibration vNEXT. Zero retuning.
 *     No calibration change follows from this exam alone, whatever
 *     the outcome (dated ruling + external review required).
 *  2. Geometry: the analytic lathes staged above (128 rings/36 segs,
 *     flow +X). Prediction: c_pred(Re_L) = ittcCf(Re_L) ·
 *     (wetted/frontal, mesh) + calibratePressure(proxy). Frontal
 *     basis matches the source (verified by recomputation).
 *  3. PRIMARY datum per body = its TOP-Re row (prolate Re_d 550k →
 *     Re_L 990k, c 0.084; oblate Re_d 546k → Re_L 410k, c 0.205) —
 *     closest to regime, declared now. Full supercritical branch
 *     reported alongside for the record.
 *  4. REGIME RULING (declared): the corpus is TRANSITIONAL (Re_L ≤
 *     ~1e6; prolate's supercritical c still RISING at the last
 *     datum; ITTC over-states friction here; laminar-separation
 *     effects can push pressure either way). Verdicts are therefore
 *     GROSS-ONLY, pre-declared:
 *       within ±20% of primary datum → "mid-map supported at
 *         transitional Re" (upgrade needs a higher-Re corpus);
 *       HIGH by ≥2× → mid-map OVER-charge evidence (the cigar-
 *         challenge direction) — motivates a mid-map knot review;
 *       LOW by ≥2× → under-charge evidence;
 *       1.2–2× either way → inconclusive-lean, recorded.
 *     The oblate is corroborative only (bluff end already anchored).
 *  5. T36 row 3 excluded (printed-inconsistent in the original).
 *  6. Prolate-vs-oblate ordering is BY CONSTRUCTION under the
 *     monotone map (proxies 0.597 < 0.894) — not claimable as a
 *     finding.
 *
 * PRE-REGISTERED HYPOTHESIS (recorded before the first run, in the
 * TR-397 tradition): at proxy 0.597 the calibration map is pure
 * linear interpolation across the 0.181 → 0.816 knot desert; the
 * mid-map-over-charge diagnosis (and the owner's sustained cigar
 * challenge) predicts c_pred comes out HIGH vs the 0.084 primary
 * datum by roughly 2–4×, i.e. the exam FAILS the band in the HIGH
 * direction. The transitional-Re caveat plausibly accounts for some
 * of the gap (turbulent-regime truth for this body is plausibly
 * ~0.1–0.15) but not a ≥2× gap. If instead the prediction lands
 * inside ±20%, the mid-map interpolation gains its first real
 * support and the over-charge suspicion loses its remaining
 * evidence.
 */
import { measureSectionalProxy, calibratePressure } from '../../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf } from '../../src/dynamicsCore.js';
import { latheProfile } from './tn614-bodies.mjs';

/* Zahlentafel 35 — oblate 1:0.75. Rows: [q kg/m², v m/s, Re_d ×10³, W g, c]. */
export const T35_OBLATE = [
  [6.41, 10.1, 136.9, 121.7, 0.600],
  [14.3, 15.1, 206.0, 267.0, 0.591],
  [25.1, 20.0, 272.5, 463.7, 0.585],
  [39.5, 25.1, 342.0, 723.5, 0.580],
  [56.6, 30.1, 410.0, 1032.4, 0.577],
  [62.2, 31.6, 431.0, 1128.0, 0.573],
  [67.8, 32.9, 449.0, 1213.9, 0.567],
  [76.8, 35.0, 477.0, 1311.0, 0.540],
  [81.1, 36.0, 491.0, 1084.8, 0.423],
  [86.7, 37.2, 507.0, 696.9, 0.254],
  [100.6, 40.1, 546.0, 652.0, 0.205],
];

/* Zahlentafel 36 — prolate 1:1.8. Same columns. Print-verified.
 * Row 3 carries the original's own arithmetic typo — EXCLUDED (rule 5). */
export const T36_PROLATE = [
  [0.67, 3.27, 44.0, 5.7, 0.269],
  [1.38, 4.70, 63.2, 7.2, 0.165],
  [2.81, 6.71, 90.4, 11.7, 0.117, 'EXCLUDED: printed-inconsistent (c vs W/(q·F) = 0.133)'],
  [4.19, 8.19, 110.3, 9.4, 0.071],
  [5.61, 9.48, 127.8, 11.9, 0.067],
  [6.45, 10.2, 136.7, 11.3, 0.055],
  [7.80, 11.2, 150.0, 14.0, 0.057],
  [9.21, 12.2, 163.2, 16.2, 0.055],
  [10.6, 13.0, 178.0, 19.0, 0.057],
  [12.0, 13.8, 189.3, 21.7, 0.057],
  [13.4, 14.6, 200.0, 23.6, 0.056],
  [14.2, 15.1, 206.0, 26.3, 0.059],
  [16.2, 16.1, 220.0, 29.2, 0.057],
  [18.4, 17.2, 235.0, 34.4, 0.059],
  [20.4, 18.1, 248.0, 39.2, 0.061],
  [25.2, 20.1, 274.0, 49.4, 0.062],
  [39.2, 25.0, 342.0, 80.1, 0.065],
  [57.1, 30.2, 412.0, 125.6, 0.070],
  [77.1, 35.1, 480.0, 184.2, 0.076],
  [100.7, 40.2, 550.0, 265.0, 0.084],
];

const D_M = 0.200;
const F_M2 = (Math.PI * D_M * D_M) / 4;

function checkTable(name, rows) {
  let flagged = 0;
  for (const [q, , , wG, c] of rows) {
    const cRecomputed = wG / 1000 / (q * F_M2);
    const err = Math.abs(cRecomputed - c) / c;
    if (err > 0.03) {
      flagged++;
      console.log(`  FLAG ${name}: printed c ${c} vs W/(q·F) ${cRecomputed.toFixed(3)} (${(100 * err).toFixed(0)}% off) — verify row against the page image`);
    }
  }
  return flagged;
}

/* Analytic ellipsoid profile in %L (flow along +X), dense cosine sampling. */
function ellipsoidProfile(lengthMm, diaMm, n = 64) {
  const rMaxPct = (diaMm / 2 / lengthMm) * 100;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = (Math.PI * i) / n; // cosine spacing concentrates ends
    const xPct = 50 * (1 - Math.cos(th));
    const t = (xPct - 50) / 50;
    pts.push([xPct, rMaxPct * Math.sqrt(Math.max(0, 1 - t * t))]);
  }
  return pts;
}

function measure(name, lengthMm, diaMm) {
  const mesh = latheProfile(ellipsoidProfile(lengthMm, diaMm), 128, 36);
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: lengthMm / 1000 });
  const p = measureSectionalProxy(mesh.verts, mesh.faces, { axis: '+X' });
  const frontalExact = (Math.PI * (diaMm / 1000) ** 2) / 4;
  console.log(`${name}: proxy ${p.proxy.toFixed(3)} (oddFraction ${p.quality.oddFraction})`
    + ` · mesh frontal ${g.frontalArea.toFixed(5)} m² vs analytic ${frontalExact.toFixed(5)}`
    + ` · wetted/frontal ${g.wettedOverFrontal.toFixed(2)}`);
  return { proxy: p.proxy, wf: g.wettedOverFrontal };
}

function exam(name, body, rows, reScale, primaryLast) {
  const pressure = calibratePressure(body.proxy);
  console.log(`\n-- ${name}: calibrated pressure ${pressure.toFixed(4)} at proxy ${body.proxy.toFixed(3)} --`);
  console.log('Re_d(e3)  Re_L(e3)  c_meas   c_pred   pred/meas');
  for (const r of rows) {
    if (r.length > 5) { console.log(`${String(r[2]).padEnd(8)}  — ${r[5]}`); continue; }
    const reL = r[2] * 1000 * reScale;
    const pred = ittcCf(reL) * body.wf + pressure;
    console.log(`${String(r[2]).padEnd(8)}  ${(reL / 1000).toFixed(0).padEnd(8)}  ${r[4].toFixed(3)}    ${pred.toFixed(3)}    ${(pred / r[4]).toFixed(2)}×`);
  }
  const prim = rows[rows.length - 1];
  const reL = prim[2] * 1000 * reScale;
  const pred = ittcCf(reL) * body.wf + pressure;
  const ratio = pred / prim[4];
  let verdict;
  if (Math.abs(pred - prim[4]) <= 0.2 * pred) verdict = 'INSIDE ±20% — mid-map supported at transitional Re';
  else if (ratio >= 2) verdict = `HIGH ${ratio.toFixed(1)}× — mid-map OVER-charge evidence (rule 4)`;
  else if (ratio <= 0.5) verdict = `LOW ${(1 / ratio).toFixed(1)}× — under-charge evidence (rule 4)`;
  else verdict = `${ratio.toFixed(2)}× — inconclusive-lean (rule 4)`;
  console.log(`PRIMARY (top Re): predicted ${pred.toFixed(3)} vs measured ${prim[4].toFixed(3)} → ${verdict}`);
  return { pred, meas: prim[4], ratio, verdict };
}

console.log('== Ergebnisse II ellipsoids — THE EXAM (rules + hypothesis frozen in the header, committed pre-run) ==\n');
console.log('transcription consistency (print-verified; >3% rows flagged):');
checkTable('T35', T35_OBLATE);
checkTable('T36', T36_PROLATE.filter((r) => r.length <= 5));
const oblate = measure('OBLATE  1:0.75 (l 150 / d 200)', 150, 200);
const prolate = measure('PROLATE 1:1.8  (l 360 / d 200)', 360, 200);
exam('PROLATE 1:1.8 — THE KILL-TEST BODY', prolate, T36_PROLATE, 1.8, true);
exam('OBLATE 1:0.75 — bluff corroboration only', oblate, T35_OBLATE, 0.75, true);
console.log('\nFrozen estimator, frozen calibration vNEXT. NOTHING changes on this result alone (rule 1).');
