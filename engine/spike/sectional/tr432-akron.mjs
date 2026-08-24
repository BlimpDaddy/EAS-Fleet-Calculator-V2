/**
 * TR-432 AKRON EXAM — PUBLISHED-OFFSET GEOMETRY (ZERO TRACING), BARE-HULL DRAG (2026-08-16).
 * The r14-prescribed gold-standard test: "independently defined
 * bare-hull geometry AND bare-hull drag data" — the first
 * apples-to-apples ABSOLUTE check of the frozen estimator, with ZERO
 * tracing anywhere in the chain.
 *
 * SOURCE: NACA Report No. 432, "Force Measurements on a 1/40-Scale
 * Model of the U.S. Airship Akron (ZRS-4)", Hugh B. Freeman (NTRS
 * 19930091505, public domain, fetched 2026-08-16). This is also the
 * body family TR-397's own fig. 25 uses as its best Reynolds-effect
 * reference (L/D 5.9).
 *
 * GEOMETRY (published DIMENSIONS OF MODEL table, page 3 — transcribed
 * from a 250-dpi render; crisp print, no ambiguous glyphs): 22 exact
 * stations a/L = 0..1, radius in INCHES (circumscribed circle; the
 * model is polygonal 36→24 sides — declared approximation: we lathe
 * the circumscribed radii as a body of revolution). Length 19.62 ft,
 * volume 115 ft³, max radius 19.90 in → D 3.3167 ft, f.r. 5.9. The
 * surface was sand-finished "probably as smooth as a well doped
 * fabric surface".
 *
 * MEASURED BARE-HULL DRAG (page 8 table + fig. 8): Cs on the
 * (vol)^(2/3) basis at Reynolds Number V·(vol)^(1/3)/ν of 3.05e6 /
 * 3.73e6 / 4.30e6:
 *   P.R.T. 1/40 model (this model):        0.0198  0.0193  0.0190*
 *   V.D.T. wooden 1/200 (aux balance):     0.0215  0.0212  0.0209
 *   V.D.T. metal  1/250 (aux balance):     0.0228  0.0223  0.0219
 *   V.D.T. wooden 1/200 (main balance):        —       —   0.0180
 *   (*printed "0.1090" — an evident misprint for ≈0.0190: fig. 8's
 *    P.R.T. high-speed curve reads ≈0.019 at Re 4.3e6; flagged.)
 *
 * CONVERSIONS (exact, declared): frontal CD_A = Cs × vol^(2/3) / A
 * with A = πD²/4 from the published max radius; length-based Re for
 * ITTC friction = Re_v × L / vol^(1/3).
 *
 * DISCIPLINE: frozen estimator, frozen calibration, nothing tuned.
 * This is model-scale Re (~1.2–1.7e7 length-based) — squarely inside
 * ITTC's comfort zone. No calibration change follows from this file;
 * results feed the standing kill-test record and any future dated
 * ruling.
 */
import { measureSectionalProxy, calibratePressure } from '../../src/cdEstimator.js';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf } from '../../src/dynamicsCore.js';
import { latheProfile } from './tn614-bodies.mjs';

/* Published offsets: [a/L, radius inches]. L = 19.62 ft = 235.44 in. */
export const AKRON_OFFSETS = [
  [0.00, 0], [0.02, 4.95], [0.05, 9.96], [0.10, 14.20], [0.15, 16.65],
  [0.20, 18.39], [0.25, 19.12], [0.30, 19.61], [0.35, 19.85], [0.40, 19.90],
  [0.45, 19.90], [0.50, 19.80], [0.55, 19.59], [0.60, 19.12], [0.65, 18.46],
  [0.70, 17.50], [0.75, 16.15], [0.80, 14.44], [0.85, 12.29], [0.90, 9.61],
  [0.95, 6.52], [1.00, 0],
];

const L_FT = 19.62, VOL_FT3 = 115, L_IN = L_FT * 12;
const D_FT = (2 * 19.90) / 12;
const A_FT2 = Math.PI * D_FT * D_FT / 4;
const VOL23 = Math.pow(VOL_FT3, 2 / 3);
const CS_TO_CDA = VOL23 / A_FT2;

export const MEASURED = [
  { source: 'P.R.T. 1/40 (this model)', reV: [3.05e6, 3.73e6, 4.30e6], cs: [0.0198, 0.0193, 0.0190], note: 'third value printed 0.1090 — evident misprint, read from fig. 8' },
  { source: 'V.D.T. wooden 1/200 (aux)', reV: [3.05e6, 3.73e6, 4.30e6], cs: [0.0215, 0.0212, 0.0209] },
  { source: 'V.D.T. metal 1/250 (aux)', reV: [3.05e6, 3.73e6, 4.30e6], cs: [0.0228, 0.0223, 0.0219] },
  { source: 'V.D.T. wooden 1/200 (main)', reV: [4.30e6], cs: [0.0180] },
];

const f3 = (x) => x.toFixed(3);
const f4 = (x) => x.toFixed(4);

// Profile for the lathe: [x %L, r %L] from the published inches.
const pts = AKRON_OFFSETS.map(([aL, rIn]) => [aL * 100, (rIn / L_IN) * 100]);
const mesh = latheProfile(pts, 128, 36);
const g = meshGeometry();
function meshGeometry() {
  return measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: L_FT * 0.3048 });
}
const p = measureSectionalProxy(mesh.verts, mesh.faces, { axis: '+X' });
const pressure = calibratePressure(p.proxy);

console.log('== TR-432 AKRON — exact published bare hull vs the frozen estimator ==');
console.log(`geometry: L ${L_FT} ft, D ${D_FT.toFixed(3)} ft (f.r. ${(L_FT / D_FT).toFixed(2)}), published vol ${VOL_FT3} ft³`);
console.log(`lathe check: mesh frontal ${(g.frontalArea / (0.3048 * 0.3048)).toFixed(2)} ft² vs published ${A_FT2.toFixed(2)} ft² · wetted/frontal ${g.wettedOverFrontal.toFixed(2)}`);
console.log(`sectional proxy ${f3(p.proxy)} (oddFraction ${p.quality.oddFraction}) → calibrated pressure ${f4(pressure)}`);
console.log(`Cs→CD_A conversion factor: vol^(2/3)/A = ${CS_TO_CDA.toFixed(3)}\n`);

console.log('Re_v        Re_L(ITTC)   friction  PREDICTED CD_A | measured CD_A per source (bare hull)');
for (let i = 0; i < 3; i++) {
  const reV = 3.05e6 + [0, 0.68e6, 1.25e6][i];
  const reL = [3.05e6, 3.73e6, 4.30e6][i] * (L_FT / Math.pow(VOL_FT3, 1 / 3));
  const friction = ittcCf(reL) * g.wettedOverFrontal;
  const predicted = friction + pressure;
  const cols = MEASURED.map((m) => {
    const idx = m.reV.indexOf([3.05e6, 3.73e6, 4.30e6][i]);
    return idx < 0 ? '—' : f4(m.cs[idx] * CS_TO_CDA);
  });
  console.log(`${[3.05e6, 3.73e6, 4.30e6][i].toExponential(2)}   ${reL.toExponential(2)}   ${f4(friction)}    ${f4(predicted)}      | ${cols.join('   ')}`);
}

console.log('\nsources:', MEASURED.map((m) => m.source).join(' | '));
const midMeasured = MEASURED[0].cs[1] * CS_TO_CDA; // P.R.T., this very model, mid Re
const midReL = 3.73e6 * (L_FT / Math.pow(VOL_FT3, 1 / 3));
const midPred = ittcCf(midReL) * g.wettedOverFrontal + pressure;
console.log(`\nheadline (P.R.T., the 1/40 model itself, mid Re): predicted ${f4(midPred)} vs measured ${f4(midMeasured)} → ${(100 * (midPred - midMeasured) / midMeasured).toFixed(0)}% gap`);
console.log('band check: ±20% of prediction = [' + f4(midPred * 0.8) + ', ' + f4(midPred * 1.2) + ']');
console.log('\nZERO tracing in this chain. Frozen estimator, frozen calibration. No changes follow from this file.');
