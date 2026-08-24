/**
 * TM-267 CROSS-SECTION EXAM — quantifying the equal-A(x) blindness
 * (2026-08-16). NACA TM-267: Wieselsberger, Göttingen Report II —
 * a streamlined airship model with ROUND cross-section vs one with
 * SQUARE cross-section "at every point", SAME length (81 cm), SAME
 * volume, same largest cross-section (136 cm²), measured lift+drag
 * (NTRS 19930086404, fetched 2026-08-16).
 *
 * WHAT THE CONSTRAINTS DO AND DON'T FIX (r14 post-seal correction):
 * equal length + volume + max section fix ∫A dx and max A — they do
 * NOT determine A(x); the historical models' stationwise areas are
 * unestablished. THIS exam builds a SYNTHETIC equal-A(x) realization
 * of the pair. The estimator's pressure term is A(x)-only (corner
 * term REMOVED — battery finding, r9 #4 documented blindness), so it
 * predicts IDENTICAL pressure for our two meshes; the predicted
 * difference comes solely from the meshes' computed wetted areas
 * driving friction. Wieselsberger's own 1924 explanation of the
 * measured difference is the same mechanism: "smaller friction due
 * to the smaller surface of the round model, since, for well-shaped
 * bodies, the frictional drag constitutes a large share."
 * This exam is QUALITATIVE CORROBORATION of the friction-surface mechanism (a synthetic equal-A(x) realization yields a similar-order penalty), NOT a quantitative bound on the blindness — r14 post-seal demotion.
 *
 * THE CLEAN CLAIM IS THE RATIO. Measured at α = 0°: round CD 0.046,
 * square CD 0.050 (both on largest-section area) → ratio 1.087.
 * The ABSOLUTE values are OUT OF REGIME for the estimator (18.5 m/s ×
 * 0.81 m → Re_L ≈ 1.0e6, transitional; ITTC assumes fully-turbulent —
 * the same regime lesson TN-614 taught) — reported with that caveat,
 * not claimed. The report itself warns "all the measured forces were
 * very small, so that the degree of accuracy is less than usual."
 *
 * GEOMETRY: exact fig-1 ordinates are not printed (tracing is
 * disqualified per r14); the RATIO is profile-family-insensitive
 * because both SYNTHETIC bodies share A(x) by construction — a teardrop
 * profile at the published fineness (L 81 cm; round D from 136 cm² →
 * 13.16 cm → f.r. 6.15), round = lathe, square = area-matched square
 * sections (side(x) = √A(x)) built as a 4-sided extrusion.
 *
 * Frozen estimator, frozen calibration, nothing tuned.
 */
import { measureSectionalProxy, calibratePressure } from '../../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf, NU_M2_S } from '../../src/dynamicsCore.js';
import { makeTeardrop } from '../flow-chamber/shapes.mjs';

const L_M = 0.81, AREA_M2 = 0.0136, V_MS = 18.5;
const D_M = Math.sqrt(4 * AREA_M2 / Math.PI);
const FINENESS = L_M / D_M;

/* Round body: teardrop-family lathe at the published fineness. */
const round = makeTeardrop(FINENESS, 96, 32);

/* Square body: SAME sectional areas, square sections. Rebuild from the
 * round mesh's own profile: r(x) sampled, side(x) = r(x)·√π. */
function squareFromRound(mesh, rings = 96) {
  let minX = Infinity, maxX = -Infinity;
  for (const [x] of mesh.verts) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const L = maxX - minX;
  // radius at stations from the analytic teardrop family: sample max |r|
  const r = new Array(rings + 1).fill(0);
  for (const [x, y, z] of mesh.verts) {
    const i = Math.round(((x - minX) / L) * rings);
    r[i] = Math.max(r[i], Math.hypot(y, z));
  }
  const verts = [], faces = [], ringIdx = [];
  for (let i = 0; i <= rings; i++) {
    const x = minX + (L * i) / rings;
    const h = (r[i] * Math.sqrt(Math.PI)) / 2; // half-side, area-matched
    if (h < 1e-6) { ringIdx.push(verts.push([x, 0, 0]) - 1); continue; }
    const first = verts.length;
    verts.push([x, -h, -h], [x, h, -h], [x, h, h], [x, -h, h]);
    ringIdx.push(first);
  }
  const size = (i) => (i < rings ? ringIdx[i + 1] - ringIdx[i] : verts.length - ringIdx[i]);
  for (let i = 0; i < rings; i++) {
    const a = ringIdx[i], b = ringIdx[i + 1], aP = size(i) === 1, bP = size(i + 1) === 1;
    if (aP && bP) continue;
    for (let s = 0; s < 4; s++) {
      const s1 = (s + 1) % 4;
      if (aP) faces.push([a, b + s, b + s1]);
      else if (bP) faces.push([b, a + s1, a + s]);
      else faces.push([a + s, b + s, b + s1], [a + s, b + s1, a + s1]);
    }
  }
  return { verts, faces };
}
const square = squareFromRound(round);

const f3 = (x) => x.toFixed(3);
const f4 = (x) => x.toFixed(4);
const reL = (V_MS * L_M) / NU_M2_S;

function examine(mesh, label) {
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: L_M });
  const p = measureSectionalProxy(mesh.verts, mesh.faces, { axis: '+X' });
  const friction = ittcCf(reL) * g.wettedOverFrontal;
  const pressure = calibratePressure(p.proxy);
  console.log(`${label.padEnd(8)} proxy ${f3(p.proxy)}  wetted/frontal ${g.wettedOverFrontal.toFixed(2)}  friction ${f4(friction)}  pressure ${f4(pressure)}  CD ${f4(friction + pressure)}`);
  return { g, p, friction, pressure, cd: friction + pressure };
}

console.log('== TM-267 — round vs square cross-section, equal A(x) (Göttingen 1924) ==');
console.log(`published: L ${L_M} m, max section ${AREA_M2 * 1e4} cm², f.r. ${FINENESS.toFixed(2)}, V ${V_MS} m/s → Re_L ${reL.toExponential(2)} (TRANSITIONAL — absolute values out of regime, declared)\n`);
const rd = examine(round, 'ROUND');
const sq = examine(square, 'SQUARE');
console.log(`\nsection-area match check: frontal ratio sq/rd = ${(sq.g.frontalArea / rd.g.frontalArea).toFixed(3)} (frontal is CONVEX-SILHOUETTE, square > round circumscribed — expected > 1)`);
console.log(`wetted ratio sq/rd = ${(sq.g.wettedArea / rd.g.wettedArea).toFixed(3)} (theory for area-matched sections: 2/√π = ${(2 / Math.sqrt(Math.PI)).toFixed(3)})`);
console.log(`proxy difference: ${f3(Math.abs(sq.p.proxy - rd.p.proxy))} (equal-A(x) ⇒ ~0 BY DESIGN — the documented blindness)`);

const predictedRatio = sq.cd / rd.cd;
console.log(`\nPREDICTED CD ratio square/round: ${predictedRatio.toFixed(3)}`);
console.log('MEASURED  CD ratio square/round: 1.087  (0.050 / 0.046 at α = 0°; report warns accuracy is low)');
console.log(`\nabsolute (out-of-regime, ITTC fully-turbulent at transitional Re — expected overshoot):`);
console.log(`  predicted round ${f4(rd.cd)} vs measured 0.046 · predicted square ${f4(sq.cd)} vs measured 0.050`);
console.log('\nReading (r14 post-seal wording): a synthetic equal-A(x) realization of the 1924 experiment');
console.log('yields a similar-order penalty to the measured one — QUALITATIVE corroboration of the');
console.log('friction-surface mechanism, NOT a quantitative bound on the equal-A(x) blindness.');
console.log('Frozen everything; no changes follow from this file.');
