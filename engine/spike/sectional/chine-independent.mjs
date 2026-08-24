/**
 * INDEPENDENT NON-SMOOTH VALIDATION CONTROL — 28a amendment 1, finally built.
 * FROZEN 2026-08-20 BEFORE ANY FEATURE TREATMENT EXISTS. Spec 40.2.
 *
 * ============================ READ THIS ============================
 * THE FEATURE-PRESERVING RECONSTRUCTION MUST NOT BE RUN ON THIS BODY
 * UNTIL IT HAS BEEN DEVELOPED AND SELECTED ON THE GATE 2 CHINE.
 *
 * The Gate 2 chine (flat at y = -0.700) has been observed and used to
 * diagnose the required change. It is now DEVELOPMENT / SELECTION data and
 * can never serve as the proof that the treatment works. This body is the
 * first genuine test, and looking at how the method performs here while the
 * method is still being designed destroys exactly that.
 *
 * This file therefore contains geometry, the analytic oracle and the frozen
 * tolerances ONLY. The self-check below validates the body as an INPUT --
 * that its vertices lie on its own analytic surface -- and deliberately
 * computes no fidelity number of any kind: no skin, no ribbons, no raw
 * baseline, no false turning.
 * ===================================================================
 *
 * DESIGN. Same hull as the Gate 2 control (prolate spheroid A = 3, B = 1) so
 * that the ONLY difference is the feature. Two oblique flats of different
 * depth:
 *
 *   flat 1: inward normal at 210 deg, distance 0.45
 *   flat 2: inward normal at  60 deg, distance 0.80
 *
 * DIFFERENT FLAT WIDTH, DIFFERENT CHINE ANGLE, ASYMMETRIC -- as required:
 *
 *   | control      | flat half-width | flat width | chine angle |
 *   | Gate 2       | 45.573 deg      |  91.15 deg | 45.573 deg  |
 *   | independent1 | 63.256 deg      | 126.51 deg | 63.256 deg  |
 *   | independent2 | 36.870 deg      |  73.74 deg | 36.870 deg  |
 *
 * (half-width = acos(d/R); the angle between the flat and the circle tangent
 * at the corner is the same quantity.)
 *
 * ASYMMETRY IS STRUCTURAL, NOT COSMETIC. The only reflection mapping one
 * normal onto the other is about 135 deg, and it fails because the depths
 * differ (0.45 vs 0.80). No reflection fixes both. So the body has NO mirror
 * plane containing the flight axis, unlike the Gate 2 control.
 *
 * FOUR corners instead of two, at four different sweep rates, since each
 * corner angle is acos(-d_i / rc(x)) and the two d_i differ.
 *
 * STILL STAR-SHAPED ABOUT THE AXIS: the body is a convex spheroid
 * intersected with two half-spaces, hence convex, and the origin is interior
 * because both depths are positive. The v1 polar parameterisation therefore
 * remains valid here, so a failure cannot be blamed on it.
 */

export const A = 3, B = 1;
export const FLATS = [
  { thetaDeg: 210, d: 0.45 },
  { thetaDeg: 60, d: 0.80 },
];

const rc = (x) => Math.sqrt(Math.max(0, 1 - (x / A) ** 2)) * B;

/** ANALYTIC ORACLE. Exact radius of the independent control at (x, theta). */
export function chineIndependentFn(x, th) {
  let r = rc(x);
  for (const { thetaDeg, d } of FLATS) {
    const c = Math.cos(th - (thetaDeg * Math.PI) / 180);
    if (c > 1e-12) r = Math.min(r, d / c);
  }
  return r;
}

/** FROZEN TOLERANCES — identical to Gate 2. Nothing is loosened for this body. */
export const TOLERANCES = {
  profile: 0.02,          // 2% of Rmax — ribbons.mjs TOL.profile, spec 21 directional row
  turnMax: 0.5,           // deg, reported
  turnMed: 0.1,           // deg, reported
  gatedOn: 'profile',     // exactly as Gate 2 was gated
};

/* ------------------------------------------------------------------ */
/* INPUT VALIDATION ONLY — run directly. Computes no fidelity metric.  */
/* ------------------------------------------------------------------ */
if (process.argv[1] && process.argv[1].endsWith('chine-independent.mjs')) {
  const { analyticBody } = await import('./ribbons.mjs');
  const DEG = 180 / Math.PI;
  console.log('\nINDEPENDENT CHINE CONTROL — INPUT VALIDATION ONLY.');
  console.log('No reconstruction, no ribbons, no baseline, no fidelity number.\n');
  for (const { thetaDeg, d } of FLATS) {
    const hw = Math.acos(d / B);
    console.log(`  flat normal ${String(thetaDeg).padStart(3)}deg  depth ${d}  ` +
      `half-width ${(hw * DEG).toFixed(3)}deg  full width ${(2 * hw * DEG).toFixed(2)}deg  ` +
      `chine angle ${(hw * DEG).toFixed(3)}deg`);
  }
  let worstOff = 0, minR = Infinity;
  for (const nt of [30, 96]) {
    const m = analyticBody(chineIndependentFn, A, { nx: 240, nt });
    for (const v of m.verts) {
      const r = Math.hypot(v[1], v[2]);
      if (r < 1e-12) continue;
      worstOff = Math.max(worstOff, Math.abs(r - chineIndependentFn(v[0], Math.atan2(v[2], v[1]))));
    }
    console.log(`  nt=${String(nt).padEnd(3)} mesh builds: ${m.verts.length} vertices, ${m.faces.length} faces`);
  }
  for (let k = 0; k < 3600; k++) minR = Math.min(minR, chineIndependentFn(0, (k * Math.PI) / 1800));
  console.log(`\n  vertices on own analytic surface within ${worstOff.toExponential(2)}  (input gate: <= 1e-9) -> ${worstOff <= 1e-9 ? 'VALID' : 'INVALID'}`);
  console.log(`  min radius at mid-body ${minR.toFixed(4)} > 0 -> origin interior, body star-shaped, polar u valid`);
  console.log('\n  FROZEN. Not to be run through any reconstruction until the feature');
  console.log('  treatment is developed and selected on the Gate 2 chine.\n');
}
