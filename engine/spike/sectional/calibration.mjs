/**
 * CALIBRATION vNEXT — RATIFIED by Toby 2026-08-16 ("the fix sounds good,
 * calibrate"), following the TN-614 validation finding (RESULTS.md).
 *
 * KNOTS (proxy → pressure Cd), monotone piecewise-linear, clamped:
 *  - TN-614 form 111  (REAL DATA, in-calibration: true, promoted
 *    2026-08-16): pressure = measured CD_A 0.0401 − ITTC friction at the
 *    report's effective Re 66e6. The family's sharp-tail extreme.
 *  - TN-614 form 332  (REAL DATA, in-calibration: true, promoted
 *    2026-08-16): pressure = 0.0508 − ITTC @66e6. Full-tail extreme.
 *  - Sphere (textbook 0.47 frontal) and cube+plate pooled bluff knot —
 *    unchanged from the original anchor set.
 *  - SYNTHETIC TEARDROP KNOT RETIRED FOR CAUSE (2026-08-16): its
 *    textbook total (0.045) hid a regime-fuzzy friction/pressure split
 *    that poisoned the streamlined segment (TN-614 exam 1, +132/+187%
 *    on full tails). A real fineness-3 body at the reference condition
 *    now PREDICTS ≈0.024 total — plausible at that Re; the 0.04–0.05
 *    textbook figure belongs to model-scale Re.
 *
 * Within-family interpolation under this calibration (r11 label): the
 * four NON-KNOT family members reproduce within 0–3% — regression
 * evidence, not an independent accuracy test (121T/211T reuse the
 * knots' physical sections; TR-397 queued as the independent exam).
 *
 * Failure semantics: non-finite proxy → NaN (estimate-unavailable).
 */
import { measureSections, scoreSections } from './sections.mjs';
import { measureDynamicsGeometry } from '../../src/dynamicsGeometry.js';
import { ittcCf } from '../../src/dynamicsCore.js';
import { makeSphere, makeCube, makePlate } from '../flow-chamber/shapes.mjs';
import { BODIES, TEST_RE, latheProfile } from './tn614-bodies.mjs';

export const REF_RE = ((100 / 3.6) * 100) / 1.5e-5; // reference condition for textbook bluff anchors

export function frictionCdAt(mesh, re) {
  const g = measureDynamicsGeometry(mesh.verts, mesh.faces, { flightAxis: 'X', lengthM: 100 });
  return ittcCf(re) * (g.wettedArea / g.frontalArea);
}
const proxyOf = (mesh) => scoreSections(measureSections(mesh.verts, mesh.faces, {})).compositeV1;

/** Build the vNEXT calibration. Returns { knots, calibrate, provenance }. */
export function buildCalibration() {
  const m111 = latheProfile(BODIES['111'].pts);
  const m332 = latheProfile(BODIES['332'].pts);
  const real = [
    { name: 'TN614-111', proxy: proxyOf(m111), pressure: BODIES['111'].cdA - frictionCdAt(m111, TEST_RE) },
    { name: 'TN614-332', proxy: proxyOf(m332), pressure: BODIES['332'].cdA - frictionCdAt(m332, TEST_RE) },
  ];
  const sph = makeSphere(), cub = makeCube(), plt = makePlate();
  const sphKnot = { name: 'sphere', proxy: proxyOf(sph), pressure: 0.47 - frictionCdAt(sph, REF_RE) };
  const cubP = proxyOf(cub), pltP = proxyOf(plt);
  const bluff = {
    name: 'bluff (cube+plate pooled)',
    proxy: (cubP + pltP) / 2,
    pressure: ((1.05 - frictionCdAt(cub, REF_RE)) + (1.17 - frictionCdAt(plt, REF_RE))) / 2,
  };
  const knots = [...real, sphKnot, bluff]
    .sort((a, b) => a.proxy - b.proxy)
    .map((k) => [k.proxy, k.pressure]);
  const calibrate = (x) => {
    if (!Number.isFinite(x)) return NaN; // estimate-unavailable, never "very bluff"
    if (x <= knots[0][0]) return Math.max(0, knots[0][1] * (x / knots[0][0] || 0));
    for (let i = 0; i + 1 < knots.length; i++) {
      if (x <= knots[i + 1][0]) {
        const t = (x - knots[i][0]) / (knots[i + 1][0] - knots[i][0]);
        return knots[i][1] + t * (knots[i + 1][1] - knots[i][1]);
      }
    }
    return knots[knots.length - 1][1]; // clamp above top knot
  };
  return { knots, calibrate, provenance: [...real.map((r) => r.name + ' (real, 2026-08-16)'), 'sphere (textbook)', 'bluff pooled (textbook)'] };
}
